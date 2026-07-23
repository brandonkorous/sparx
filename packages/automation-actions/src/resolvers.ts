// Module entity resolvers + scanners (docs/81 §5.3, docs/90 ADR).
//
// The engine's built-in resolvers (`@sparx/automation/resolvers/builtins`) cover
// the crm-core entities (customer / deal / order). This module fills the seam for
// the rest of the baked-in workflow catalog — quote, billing document, B2B
// account, chat conversation, product/inventory — plus the scheduled SCANNERS the
// cart-abandonment / chat-unresponded / invoicing-dunning seeds fan out over.
// Registered through the same `registerResolver` / `registerScanner` seam the
// worker installs at boot (`installModuleActions`).
//
// Every resolver hydrates a FLAT, dotted-path field map (RLS-scoped via `ctx.tx`)
// — the same contract conditions, the entitySnapshot, and the email DataSource
// layer read. Customer-addressed entities resolve `customer.email` (directly, or
// via a B2B account's primary contact) so an `email.send_campaign` wired to them
// can address the recipient.

import {
  registerResolver,
  registerScanner,
  type ResolvedFields,
  type ScannedRow,
  type TenantCtx,
} from '@sparx/automation';

import { fieldValueToString } from './entity.js';

const MS_PER_DAY = 86_400_000;

/** Prisma Decimal | number | null → number | null. */
function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string {
  if (typeof v === 'string') return v;
  throw new Error(`expected string id on trigger payload, got ${typeof v}`);
}

// ─── customer contact (shared) ───────────────────────────────────────────────
//
// Many entities are addressed through a Customer — directly (`customerId`) or, for
// a B2B document, via the account's primary contact. Resolving it here keeps every
// entity's `customer.*` field set identical (so a template/condition reads the same
// keys no matter which entity triggered).

const CUSTOMER_CONTACT_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  company: true,
  doNotContact: true,
} as const;

interface ContactLike {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  doNotContact: boolean;
}

function contactFields(c: ContactLike | null): ResolvedFields {
  if (!c) return {};
  const fullName = [c.firstName, c.lastName].filter(Boolean).join(' ');
  return {
    'customer.id': c.id,
    'customer.email': c.email,
    'customer.firstName': c.firstName,
    'customer.lastName': c.lastName,
    'customer.fullName': fullName.length > 0 ? fullName : null,
    'customer.company': c.company,
    'customer.doNotContact': c.doNotContact,
  };
}

/** Resolve the addressable Customer for an entity: the linked customer, else the
 *  B2B account's active primary contact (any active contact as a fallback). */
async function resolveContact(
  ctx: TenantCtx,
  ref: { customerId?: string | null; b2bAccountId?: string | null }
): Promise<ResolvedFields> {
  if (ref.customerId) {
    const c = await ctx.tx.customer.findUnique({
      where: { id: ref.customerId },
      select: CUSTOMER_CONTACT_SELECT,
    });
    if (c) return contactFields(c);
  }
  if (ref.b2bAccountId) {
    const primary = await ctx.tx.b2bAccountContact.findFirst({
      where: { accountId: ref.b2bAccountId, isActive: true, role: 'primary_contact' },
      select: { customer: { select: CUSTOMER_CONTACT_SELECT } },
    });
    const contact =
      primary ??
      (await ctx.tx.b2bAccountContact.findFirst({
        where: { accountId: ref.b2bAccountId, isActive: true },
        select: { customer: { select: CUSTOMER_CONTACT_SELECT } },
      }));
    if (contact) return contactFields(contact.customer);
  }
  return {};
}

// ─── billing document (invoicing) — quotes ARE billing documents ─────────────
//
// A "quote" is a BillingDocument on the system `b2b-quotes` workflow. Since the
// engine's resolver registry is one-resolver-per-event-type (registerResolver
// overwrites, it doesn't compose), `hydrateBillingDocument` produces BOTH the
// always-present `invoice.*` fields AND, when the document belongs to the
// b2b-quotes workflow, the `quote.*` fields "Quote received"/"Quote expiring"
// templates key on — one hydrator per event, two field namespaces.

const B2B_QUOTES_WORKFLOW_SLUG = 'b2b-quotes';

const BILLING_SELECT = {
  id: true,
  number: true,
  status: true,
  dueAt: true,
  balance: true,
  total: true,
  currency: true,
  validUntil: true,
  assignedUserId: true,
  customerId: true,
  b2bAccountId: true,
  workflow: { select: { slug: true } },
  stage: { select: { stageType: true, name: true } },
} as const;

interface BillingLike {
  id: string;
  number: string | null;
  status: string;
  dueAt: Date | null;
  balance: unknown;
  total: unknown;
  currency: string;
  validUntil: Date | null;
  assignedUserId: string | null;
  customerId: string | null;
  b2bAccountId: string | null;
  workflow: { slug: string };
  stage: { stageType: string; name: string };
}

/** Field map for a billing document. `overdueDays` / `daysUntilDue` are COMPUTED
 *  from `dueAt` (not the stored `overdue_days`, which only the B2B AR escalation
 *  maintains) so the standalone-invoicing dunning seeds fire for every workflow. */
function billingFields(d: BillingLike, now: number): ResolvedFields {
  const dueMs = d.dueAt ? d.dueAt.getTime() : null;
  const daysUntilDue = dueMs !== null ? Math.floor((dueMs - now) / MS_PER_DAY) : null;
  const overdueDays = dueMs !== null && dueMs < now ? Math.floor((now - dueMs) / MS_PER_DAY) : 0;
  return {
    'invoice.id': d.id,
    'invoice.number': d.number,
    'invoice.status': d.status,
    'invoice.dueAt': d.dueAt,
    'invoice.daysUntilDue': daysUntilDue,
    'invoice.overdueDays': overdueDays,
    'invoice.balance': num(d.balance),
    'invoice.total': num(d.total),
    'invoice.currency': d.currency,
    'invoice.assignedUserId': d.assignedUserId,
    'invoice.workflowSlug': d.workflow.slug,
    'invoice.stageType': d.stage.stageType,
  };
}

/** `quote.*` fields — same document, a template-facing alias namespace.
 *  `stageName` is the tenant-renamable-but-system-seeded stage name ("Draft" /
 *  "Submitted" / "Under Review" / "Quoted" / "Accepted" / "Declined" /
 *  "Expired") — finer-grained than `stageType`, which several of these stages
 *  share, so a rule can gate on the exact lifecycle moment (e.g. "Submitted"
 *  for b2b-quote-received, not just any draft-type stage). */
function quoteFields(d: BillingLike): ResolvedFields {
  return {
    'quote.id': d.id,
    'quote.number': d.number,
    'quote.status': d.status,
    'quote.total': num(d.total),
    'quote.currency': d.currency,
    'quote.validUntil': d.validUntil,
    'quote.stageName': d.stage.name,
  };
}

async function hydrateBillingDocument(ctx: TenantCtx, docId: string): Promise<ResolvedFields> {
  const d = await ctx.tx.billingDocument.findUnique({
    where: { id: docId },
    select: BILLING_SELECT,
  });
  if (!d) return {};
  return {
    ...billingFields(d, Date.now()),
    ...(d.workflow.slug === B2B_QUOTES_WORKFLOW_SLUG ? quoteFields(d) : {}),
    ...(await resolveContact(ctx, { customerId: d.customerId, b2bAccountId: d.b2bAccountId })),
  };
}

// ─── B2B account (event) ──────────────────────────────────────────────────────

async function hydrateB2bAccount(ctx: TenantCtx, accountId: string): Promise<ResolvedFields> {
  const a = await ctx.tx.b2BAccount.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      companyName: true,
      status: true,
      paymentTerms: true,
      creditLimit: true,
      assignedRepId: true,
    },
  });
  if (!a) return {};
  return {
    'b2bAccount.id': a.id,
    'b2bAccount.companyName': a.companyName,
    'b2bAccount.status': a.status,
    'b2bAccount.paymentTerms': a.paymentTerms,
    'b2bAccount.creditLimit': num(a.creditLimit),
    'b2bAccount.assignedRepId': a.assignedRepId,
    ...(await resolveContact(ctx, { b2bAccountId: a.id })),
  };
}

// ─── chat conversation (event + scan) ─────────────────────────────────────────

const CONVERSATION_SELECT = {
  id: true,
  status: true,
  assignedToId: true,
  assignedTo: { select: { email: true } },
  visitorName: true,
  visitorEmail: true,
  customerId: true,
  customer: { select: CUSTOMER_CONTACT_SELECT },
} as const;

interface ConversationLike {
  id: string;
  status: string;
  assignedToId: string | null;
  assignedTo: { email: string | null } | null;
  visitorName: string | null;
  visitorEmail: string | null;
  customerId: string | null;
  customer: ContactLike | null;
}

/** Conversation fields + its addressable contact (a linked Customer, else the
 *  anonymous visitor's captured name/email). `assignedToEmail` lets a staff alert
 *  reach the assigned agent (else it falls back to the tenant notify address). */
function conversationFields(c: ConversationLike): ResolvedFields {
  const fields: ResolvedFields = {
    'conversation.id': c.id,
    'conversation.status': c.status,
    'conversation.assignedToId': c.assignedToId,
    'conversation.assignedToEmail': c.assignedTo?.email ?? null,
  };
  if (c.customer) {
    Object.assign(fields, contactFields(c.customer));
  } else if (c.visitorEmail || c.visitorName) {
    fields['customer.email'] = c.visitorEmail;
    fields['customer.firstName'] = c.visitorName;
    fields['customer.fullName'] = c.visitorName;
  }
  return fields;
}

// ─── product / inventory (event) ──────────────────────────────────────────────

async function hydrateInventory(
  ctx: TenantCtx,
  payload: Record<string, unknown>
): Promise<ResolvedFields> {
  const variantId = typeof payload.variantId === 'string' ? payload.variantId : null;
  if (!variantId) return {};
  const v = await ctx.tx.productVariant.findUnique({
    where: { id: variantId },
    select: { id: true, sku: true, product: { select: { id: true, title: true } } },
  });
  if (!v) return {};
  // The inventory.low / .depleted event carries the on-hand level; fall back to
  // null rather than a second query if it's absent.
  const onHand =
    typeof payload.onHand === 'number'
      ? payload.onHand
      : typeof payload.quantity === 'number'
        ? payload.quantity
        : null;
  // `warehouseId` + available/reorderPoint feed the reorder action (which warehouse
  // to draft against) and let a tenant gate the reorder rule by location/threshold.
  const warehouseId = typeof payload.warehouseId === 'string' ? payload.warehouseId : null;
  return {
    'product.id': v.product.id,
    'product.title': v.product.title,
    'variant.id': v.id,
    'variant.sku': v.sku,
    'warehouse.id': warehouseId,
    'inventory.quantity': onHand,
    'inventory.available': typeof payload.available === 'number' ? payload.available : null,
    'inventory.reorderPoint':
      typeof payload.reorderPoint === 'number' ? payload.reorderPoint : null,
  };
}

// ─── site form submission (event, docs/115) ──────────────────────────────────
//
// A public site form submission. The trigger payload carries only ids + the
// snapshot contact, and the arbitrary custom FIELDS of a multi-field form live on
// the row — so we re-read it. The notify RECIPIENTS come from the server-only
// FormDefinition (never the published tree), resolved here server-side at run time
// so the addresses never reach a visitor. The submitter is exposed as `customer.*`
// so an email/CRM action can address or capture them even though they aren't a
// Customer yet.

function splitName(full: string | null): { first: string | null; last: string | null } {
  const t = (full ?? '').trim();
  if (!t) return { first: null, last: null };
  const i = t.indexOf(' ');
  return i === -1
    ? { first: t, last: null }
    : { first: t.slice(0, i), last: t.slice(i + 1).trim() || null };
}

/** Read a boolean/string from the FormDefinition.config JSON with a default. */
function cfgBool(cfg: Record<string, unknown>, key: string, dflt: boolean): boolean {
  return typeof cfg[key] === 'boolean' ? cfg[key] : dflt;
}
function cfgStr(cfg: Record<string, unknown>, key: string, dflt: string): string {
  return typeof cfg[key] === 'string' ? cfg[key] : dflt;
}

async function hydrateFormSubmission(
  ctx: TenantCtx,
  submissionId: string
): Promise<ResolvedFields> {
  const s = await ctx.tx.formSubmission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      propertyId: true,
      formNodeId: true,
      formName: true,
      pageSlug: true,
      name: true,
      email: true,
      phone: true,
      message: true,
      status: true,
      fields: true,
      attachments: true,
      createdAt: true,
    },
  });
  if (!s) return {};
  // The server-only routing config (recipients + the notify/autoresponder/CRM
  // toggles + autoresponder copy), materialized at publish — the worker's ONLY view
  // of the form's routing, since it can't read the published tree. Plus the site
  // name for the email brand line.
  const [def, property] =
    s.propertyId != null
      ? await Promise.all([
          ctx.tx.formDefinition.findUnique({
            where: {
              propertyId_formNodeId: { propertyId: s.propertyId, formNodeId: s.formNodeId },
            },
            select: { recipients: true, config: true },
          }),
          ctx.tx.property.findUnique({ where: { id: s.propertyId }, select: { name: true } }),
        ])
      : [null, null];
  const cfg: Record<string, unknown> =
    def?.config && typeof def.config === 'object' && !Array.isArray(def.config) ? def.config : {};
  const { first, last } = splitName(s.name);
  const fields: ResolvedFields = {
    'form.submissionId': s.id,
    'form.nodeId': s.formNodeId,
    'form.formName': s.formName,
    'form.siteName': property?.name ?? null,
    'form.pageSlug': s.pageSlug,
    'form.status': s.status,
    'form.message': s.message,
    'form.submittedAt': s.createdAt.toISOString(),
    // Server-only notify addresses (empty ⇒ the notify action falls back to the
    // tenant email). Resolved server-side; never shipped to a visitor.
    'form.recipients': def?.recipients ?? [],
    // Routing toggles + autoresponder copy — the per-form policy each action gates on
    // (defaults mirror DEFAULT_CONTACT_FORM_PROPS for a form published before config).
    'form.notify': cfgBool(cfg, 'notify', true),
    'form.addToCrm': cfgBool(cfg, 'addToCrm', false),
    // Open a pipeline deal for the submitter (the quote/lead-form path) — implies
    // capturing the contact, so crm.capture_lead gates on `addToCrm || openDeal`.
    'form.openDeal': cfgBool(cfg, 'openDeal', false),
    'form.autoresponder': cfgBool(cfg, 'autoresponder', false),
    'form.autoresponderSubject': cfgStr(cfg, 'autoresponderSubject', 'We received your message'),
    'form.autoresponderMessage': cfgStr(
      cfg,
      'autoresponderMessage',
      "Thanks for reaching out — we've received your message and will get back to you shortly."
    ),
    // The submitter as an addressable contact for an email/CRM action.
    'customer.email': s.email,
    'customer.firstName': first,
    'customer.lastName': last,
    'customer.fullName': s.name,
    'customer.phone': s.phone,
  };
  // Every submitted field. `form.field.<key>` lets a condition branch on one (e.g.
  // form.field.budget contains "enterprise"); `form.fieldEntries` is the ORDERED
  // {key,value} list the notify email renders (a form's fields are whatever named
  // inputs the author composed, so this is the whole answer set). Object.entries
  // preserves the submitted order.
  const entries: { key: string; value: string }[] = [];
  if (s.fields && typeof s.fields === 'object' && !Array.isArray(s.fields)) {
    for (const [k, v] of Object.entries(s.fields as Record<string, unknown>)) {
      fields[`form.field.${k}`] = v;
      entries.push({ key: k, value: fieldValueToString(v) });
    }
  }
  fields['form.fieldEntries'] = entries;
  // Attachment filenames (docs/115 Part D) — the notify email lists them so the
  // owner knows a file came in (they download it from the dashboard inbox; the
  // bytes are private, never a link in an email). Names only, never the key.
  fields['form.attachmentNames'] = attachmentNames(s.attachments);
  return fields;
}

/** Extract attachment filenames from the stored JSON array (tolerant of empty). */
function attachmentNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as { filename?: unknown }).filename === 'string'
    ) {
      out.push((item as { filename: string }).filename);
    }
  }
  return out;
}

// ─── announceable entities: product + content (event) ────────────────────────
//
// A "published product" / "published article" trigger drafts a social post
// (social.post action). Both resolvers fill a shared `announce.*` namespace —
// title, summary, absolute URL, hero image, source type/ref — so the social.post
// executor is entity-agnostic (docs/133 §9). They ALSO fill entity-specific
// `product.*` / `content.*` fields so a rule can still condition on them.

/** The site's canonical public base URL: its canonical/active domain, else the
 *  `<slug>.sparx.zone` subdomain. Resolves against the given site, or the tenant's
 *  primary site when the entity isn't pinned to one. Best-effort — null if the
 *  tenant somehow has no site (the drafted post then carries no link, and the
 *  human reviewer adds one). Reads the non-RLS `domains` dispatch table + the
 *  tenant-scoped `properties`, both through ctx.tx. */
async function resolvePropertyBaseUrl(
  ctx: TenantCtx,
  propertyId: string | null
): Promise<string | null> {
  const property = propertyId
    ? await ctx.tx.property.findUnique({
        where: { id: propertyId },
        select: { id: true, slug: true },
      })
    : await ctx.tx.property.findFirst({
        where: { isPrimary: true },
        select: { id: true, slug: true },
      });
  if (!property) return null;
  const domain = await ctx.tx.domain.findFirst({
    where: { propertyId: property.id, status: { in: ['active', 'verified'] } },
    // Canonical host first; a real custom/purchased domain before the subdomain
    // ('custom' < 'purchased' < 'subdomain' alphabetically).
    orderBy: [{ isCanonical: 'desc' }, { type: 'asc' }],
    select: { host: true },
  });
  const host = domain?.host ?? `${property.slug}.sparx.zone`;
  return `https://${host}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** First non-empty string among the candidates, else null. */
function firstString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** First candidate that looks like a media-asset uuid, else null (so a URL string
 *  or rich media object in a content body never lands in mediaAssetIds). */
function firstUuid(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === 'string' && UUID_RE.test(v)) return v;
  }
  return null;
}

/** Strip HTML tags + collapse whitespace, then truncate for a post summary. Tags
 *  become a space (so block boundaries don't fuse words), then any space left
 *  sitting before punctuation is closed up (`packable</b>,` → `packable,`). */
function summarize(html: string, max = 200): string {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export interface ProductAnnounceRow {
  id: string;
  title: string;
  handle: string;
  status: string;
  description: string | null;
}

/** Pure `announce.*` + `product.*` field map for a published product. */
export function productAnnounceFields(
  p: ProductAnnounceRow,
  url: string | null,
  imageAssetId: string | null,
  propertyId: string | null
): ResolvedFields {
  const summary = summarize(p.description ?? '');
  return {
    'product.id': p.id,
    'product.title': p.title,
    'product.handle': p.handle,
    'product.status': p.status,
    'product.url': url,
    'announce.title': p.title,
    'announce.summary': summary,
    'announce.url': url,
    'announce.imageAssetId': imageAssetId,
    'announce.sourceType': 'product',
    'announce.sourceRef': p.id,
    'announce.propertyId': propertyId,
  };
}

async function hydrateProduct(ctx: TenantCtx, productId: string): Promise<ResolvedFields> {
  const p = await ctx.tx.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      title: true,
      handle: true,
      status: true,
      description: true,
      ogImageId: true,
      images: {
        where: { variantId: null },
        orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }],
        take: 1,
        select: { mediaAssetId: true },
      },
      propertyLinks: { select: { propertyId: true } },
    },
  });
  if (!p) return {};
  // Pin the post to a single site only when the product is scoped to exactly one
  // (no links = visible on all sites → the tenant's primary site).
  const propertyId = p.propertyLinks.length === 1 ? p.propertyLinks[0]!.propertyId : null;
  const base = await resolvePropertyBaseUrl(ctx, propertyId);
  const url = base ? `${base}/products/${encodeURIComponent(p.handle)}` : null;
  const imageAssetId = p.ogImageId ?? p.images[0]?.mediaAssetId ?? null;
  return productAnnounceFields(p, url, imageAssetId, propertyId);
}

export interface ContentAnnounceRow {
  id: string;
  slug: string | null;
  typeKey: string;
  status: string;
  body: unknown;
  seoJson: unknown;
}

/** Build the article's public URL from its content type's `urlPattern`
 *  (e.g. `/blog/:slug`). Falls back to `<base>/<slug>` when the pattern is
 *  slug-less, and null when there's no base or slug. Pure. */
export function buildContentUrl(
  baseUrl: string | null,
  urlPattern: string | null,
  slug: string | null
): string | null {
  if (!baseUrl || !slug) return null;
  const encoded = encodeURIComponent(slug);
  let path: string;
  if (urlPattern?.includes(':slug')) {
    path = urlPattern.replace(':slug', encoded);
  } else if (urlPattern) {
    path = `${urlPattern.replace(/\/$/, '')}/${encoded}`;
  } else {
    path = `/${encoded}`;
  }
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Pure `announce.*` + `content.*` field map for a published content entry. Title
 *  + summary + hero image are read defensively from the entry body / SEO bag,
 *  since a content type's field keys are author-defined (title is the near-universal
 *  convention — entries-service slugs off body.title). */
export function contentAnnounceFields(
  e: ContentAnnounceRow,
  urlPattern: string | null,
  baseUrl: string | null,
  propertyId: string | null
): ResolvedFields {
  const body = asRecord(e.body);
  const seo = asRecord(e.seoJson);
  const title = firstString(body.title, seo.title, e.slug) ?? 'New update';
  const summary = summarize(
    firstString(seo.description, seo.metaDescription, body.excerpt, body.summary) ?? ''
  );
  const url = buildContentUrl(baseUrl, urlPattern, e.slug);
  const imageAssetId = firstUuid(seo.ogImageId, body.image, body.coverImage, body.heroImage);
  return {
    'content.id': e.id,
    'content.title': title,
    'content.slug': e.slug,
    'content.typeKey': e.typeKey,
    'content.url': url,
    'announce.title': title,
    'announce.summary': summary,
    'announce.url': url,
    'announce.imageAssetId': imageAssetId,
    'announce.sourceType': 'content',
    'announce.sourceRef': e.id,
    'announce.propertyId': propertyId,
  };
}

async function hydrateContentEntry(ctx: TenantCtx, entryId: string): Promise<ResolvedFields> {
  const e = await ctx.tx.contentEntry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      slug: true,
      typeKey: true,
      status: true,
      body: true,
      seoJson: true,
      propertyLinks: { select: { propertyId: true } },
    },
  });
  if (!e) return {};
  const type = await ctx.tx.contentType.findFirst({
    where: { key: e.typeKey },
    select: { urlPattern: true },
  });
  const propertyId = e.propertyLinks.length === 1 ? e.propertyLinks[0]!.propertyId : null;
  const base = await resolvePropertyBaseUrl(ctx, propertyId);
  return contentAnnounceFields(e, type?.urlPattern ?? null, base, propertyId);
}

// ─── registration ─────────────────────────────────────────────────────────────

// Billing-document events (CRM publishes `crm.billing_document.*`). Quotes are
// BillingDocuments, so `hydrateBillingDocument` also produces `quote.*` fields
// for documents on the b2b-quotes workflow (see above) — there is no separate
// quote event list, the resolver registry is one-resolver-per-event-type.
const BILLING_EVENTS = [
  'crm.billing_document.created',
  'crm.billing_document.stage_changed',
  'crm.billing_document.finalized',
  'crm.billing_document.paid',
  'crm.billing_document.voided',
  'crm.billing_document.converted',
];

// B2B account events. A gated apply→approve flow + its `b2b.account.approved`
// event is not built (docs/90) — in the self-serve model account creation IS the
// "approved" moment, so the `b2b-account-approved` welcome email triggers here.
const B2B_ACCOUNT_EVENTS = ['crm.b2b_account.created'];

const INVENTORY_EVENTS = ['inventory.low', 'inventory.depleted'];

// Site form submissions (docs/115). The public submit endpoint dual-publishes
// `form.submitted`; a `form.submitted`-triggered automation is how a tenant routes
// a submission (notify / add to CRM / open a deal) beyond the always-on inbox.
const FORM_EVENTS = ['form.submitted'];

let installed = false;

/** Register the module entity resolvers + scheduled scanners exactly once. */
export function installEntityResolvers(): void {
  if (installed) return;
  installed = true;

  for (const ev of BILLING_EVENTS) {
    registerResolver(ev, (ctx, p) =>
      hydrateBillingDocument(ctx, str(p.documentId ?? p.billingDocumentId ?? p.quoteId ?? p.id))
    );
  }
  for (const ev of B2B_ACCOUNT_EVENTS) {
    registerResolver(ev, (ctx, p) => hydrateB2bAccount(ctx, str(p.accountId ?? p.id)));
  }
  for (const ev of INVENTORY_EVENTS) {
    registerResolver(ev, (ctx, p) => hydrateInventory(ctx, p));
  }
  for (const ev of FORM_EVENTS) {
    registerResolver(ev, (ctx, p) => hydrateFormSubmission(ctx, str(p.submissionId ?? p.id)));
  }

  // Announceable entities (docs/133 §9) — feed the social.post action's `announce.*`
  // namespace. A product going live / an article publishing → draft a social post.
  registerResolver('product.published', (ctx, p) => hydrateProduct(ctx, str(p.productId ?? p.id)));
  registerResolver('content.entry.published', (ctx, p) =>
    hydrateContentEntry(ctx, str(p.entryId ?? p.id))
  );

  // ── scheduled scanners ──────────────────────────────────────────────────────

  // Cart abandonment (interval scan). A cart is "cold" once it has gone untouched
  // for >30 min while still holding items. `recoveredAt: null` EXCLUDES purchased
  // carts (checkout stamps recoveredAt on order placement — checkout-service.ts),
  // so a buyer never gets an abandoned-cart email. Only carts with an emailable
  // customer are returned (a guest cart has no address). The 7-day floor bounds the
  // candidate set; the interval cadence's once-per-entity dedupe fires a single run.
  registerScanner('cart', async (ctx: TenantCtx): Promise<ScannedRow[]> => {
    const now = Date.now();
    const coldBefore = new Date(now - 30 * 60_000);
    const floor = new Date(now - 7 * MS_PER_DAY);
    const rows = await ctx.tx.cart.findMany({
      where: {
        recoveredAt: null,
        updatedAt: { lt: coldBefore, gt: floor },
        items: { some: {} },
        customer: { is: { email: { not: null } } },
      },
      select: {
        id: true,
        totalCents: true,
        currency: true,
        customer: { select: CUSTOMER_CONTACT_SELECT },
      },
      take: 5_000,
    });
    return rows.map((c) => ({
      id: c.id,
      fields: {
        'cart.id': c.id,
        'cart.totalCents': c.totalCents,
        'cart.currency': c.currency,
        ...contactFields(c.customer),
      },
    }));
  });

  // Chat conversation scan (interval). Serves two seeds, partitioned by the
  // predicate's `conversation.status`:
  //   • open + no STAFF reply yet → staff "unresponded" alert (the predicate adds
  //     a `conversation.minutesSinceCreated >= N` threshold so a brand-new chat
  //     isn't flagged).
  //   • recently resolved → customer satisfaction survey.
  // The 7-day floor bounds the candidate set; the interval cadence's
  // once-per-entity dedupe fires each seed a single time per conversation.
  registerScanner('conversation', async (ctx: TenantCtx): Promise<ScannedRow[]> => {
    const now = Date.now();
    const floor = new Date(now - 7 * MS_PER_DAY);
    const rows = await ctx.tx.chatConversation.findMany({
      where: {
        OR: [
          {
            status: 'open',
            createdAt: { gt: floor },
            messages: { none: { senderType: 'staff' } },
          },
          { status: 'resolved', resolvedAt: { gt: floor } },
        ],
      },
      select: { ...CONVERSATION_SELECT, createdAt: true },
      take: 5_000,
    });
    return rows.map((c) => ({
      id: c.id,
      fields: {
        ...conversationFields(c as ConversationLike),
        'conversation.minutesSinceCreated': Math.floor((now - c.createdAt.getTime()) / 60_000),
      },
    }));
  });

  // Quote expiry (interval scan). Awaiting-decision quotes — BillingDocuments on
  // the b2b-quotes workflow in a `draft`-type stage (Draft/Submitted/Under
  // Review/Quoted) — whose `validUntil` falls within the next 48h. The interval
  // cadence's once-per-entity dedupe fires a single reminder as a quote enters
  // the window; a quote that's accepted/declined/expired leaves the
  // `draft`-type set and stops matching.
  registerScanner('quote', async (ctx: TenantCtx): Promise<ScannedRow[]> => {
    const now = Date.now();
    const horizon = new Date(now + 48 * 3_600_000);
    const rows = await ctx.tx.billingDocument.findMany({
      where: {
        deletedAt: null,
        workflow: { slug: B2B_QUOTES_WORKFLOW_SLUG },
        stage: { stageType: 'draft' },
        validUntil: { not: null, gt: new Date(now), lte: horizon },
      },
      select: {
        id: true,
        number: true,
        status: true,
        total: true,
        currency: true,
        validUntil: true,
        customerId: true,
        b2bAccountId: true,
      },
      take: 5_000,
    });
    return Promise.all(
      rows.map(async (q) => ({
        id: q.id,
        fields: {
          'quote.id': q.id,
          'quote.number': q.number,
          'quote.status': q.status,
          'quote.total': num(q.total),
          'quote.currency': q.currency,
          'quote.validUntil': q.validUntil,
          ...(await resolveContact(ctx, {
            customerId: q.customerId,
            b2bAccountId: q.b2bAccountId,
          })),
        },
      }))
    );
  });

  // Billing-document due/overdue (daily scan). Every open net-terms document with a
  // due date; the seed predicates select the exact window (`daysUntilDue == 3`,
  // `overdueDays == 7/14/30`) and partition user invoices vs B2B AR by `workflowSlug`.
  registerScanner('billing_document', async (ctx: TenantCtx): Promise<ScannedRow[]> => {
    const now = Date.now();
    const docs = await ctx.tx.billingDocument.findMany({
      where: {
        deletedAt: null,
        status: { in: ['unpaid', 'partial', 'overdue'] },
        dueAt: { not: null },
      },
      select: BILLING_SELECT,
      take: 5_000,
    });
    return Promise.all(
      docs.map(async (d) => ({
        id: d.id,
        fields: {
          ...billingFields(d as BillingLike, now),
          ...(await resolveContact(ctx, {
            customerId: d.customerId,
            b2bAccountId: d.b2bAccountId,
          })),
        },
      }))
    );
  });
}
