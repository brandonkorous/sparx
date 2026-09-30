// Audit actions → sentences a business owner can read.
//
// `audit_logs.action` is a machine string: `commerce.product.created`,
// `crm.order.fulfillment.recorded`, `inventory.adjusted`. There are ~490
// distinct ones today and new ones ship continuously, so this CANNOT be a
// hand-written table of 490 entries — it would be stale within a week and any
// action it missed would render a blank feed row.
//
// So it resolves by CONVENTION, with an override table for the ones whose
// convention output reads badly:
//
//   <module>.<entity>.<verb>              the great majority — "Product created"
//   <module>.<entity>.<sub>.<verb>                           — "Order fulfillment created"
//   <module>.<verb>                                          — "Inventory adjusted"
//
// ~340 resolve with no entry at all. The other ~150 have one, and the reasons
// are set out above OVERRIDE — the convention is faithful, so an action segment
// that is an abbreviation comes out as an abbreviation.
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
  // Written by the staff console's operator routes, not by the tenant.
  member: 'platform',
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
 * Actions whose convention output is wrong or clumsy. An entry here is a claim
 * that the convention genuinely fails, not a preference.
 *
 * ── WHY THIS TABLE IS NO LONGER SHORT ────────────────────────────────────────
 *
 * It used to say "deliberately short", and had 18 entries. That was an argument
 * about the SHAPE of the mechanism read as a budget on its CONTENTS, and the
 * two are different things. The convention is what keeps this table from having
 * to be complete; it is not a reason to leave a sentence wrong once somebody has
 * read it. P03 opened What has been happening and the top of her feed read:
 *
 *     B2b ar created · Template seeded · Document snapshot frozen · Line added
 *     Fitment product set · Configuration template created · Stage reordered
 *
 * Rendering all 509 audit actions this file can see, 96 of them came out as
 * something a business owner cannot read. Four kinds of failure, and each one is
 * a claim about the convention rather than a matter of taste:
 *
 *   1. The action segment is an ABBREVIATION or a run-together word, so the
 *      convention faithfully prints a non-word: "B2b ar", "Bom", "Accountcredit
 *      takenback", "Uoms", "Sla", "Giftcard", "Sku".
 *   2. The verb is a DEVELOPER's verb for a thing the platform did on the
 *      tenant's behalf: seeded, bootstrapped, provisioned, backfilled, ensured,
 *      materialized, instantiated, upserted, dispositioned. All 17 of these say
 *      one thing to an owner — "we set this up for you" — and none of them say
 *      it in a word she would use.
 *   3. The action has NO SUBJECT once the module is dropped: "Line added",
 *      "Definition created", "Stage reordered". Added to what?
 *   4. Two different actions COLLIDE on one sentence. `webhook.subscription
 *      .created` and `commerce.subscription.created` both read "Subscription
 *      created", which is a developer's callback and a customer's repeat order
 *      wearing one name. `media.collection.created` reads the same as
 *      `commerce.collection.created`; `crm.settings.updated` the same as
 *      `email.settings.updated`.
 *
 * Everything the convention already gets right is still absent, and that is
 * still the point: "Product created", "Order refunded", "Booking cancelled" and
 * ~400 more resolve with no entry here. This table is the exception list, and
 * the test beside it asserts the RATIO so it cannot quietly become the rule.
 *
 * These words are the PLATFORM's — a console with its own vocabulary renames on
 * top of them at its own boundary (see piggles' `lib/console/activity-words.ts`),
 * exactly as it already does for report fields and screen names.
 */
const OVERRIDE: Record<string, string> = {
  'sitebuilder.scheduled': 'Publish scheduled',
  'sitebuilder.schedule_cancelled': 'Scheduled publish canceled',
  'content_type.upserted': 'Content type saved',
  'content_type.deleted': 'Content type deleted',
  'redirect.bulk_imported': 'Redirects imported',
  'commerce.product.bulk_price_adjusted': 'Prices bulk-adjusted',
  'commerce.product.bulk_price_reverted': 'Bulk price change undone',
  'commerce.cart.abandoned': 'Cart abandoned',
  'commerce.fitment.dictionary_installed': 'Fitment dictionary installed',
  // Convention yields "Payment payment" — entity and verb are the same word.
  'invoicing.payment.payment': 'Payment recorded',

  // ── 1. abbreviations and run-together words ────────────────────────────────
  //
  // The convention cannot fix these, because the fault is in the action string:
  // `commerce.accountcredit.takenback` has no word boundary to find, and `b2b_ar`
  // expands to "B2b ar" whatever the humanizer does. Renaming the actions is not
  // available — they are written into `audit_logs` on every deployed database and
  // the rows already there would stop resolving.
  'commerce.accountcredit.granted': 'Account credit granted',
  'commerce.accountcredit.takenback': 'Account credit taken back',
  'commerce.giftcard.issued': 'Gift card issued',
  'commerce.giftcard.adjusted': 'Gift card adjusted',
  'commerce.variant.sku_renamed': 'Variant SKU renamed',
  'inventory.bom.created': 'Bill of materials created',
  'inventory.bom.status_changed': 'Bill of materials status changed',
  'inventory.variant_uoms.set': 'Units of measure set',
  'inventory.variant_costing_method.set': 'Costing method set',
  'invoicing.b2b_ar.created': 'Wholesale invoice raised',
  'invoicing.b2b_ar.updated': 'Wholesale invoice updated',
  'invoicing.b2b_ar.voided': 'Wholesale invoice voided',
  'crm.b2b_account.created': 'Wholesale account created',
  'crm.b2b_account.updated': 'Wholesale account updated',
  'crm.b2b_account.deleted': 'Wholesale account deleted',
  'crm.b2b_account_contact.created': 'Wholesale account contact added',
  'crm.b2b_account_contact.updated': 'Wholesale account contact updated',
  'crm.sla_policy.created': 'Response time rule created',
  'crm.sla_policy.updated': 'Response time rule updated',
  'crm.sla_policy.archived': 'Response time rule archived',
  // `object_def` is the stored name; both consoles call these Record types.
  'crm.object_def.created': 'Record type created',
  'crm.object_def.updated': 'Record type updated',
  'crm.object_def.archived': 'Record type archived',

  // ── 2. the platform set something up for you ───────────────────────────────
  //
  // seeded / bootstrapped / provisioned / backfilled / ensured all describe the
  // same event from the inside: rows a tenant never asked for, written so a
  // module works on first use. From the outside there is one sentence for it,
  // and "set up" is the one an owner would use. Kept as separate entries rather
  // than a verb rule, because each one has to name WHAT was set up — that is
  // the half the convention loses.
  'builder.archetypes.seeded': 'Ready-made sections set up',
  'builder.emails.provisioned': 'Automatic emails set up',
  'builder.emails.seeded': 'Automatic emails set up',
  'builder.emails.refreshed': 'Automatic emails refreshed',
  'builder.layout.seeded': 'Starter layouts set up',
  'builder.pages.seeded': 'Starter pages set up',
  'builder.pages.home_ensured': 'Home page checked',
  'builder.pages.starter_backfilled': 'Starter pages filled in',
  'commerce.shipping.bootstrapped': 'Delivery set up',
  'commerce.site.settings.bootstrapped': 'Selling settings set up',
  'commerce.tax.bootstrapped': 'Tax set up',
  'crm.pipeline.bootstrapped': 'Starter pipeline set up',
  'crm.segment.bootstrapped': 'Starter segments set up',
  'crm.sla_policy.bootstrapped': 'Starter response times set up',
  'inventory.warehouse.bootstrapped': 'First warehouse set up',
  'invoicing.template.seeded': 'Starter invoice design set up',
  'invoicing.workflow.bootstrapped': 'Starter workflows set up',

  // Same family, different word: the editor's own machinery describing itself.
  'sitebuilder.layout.upserted': 'Layout saved',
  'sitebuilder.page_layout.instantiated': 'Layout applied to a page',
  'sitebuilder.page_layout.materialized': 'Layout copied into a page',
  'sitebuilder.template.materialized': 'Template copied into a page',
  'commerce.return.dispositioned': 'Return outcome decided',
  'inventory.level.grid_edit': 'Stock levels edited',

  // ── 3. the module is dropped and nothing is left to name ───────────────────
  //
  // The convention drops the first segment, which is right for `commerce.product
  // .created` and wrong here: `invoicing` was carrying the only noun.
  'invoicing.line.added': 'Invoice line added',
  'invoicing.line.updated': 'Invoice line updated',
  'invoicing.line.removed': 'Invoice line removed',
  'invoicing.line_type.created': 'Invoice line type created',
  'invoicing.line_type.updated': 'Invoice line type updated',
  'invoicing.line_type.deleted': 'Invoice line type deleted',
  'invoicing.stage.created': 'Workflow step created',
  'invoicing.stage.reordered': 'Workflow steps reordered',
  'invoicing.template.created': 'Invoice design created',
  'invoicing.template.published': 'Invoice design published',
  'invoicing.template.set_default': 'Invoice design made the default',
  // "Snapshot frozen" is the implementation. What happened is that the figures
  // stopped being able to move, which is the fact a person needs.
  'invoicing.document.snapshot_frozen': 'Invoice figures locked in',
  'sitebuilder.definition.created': 'Custom section created',
  'sitebuilder.definition.updated': 'Custom section updated',
  'sitebuilder.definition.deleted': 'Custom section deleted',
  'sitebuilder.published': 'Site published',
  'builder.site.frame.reset': 'Header and footer reset',
  'builder.governance.allowlist_updated': 'What the editor may use changed',
  'builder.component.created': 'Saved piece created',
  'builder.component.updated': 'Saved piece updated',
  'builder.component.deleted': 'Saved piece deleted',
  'builder.archetype.created': 'Ready-made section created',
  'builder.archetype.updated': 'Ready-made section updated',
  'builder.archetype.deleted': 'Ready-made section deleted',
  'commerce.checkout.payment_intent_created': 'Payment started at checkout',
  'commerce.answer.submitted': 'Answer to a question submitted',
  'commerce.provider.installed': 'Integration installed',
  'commerce.provider.activated': 'Integration turned on',
  'crm.association.created': 'Records linked',
  'crm.association.updated': 'Record link updated',
  'crm.association.removed': 'Records unlinked',
  'crm.association_label.created': 'Relationship type created',
  'crm.association_label.updated': 'Relationship type updated',
  'crm.association_label.deleted': 'Relationship type deleted',
  // Distinct from `crm.customer.created`, which is somebody typing one in. This
  // one is a form or a checkout handing over their details, so the sentence has
  // to say where they came from or the two are indistinguishable.
  'crm.customer.captured': 'Customer added from your site',
  'crm.engagement.sent': 'Message sent to a customer',
  'email.domain.created': 'Sending address added',
  'email.domain.removed': 'Sending address removed',
  'email.domain.set_default': 'Sending address made the default',
  'email.suppression.added': 'Address added to Do not email',
  'email.suppression.removed': 'Address taken off Do not email',
  'email.suppression.imported': 'Do not email list imported',
  // Four segments, so the convention keeps `site.symbol` and prints "Site symbol
  // saved". A symbol IS the saved piece the component library calls a component.
  'builder.site.symbol.saved': 'Saved piece saved',
  'builder.site.symbol.removed': 'Saved piece removed',
  'builder.component.placements_upgraded': 'Saved piece updated everywhere it is used',
  'builder.email.created': 'Email design created',
  'builder.email.deleted': 'Email design deleted',
  'builder.email.published': 'Email design published',
  'builder.email.site_override_created': 'Email design set for one site',
  'builder.email.version.restored': 'Email design rolled back',
  // The convention drops `content` and leaves "Entry created", which is also
  // what the MCP tool's row would have said before it was overridden — the same
  // act reading two ways depending on who did it.
  'content.entry.created': 'Content entry created',
  'content.entry.updated': 'Content entry updated',
  'content.entry.deleted': 'Content entry deleted',
  'content.entry.published': 'Content entry published',
  'content.entry.unpublished': 'Content entry unpublished',
  'content.entry.restored': 'Content entry restored',
  'commerce.category.reparented': 'Category moved',
  'commerce.channel.order.ingested': 'Order brought in from a sales channel',
  'commerce.markup.recompute_approved': 'Markup recalculation approved',
  'commerce.markup.recompute_rejected': 'Markup recalculation rejected',
  'commerce.product_type.forked': 'Product type copied',
  'commerce.product_type.schema_replaced': 'Product type fields replaced',
  'commerce.provider.config_updated': 'Integration settings updated',
  'commerce.provider.uninstalled': 'Integration removed',
  'inventory.channel_buffer.deleted': 'Sales channel stock buffer removed',
  'inventory.classification.override_set': 'Stock grade set by hand',
  // "Short" reads as an adjective on a noun phrase — "Pick list short" looks
  // like a description of the list, not something that happened to it.
  'inventory.pick_list.short': 'Picking walk came up short',
  'inventory.reorder_policy.computed_applied': 'Worked-out reorder point applied',
  'inventory.reorder_policy.planning_set': 'Reorder planning settings saved',
  'inventory.source.freshness_updated': 'Supply figures refreshed',
  'media.asset.updated': 'File updated',
  'media.asset.deleted': 'File deleted',
  'media.collection.renamed': 'Media collection renamed',
  'team.member.module_access_changed': 'What a teammate can reach changed',
  'tenant.industry.installed': 'Line of work chosen',

  // ── 4. two actions, one sentence ───────────────────────────────────────────
  //
  // Each pair below rendered identically, so the feed said the same words about
  // two unrelated things. The rest of the duplicates are left alone on purpose:
  // `inventory.adjusted` and `commerce.inventory.adjusted` ARE the same event
  // written from two modules, and so are the hand and MCP forms of publishing a
  // site — a shared sentence is correct when the thing is shared.
  'webhook.subscription.created': 'Webhook created',
  'webhook.subscription.updated': 'Webhook updated',
  'webhook.subscription.deleted': 'Webhook deleted',
  'media.collection.created': 'Media collection created',
  'media.collection.updated': 'Media collection updated',
  'media.collection.deleted': 'Media collection deleted',
  'crm.settings.updated': 'Customer settings updated',
  'email.settings.updated': 'Email settings updated',
  // `member.*` is written by the STAFF console's operator routes and
  // `team.member.*` by the tenant's own Team screen, and the convention read
  // them identically. The actor name is null on an operator row, so the
  // sentence is the only place a tenant can be told support did this.
  'member.removed': 'Member removed by support',
  'member.role_changed': 'Member role changed by support',
  'member.suspended': 'Member suspended by support',
  'member.reactivated': 'Member reactivated by support',
  'member.password_reset': 'Member password reset by support',
  'commerce.markup.recompute_applied': 'Markup recalculation applied',
  'commerce.markup.recompute_staged': 'Markup recalculation prepared',

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
  'mcp.restore_draft_version': 'Restored an earlier version',
  'mcp.create_content_entry': 'Content entry created',
  'mcp.set_silica_frame': 'Header and footer saved',
  'mcp.set_silica_theme': 'Theme saved',
  'mcp.suggest_reorders': 'Reorder suggestions worked out',
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
