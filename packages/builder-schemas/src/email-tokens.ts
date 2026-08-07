// Email merge tokens — `{{ source.path ?? "fallback" }}` (docs/91 §2, §3).
//
// Builder emails personalize by embedding merge tokens directly in string props
// (a Heading's `text`, a Button's `label`/`href`, the subject/preheader) rather
// than only through node `binding`s. A token names a dotted path into the resolved
// email DataSources (`customer.firstName`, `invoice.balance`, `tenant.storeUrl`),
// with an optional literal fallback used when the path resolves empty.
//
// This module is the PURE token layer shared by both ends of the pipeline:
//   · the renderer (`@sparx/email`'s `renderEmailTree`) interpolates tokens against
//     a resolved scope at dispatch;
//   · the dispatch resolver (`api-rest`'s `resolveEmailData`) collects the token
//     PATHS a tree references so it loads only the sources actually used.
// Pure functions + types (no zod, no DB, no React) — client + server safe, like
// the rest of `binding.ts` / `runtime.ts`.

import { bindingSourceKey, resolvePath } from './runtime';
import type { BuilderNode } from './node';

/** The grammar: `{{ <path> [?? <fallback>] }}`. Global; constructed per use so
 *  callers never trip over a shared `lastIndex`. */
const TOKEN_SOURCE = '\\{\\{\\s*([^}]+?)\\s*\\}\\}';

export interface EmailToken {
  /** The full matched token incl. braces — `{{ customer.firstName ?? "there" }}`. */
  raw: string;
  /** The dotted source path — `customer.firstName`. */
  path: string;
  /** The literal fallback when the path resolves empty (quotes stripped); undefined
   *  when the token has no `?? …` clause. */
  fallback?: string;
}

/** Split a token body (`customer.firstName ?? "there"`) into path + fallback.
 *  Only the FIRST `??` separates them, so a fallback may itself contain `??`. */
function parseBody(body: string): { path: string; fallback?: string } {
  const idx = body.indexOf('??');
  if (idx === -1) return { path: body.trim() };
  const path = body.slice(0, idx).trim();
  let fallback = body.slice(idx + 2).trim();
  // Strip one layer of matching surrounding quotes (single or double).
  const q = fallback[0];
  if ((q === '"' || q === "'") && fallback.endsWith(q) && fallback.length >= 2) {
    fallback = fallback.slice(1, -1);
  }
  return { path, fallback };
}

/** Every merge token in a string, in source order (duplicates kept). */
export function parseEmailTokens(input: string): EmailToken[] {
  const re = new RegExp(TOKEN_SOURCE, 'g');
  const out: EmailToken[] = [];
  for (const m of input.matchAll(re)) {
    const { path, fallback } = parseBody(m[1] ?? '');
    if (path) out.push({ raw: m[0], path, fallback });
  }
  return out;
}

/** A resolved value as display text — mirrors the renderer's `asText` so a token
 *  and a binding stringify identically. Objects/arrays/booleans → '' (not bound
 *  here; they belong in a `binding`, never a `{{token}}`). */
function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

/**
 * Replace every `{{ path ?? "fb" }}` in `input` with `resolve(path)` as text,
 * falling back to the token's literal (or '' when neither resolves). `resolve`
 * is supplied by the caller — the renderer passes `p => resolvePath(scope, p)`,
 * the dispatch tick passes a resolver over the per-recipient DataSources.
 */
export function interpolateEmailTokens(input: string, resolve: (path: string) => unknown): string {
  const re = new RegExp(TOKEN_SOURCE, 'g');
  return input.replace(re, (_full, body: string) => {
    const { path, fallback } = parseBody(body);
    if (!path) return fallback ?? '';
    const text = asText(resolve(path));
    return text !== '' ? text : (fallback ?? '');
  });
}

/**
 * ONE token's body — everything between the braces — resolved the same way
 * `interpolateEmailTokens` resolves it in a send.
 *
 * WHY THIS EXISTS SEPARATELY. silicaui 0.49 added `resolveExpression` to the email
 * host: the engine owns exactly one production, a bare dotted path, and hands any
 * OTHER `{{…}}` body to the host verbatim. That closed a gap the builder had carried
 * since the beginning — `{{customer.firstName ?? "there"}}` never matched silica's own
 * token regex, so the CANVAS showed an author raw braces while the send resolved the
 * token correctly. The canvas was wrong about the one kind of token most worth using.
 *
 * The important property is that this is the SAME evaluator, not a second one. Both
 * paths go through `parseBody`, so the canvas and the inbox cannot disagree about what
 * a fallback means — which is the failure that would replace the one being fixed.
 *
 * Returns `undefined` for a body this grammar does not understand, which is silica's
 * "leave the literal alone and fire a diagnostic" signal. A body it DOES understand
 * always resolves to a string, empty included: `{{a ?? ""}}` deliberately renders
 * nothing rather than reverting to braces.
 */
export function resolveEmailExpression(
  body: string,
  resolve: (path: string) => unknown
): { value: string } | undefined {
  const { path, fallback } = parseBody(body);
  // No path means the body was only a literal (or nothing at all) — not this grammar.
  // Handing back the fallback would make `{{ }}` render as empty rather than staying
  // visible as the mistake it is.
  if (!path) return undefined;
  const text = asText(resolve(path));
  return { value: text !== '' ? text : (fallback ?? '') };
}

// ── Editor sample data (docs/93) ──────────────────────────────────────────────
//
// The Email Builder CANVAS shows authored copy with its merge tokens still raw
// (`Welcome to {{tenant.name}}`), which reads as broken. These representative
// sample values let the canvas interpolate tokens to plausible text — so the editor
// reads like a real email — without any tenant data fetch. The REAL send resolves
// the same tokens against live `DataSources` (resolveEmailData); this is preview
// gloss only, keyed to the docs/91 §3 vocabulary + the EMAIL_SOURCES fields.

// The site identity sample, carrying EVERY alias of the URL field + emitted under
// both root keys below. `name` is the SITE (property) name the real send resolves
// (Property.name — the active site, else the primary; docs/49), NEVER the tenant's
// legal/org name. `url` is the canonical token (`{{site.url}}`); `siteUrl` and
// `storeUrl` are back-compat aliases (the store→site, then site.* renames) so a
// `{{tenant.siteUrl}}` / `{{tenant.storeUrl}}` authored before the rename still
// resolves on the canvas.
const IDENTITY_SAMPLE = {
  name: 'Acme Supply Co.',
  url: '#',
  siteUrl: '#',
  storeUrl: '#',
  supportEmail: 'help@acme.example',
};

export const SAMPLE_EMAIL_DATA: Record<string, unknown> = {
  // The canonical `site` root + the historical `tenant` alias point at the SAME
  // identity, so `{{site.name}}` and a legacy `{{tenant.name}}` both resolve.
  site: IDENTITY_SAMPLE,
  tenant: IDENTITY_SAMPLE,
  customer: {
    firstName: 'Alex',
    lastName: 'Rivera',
    fullName: 'Alex Rivera',
    email: 'alex@example.com',
    company: 'Rivera & Co.',
    // Present here so the CANVAS resolves them exactly as a send does — these are the
    // two never-blank names (`deriveCustomerNames`), and a sample that omitted them
    // would show an author raw braces for a tag that works perfectly in the inbox.
    greeting: 'Alex',
    displayName: 'Alex Rivera',
  },
  recipient: { firstName: 'Alex', lastName: 'Rivera', email: 'alex@example.com' },
  order: {
    number: '1042',
    status: 'paid',
    total: '$84.00',
    subtotal: '$78.00',
    placedAt: 'Jun 12, 2026',
    reviewUrl: '#',
    statusUrl: '#',
    shippingAddress: {
      name: 'Alex Rivera',
      line1: '128 Maple Ave',
      city: 'Springfield',
      region: 'IL',
      postalCode: '62704',
      country: 'US',
      cityStateZip: 'Springfield, IL 62704',
      oneLine: 'Alex Rivera, 128 Maple Ave, Springfield, IL 62704, US',
    },
  },
  shipping: {
    status: 'shipped',
    carrier: 'UPS',
    service: 'Ground',
    trackingNumber: '1Z999AA10123456784',
    trackingUrl: '#',
    shippedAt: 'Jun 13, 2026',
  },
  appointment: {
    service: 'Oil Change',
    date: 'Jun 14, 2026',
    time: '2:30 PM',
    when: 'Jun 14, 2026 at 2:30 PM',
    duration: '60 min',
    status: 'confirmed',
    vehicle: '2021 Toyota Corolla',
    cancellationReason: '',
    manageUrl: '#',
  },
  cart: { total: '$48.00', itemCount: '2', recoveryUrl: '#' },
  quote: {
    number: 'Q-204',
    status: 'submitted',
    total: '$1,250.00',
    validUntil: 'Jun 30, 2026',
    reviewUrl: '#',
  },
  invoice: {
    number: 'INV-204',
    total: '$1,250.00',
    balance: '$1,250.00',
    dueDate: 'Jun 30, 2026',
    daysUntilDue: '5',
    overdueDays: '0',
    payUrl: '#',
  },
  b2bAccount: {
    companyName: 'Rivera & Co.',
    status: 'approved',
    paymentTerms: 'Net 30',
    creditLimit: '$10,000.00',
    portalUrl: '#',
  },
  loyalty: { pointsLabel: '$15.00', tierName: 'Account credit' },
  promotion: {
    title: 'Summer Sale',
    body: '20% off this week',
    ctaLabel: 'Shop now',
    ctaHref: '#',
  },
};

/** Interpolate an authored string's merge tokens against editor SAMPLE data
 *  (docs/93) — the canvas's "reads like a real email" gloss. `data` defaults to the
 *  generic placeholders; the canvas passes `emailSampleData(tenant)` so KNOWN
 *  tenant values (the store's real name, etc.) resolve like the actual send instead
 *  of "Acme Supply Co.". A string with no `{{token}}` is returned unchanged, so
 *  it's a safe no-op for non-email content. */
export function sampleEmailText(
  input: string,
  data: Record<string, unknown> = SAMPLE_EMAIL_DATA
): string {
  if (!input.includes('{{')) return input;
  return interpolateEmailTokens(input, (path) => resolvePath({ root: data }, path));
}

/** The editor sample data with the REAL site identity merged over the generic
 *  placeholders. `{{site.name}}` / `url` / `supportEmail` are KNOWN fixed values for
 *  the tenant, so the canvas resolves them like the send (the real site name in
 *  every heading), while customer / order / cart / … stay generic samples — those
 *  are genuinely per-recipient and unknown at authoring time. Undefined or blank
 *  fields keep the sample, so a partial override never blanks a token. The merged
 *  identity is emitted under BOTH the canonical `site` root and the `tenant` alias,
 *  and the URL is written to every alias (`url`/`siteUrl`/`storeUrl`) so a legacy
 *  token resolves to the same value. The `siteUrl` PARAM name is kept (callers pass
 *  the tenant's home URL) even though the canonical token is now `{{site.url}}`. */
export function emailSampleData(tenant?: {
  name?: string | null;
  siteUrl?: string | null;
  supportEmail?: string | null;
}): Record<string, unknown> {
  if (!tenant) return SAMPLE_EMAIL_DATA;
  const merged: Record<string, unknown> = { ...IDENTITY_SAMPLE };
  if (tenant.name?.trim()) merged.name = tenant.name.trim();
  // One URL, written to every alias so `{{site.url}}`, `{{tenant.siteUrl}}`, and the
  // older `{{tenant.storeUrl}}` all agree.
  if (tenant.siteUrl?.trim()) {
    const url = tenant.siteUrl.trim();
    merged.url = url;
    merged.siteUrl = url;
    merged.storeUrl = url;
  }
  if (tenant.supportEmail?.trim()) merged.supportEmail = tenant.supportEmail.trim();
  return { ...SAMPLE_EMAIL_DATA, site: merged, tenant: merged };
}

// ── Source collection (which DataSources a tree actually references) ───────────
//
// `resolveEmailData` resolves ONLY the sources a tree binds, so a static email
// costs nothing. A binding is visible on `node.binding.path`; a token hides inside
// a string prop. This walk surfaces BOTH, plus the bare path a `conditional_block`
// carries on `props.when`, so the resolver's source set is complete.

/** String props that may carry merge tokens (any author-facing copy or link). */
const TOKEN_PROP_KEYS = ['text', 'label', 'href', 'src', 'alt', 'subject', 'preheader'];

/** Every data PATH an email tree references — node bindings, `{{token}}` paths in
 *  string props, and a `conditional_block`'s `props.when`. `extra` carries strings
 *  outside the tree (subject / preheader) so tokens used only there still load
 *  their source. Duplicates kept; callers map through `bindingSourceKey` + dedupe. */
export function collectEmailPaths(tree: BuilderNode, extra: string[] = []): string[] {
  const out: string[] = [];
  const pushTokens = (s: unknown): void => {
    if (typeof s !== 'string' || !s.includes('{{')) return;
    for (const t of parseEmailTokens(s)) out.push(t.path);
  };
  const walk = (n: BuilderNode): void => {
    if (n.binding?.path) out.push(n.binding.path);
    if (n.type === 'conditional_block' && typeof n.props.when === 'string') {
      out.push(n.props.when);
    }
    for (const key of TOKEN_PROP_KEYS) pushTokens(n.props[key]);
    for (const c of n.children ?? []) walk(c);
  };
  walk(tree);
  for (const s of extra) pushTokens(s);
  return out;
}

/** The distinct SOURCE KEYS an email tree references (`collectEmailPaths` mapped
 *  through `bindingSourceKey`, scope-relative `item.*`/`index` dropped). This is
 *  exactly the set `resolveEmailData` must load. */
export function collectEmailSourceKeys(tree: BuilderNode, extra: string[] = []): Set<string> {
  return new Set(collectEmailPaths(tree, extra).map(bindingSourceKey).filter(Boolean));
}

/**
 * Fill the two never-blank customer names, so a greeting cannot come out as "Hi ".
 *
 * `customer.greeting` and `customer.displayName` are DERIVED, not stored: a record has a
 * first name or it doesn't, and every email that greets someone needs an answer either
 * way. Deriving them once here is what lets the shipped templates say
 * `Hi {{customer.greeting}}` instead of `Hi {{customer.firstName ?? "there"}}` — the
 * second is developer syntax in a product for business owners, and it is the one token
 * shape the builder canvas cannot render, so an author writing it correctly still sees
 * raw braces while they work.
 *
 * A caller-supplied value always wins: if a send already computed a greeting (a nickname,
 * a localized one), this leaves it alone. Only absent or blank is filled.
 *
 * Pure, and returns the SAME object when there is nothing to add, so a send with no
 * customer scope pays nothing.
 */
export function deriveCustomerNames<T extends Record<string, unknown>>(data: T): T {
  const customer = data.customer;
  if (!customer || typeof customer !== 'object' || Array.isArray(customer)) return data;

  const c = customer as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
  const greeting = str(c.greeting) || str(c.firstName) || 'there';
  const displayName = str(c.displayName) || str(c.fullName) || 'A customer';
  if (str(c.greeting) === greeting && str(c.displayName) === displayName) return data;

  return { ...data, customer: { ...c, greeting, displayName } };
}
