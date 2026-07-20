// Audit actions → sentences a business owner can read.
//
// `audit_logs.action` is a machine string: `commerce.product.created`,
// `crm.order.fulfillment.recorded`, `inventory.adjusted`. There are ~294
// distinct ones today and new ones ship continuously, so this CANNOT be a
// hand-written table of 294 entries — it would be stale within a week and any
// action it missed would render a blank feed row.
//
// So it resolves by CONVENTION, with a small override table for the handful
// whose convention output reads badly:
//
//   <module>.<entity>.<verb>              271 of 294 — "Product created"
//   <module>.<entity>.<sub>.<verb>          8        — "Order fulfillment created"
//   <module>.<verb>                        15        — "Inventory adjusted"
//
// Entity-first, not verb-first ("Product created", not "Created product"),
// because it is the only ordering that stays readable across every verb in the
// vocabulary: "Product bulk price adjusted" reads; "Bulk price adjusted
// product" does not.
//
// An unknown action still produces a sensible sentence rather than nothing —
// that fallback is load-bearing, not defensive dressing.

/** First segment → the module slug the UI tints the row with. Several audit
 *  namespaces are narrower than the module that owns their screen. */
const MODULE_OF: Record<string, string> = {
  commerce: 'commerce',
  crm: 'crm',
  inventory: 'inventory',
  invoicing: 'invoicing',
  email: 'email',
  builder: 'builder',
  // Site structure all lives under the Builder module's hue.
  sitebuilder: 'builder',
  redirect: 'builder',
  navigation: 'builder',
  // Content, its types, its authors and its media are all CMS to an operator.
  content: 'cms',
  content_type: 'cms',
  author: 'cms',
  media: 'cms',
  // MCP tool calls are the AI module's surface — an assistant acting on the
  // tenant's data through `mcp.<tool_name>`.
  mcp: 'ai',
  // Scheduling writes `booking.*` rather than `scheduling.*`.
  booking: 'scheduling',
  calendar: 'scheduling',
  // Account-level plumbing has no business module.
  webhook: 'platform',
  tenant: 'platform',
  legal: 'platform',
};

/**
 * Action prefixes that are READS, not state changes.
 *
 * The audit log deliberately records reads too — "who looked at this?" is a
 * real forensic question, so `/v1/audit` keeps them. But an activity feed that
 * announces "someone listed the pages" is noise: on real data these were ~45 of
 * the most recent 200 rows, crowding out everything that actually happened.
 * This is the doc's own rule made real — not every audit row is activity.
 */
export const READ_ONLY_ACTION_PREFIXES = [
  'mcp.list_',
  'mcp.get_',
  'mcp.search_',
  'mcp.describe_',
  'mcp.read_',
] as const;

/**
 * Actions whose convention output is wrong or clumsy. Deliberately short — an
 * entry here is a claim that the convention genuinely fails, not a preference.
 */
const OVERRIDE: Record<string, string> = {
  'sitebuilder.scheduled': 'Publish scheduled',
  'sitebuilder.schedule_cancelled': 'Scheduled publish cancelled',
  'content_type.upserted': 'Content type saved',
  'content_type.deleted': 'Content type deleted',
  'redirect.bulk_imported': 'Redirects imported',
  'commerce.product.bulk_price_adjusted': 'Prices bulk-adjusted',
  'commerce.product.bulk_price_reverted': 'Bulk price change undone',
  'commerce.cart.abandoned': 'Cart abandoned',
  'crm.segment.bootstrapped': 'Starter segments created',
  'commerce.fitment.dictionary_installed': 'Fitment dictionary installed',
  // Convention yields "Payment payment" — entity and verb are the same word.
  'invoicing.payment.payment': 'Payment recorded',

  // MCP tool calls are `mcp.<tool_name>`, so the convention produces the tool's
  // internal name ("Mcp upsert silica page") — jargon, and exactly what the
  // non-technical-audience rule forbids. These are the write tools seen in the
  // wild; reads are filtered out before they ever reach a sentence.
  'mcp.upsert_silica_page': 'Page saved',
  'mcp.delete_silica_page': 'Page deleted',
  'mcp.publish_silica_site': 'Site published',
  'mcp.set_page_seo': 'Page SEO updated',
  'mcp.set_page_default': 'Default page changed',
  'mcp.set_page_record_type': 'Page record type changed',
};

/** `bulk_price_adjusted` → `bulk price adjusted`. */
function words(segment: string): string {
  return segment.replace(/_/g, ' ');
}

function capitalize(text: string): string {
  return text.length === 0 ? text : text.charAt(0).toUpperCase() + text.slice(1);
}

/** The module slug for an action, or null when its namespace isn't mapped. */
export function moduleForAction(action: string): string | null {
  const head = action.split('.')[0] ?? '';
  return MODULE_OF[head] ?? null;
}

/**
 * The human sentence for an action — "Product created", "Order refunded".
 *
 * Never throws and never returns empty: an unrecognised or malformed action
 * degrades to its own humanized text, because a feed row with no words is worse
 * than one that reads a little mechanically.
 */
export function sentenceForAction(action: string): string {
  const override = OVERRIDE[action];
  if (override) return override;

  const parts = action.split('.').filter(Boolean);
  if (parts.length === 0) return 'Something changed';
  // No namespace at all — humanize what we were given.
  if (parts.length === 1) return capitalize(words(parts[0] ?? ''));

  const verb = parts[parts.length - 1] ?? '';
  // 2 segments are `<module>.<verb>`, so the module word IS the subject
  // ("inventory.adjusted" → "Inventory adjusted"). Longer forms drop the
  // module and use everything between it and the verb as the subject.
  const entityParts = parts.length === 2 ? [parts[0] ?? ''] : parts.slice(1, -1);
  const entity = entityParts.map(words).join(' ');

  return capitalize(`${entity} ${words(verb)}`.trim());
}

/**
 * A human name for WHAT was acted on, pulled out of the audit diff — "Blue
 * Shirt" for a product, an email address for a customer.
 *
 * `AuditLog` stores only `entityId`, so without this a feed reads "Product
 * created" with no hint which product. The diff usually carries the name that
 * was written; when it doesn't, the row simply has no subject (never a
 * fabricated one, and never a raw UUID — an id tells an owner nothing).
 */
export function subjectFromDiff(diff: unknown): string | null {
  if (!diff || typeof diff !== 'object') return null;
  // Two shapes in the wild: the usual `{before, after}`, and MCP's
  // `{input, outcome}` — a tool call's arguments carry the identifying name
  // just as well, so it is read with the same field preference.
  const sides = diff as { after?: unknown; before?: unknown; input?: unknown };

  // Prefer the state it ended in; fall back to what it was (deletes have no
  // after), then to the arguments it was called with.
  for (const side of [sides.after, sides.before, sides.input]) {
    if (!side || typeof side !== 'object' || Array.isArray(side)) continue;
    const row = side as Record<string, unknown>;
    for (const field of ['name', 'title', 'label', 'orderNumber', 'number', 'email', 'slug']) {
      const value = row[field];
      if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    }
  }
  return null;
}
