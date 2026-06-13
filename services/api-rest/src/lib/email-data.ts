// Email DataSources resolver (docs/52 §7, docs/91 §3). Reads tenant data
// (commerce + CRM + invoicing + CMS) and produces the nested `DataSources` map the
// Builder email renderer (`renderEmailTree`) resolves bindings + `{{token}}` merge
// fields against, keyed to the docs/91 §3 vocabulary.
//
// Lives in api-rest — the composition root that already has @sparx/commerce — so
// @sparx/email-platform (imported by the lean email-worker) stays commerce-free.
// Injected into the broadcast send path + the dispatch tick as the
// `resolveEmailData` callback (docs/52 §6).
//
// Two tiers of source, both selected by what the tree actually references
// (`collectEmailSourceKeys` over bindings AND `{{token}}` paths, so a static email
// costs nothing):
//   · entity-scoped — customer / order / cart / quote / invoice / b2bAccount:
//     resolved from the send's `entityRefs` (the specific entity an automation
//     fired on), falling back to the recipient's most-recent for a broadcast.
//   · per-send      — tenant / commerce.product / promotion / cms.<type>: resolved
//     once.
// Every `*Url` token (storeUrl / recoveryUrl / reviewUrl / payUrl / portalUrl)
// resolves to a real storefront route so the CTAs work (docs/91 §1).

import { withTenant } from '@sparx/db';
import { discountService, productService } from '@sparx/commerce';
import { collectEmailSourceKeys, type BuilderNode, type DataSources } from '@sparx/builder-schemas';
import type { ServiceContext } from '@sparx/email-platform';

/** The entity ids a send resolves against (docs/91 §3) — the automation's
 *  `entityRefs`, or just `{ customerId }` for a customer-addressed broadcast.
 *  `email` is the literal recipient (always present). */
export interface EmailRecipientRef {
  email: string;
  customerId?: string | null;
  orderId?: string | null;
  cartId?: string | null;
  quoteId?: string | null;
  billingDocumentId?: string | null;
  b2bAccountId?: string | null;
}

// Public api-rest origin for media URLs (GET /v1/public/media/:id) — REST-specific
// (GraphQL doesn't serve bytes); see brand-service.ts. Falls back to the internal
// REST url only for local/dev.
const API_BASE =
  process.env.SPARX_PUBLIC_API_REST_URL ??
  process.env.SPARX_API_REST_URL ??
  'http://localhost:3100';
// Storefront base for clickable links. `{slug}` is substituted per tenant; unset
// → path-only links (still valid, refined once tenant domain resolution is wired).
const STOREFRONT_BASE = process.env.SPARX_STOREFRONT_BASE ?? '';

function mediaUrl(mediaId: string | null | undefined, slug: string): string {
  if (!mediaId) return '';
  return `${API_BASE}/v1/public/media/${encodeURIComponent(mediaId)}?tenant=${encodeURIComponent(slug)}`;
}

function storefrontUrl(slug: string, path: string): string {
  if (!STOREFRONT_BASE) return path;
  return `${STOREFRONT_BASE.replace('{slug}', slug)}${path}`;
}

/** The store root as an absolute-or-`/` URL — `storefrontUrl(slug, '')` is `''`
 *  when the base is unset, so fall back to `/` for a still-valid link. */
function homeUrl(slug: string): string {
  const url = storefrontUrl(slug, '');
  return url === '' ? '/' : url;
}

/** Decimal-dollar money (orders / quotes / invoices) → `$1,234.50`. */
function money(amount: unknown): string {
  if (amount == null) return '';
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Cents money (carts) → `$12.50`. */
function moneyCents(cents: number | null | undefined): string {
  if (cents == null) return '';
  return money(cents / 100);
}

/** Decimal | Int quantity → a clean string (drops a trailing `.000`). */
function qty(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return Number.isInteger(n) ? String(n) : String(n);
}

/** First non-empty string of the candidates (`''` if none) — a line-item's `name`
 *  falls back to its `description`. */
function firstText(...vals: (string | null | undefined)[]): string {
  for (const v of vals) if (v) return v;
  return '';
}

function dateLabel(d: Date | null | undefined): string {
  return d
    ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
}

const MS_PER_DAY = 86_400_000;

async function tenantRow(
  ctx: ServiceContext
): Promise<{ slug: string; name: string; email: string }> {
  const row = await withTenant(ctx, (tx) =>
    tx.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { slug: true, name: true, email: true },
    })
  );
  return { slug: row?.slug ?? '', name: row?.name ?? '', email: row?.email ?? '' };
}

const CUSTOMER_SELECT = {
  firstName: true,
  lastName: true,
  email: true,
  company: true,
} as const;

interface CustomerRow {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  company: string | null;
}

function customerFields(c: CustomerRow | null, fallbackEmail: string): Record<string, string> {
  const fullName = [c?.firstName, c?.lastName].filter(Boolean).join(' ');
  return {
    firstName: c?.firstName ?? '',
    lastName: c?.lastName ?? '',
    fullName,
    email: c?.email ?? fallbackEmail,
    company: c?.company ?? '',
  };
}

/** The B2B account's addressable Customer — active primary contact, else any
 *  active contact (mirrors the automation resolver's `resolveContact`). */
async function b2bPrimaryCustomer(
  ctx: ServiceContext,
  b2bAccountId: string
): Promise<CustomerRow | null> {
  const primary = await withTenant(ctx, (tx) =>
    tx.b2bAccountContact.findFirst({
      where: { accountId: b2bAccountId, isActive: true, role: 'primary_contact' },
      select: { customer: { select: CUSTOMER_SELECT } },
    })
  );
  if (primary?.customer) return primary.customer;
  const any = await withTenant(ctx, (tx) =>
    tx.b2bAccountContact.findFirst({
      where: { accountId: b2bAccountId, isActive: true },
      select: { customer: { select: CUSTOMER_SELECT } },
    })
  );
  return any?.customer ?? null;
}

// ── customer ──────────────────────────────────────────────────────────────────

async function resolveCustomer(
  ctx: ServiceContext,
  ref: EmailRecipientRef | undefined
): Promise<Record<string, string>> {
  const fallbackEmail = ref?.email ?? '';
  if (ref?.customerId) {
    const c = await withTenant(ctx, (tx) =>
      tx.customer.findUnique({ where: { id: ref.customerId! }, select: CUSTOMER_SELECT })
    );
    if (c) return customerFields(c, fallbackEmail);
  }
  if (ref?.b2bAccountId) {
    const c = await b2bPrimaryCustomer(ctx, ref.b2bAccountId);
    if (c) return customerFields(c, fallbackEmail);
  }
  return customerFields(null, fallbackEmail);
}

// ── tenant ──────────────────────────────────────────────────────────────────

async function resolveTenant(
  ctx: ServiceContext,
  tenant: { slug: string; name: string; email: string }
): Promise<Record<string, string>> {
  const settings = await withTenant(ctx, (tx) =>
    tx.emailSettings.findUnique({ where: { tenantId: ctx.tenantId }, select: { replyTo: true } })
  );
  return {
    name: tenant.name,
    storeUrl: homeUrl(tenant.slug),
    supportEmail: settings?.replyTo ?? tenant.email,
  };
}

// ── order ──────────────────────────────────────────────────────────────────

async function resolveOrder(
  ctx: ServiceContext,
  ref: EmailRecipientRef | undefined,
  slug: string
): Promise<Record<string, unknown>> {
  const where = ref?.orderId
    ? { id: ref.orderId }
    : ref?.customerId
      ? { customerId: ref.customerId }
      : null;
  if (!where) return {};
  const order = await withTenant(ctx, (tx) =>
    tx.order.findFirst({
      where,
      orderBy: { placedAt: 'desc' },
      select: {
        orderNumber: true,
        status: true,
        total: true,
        subtotal: true,
        placedAt: true,
        items: {
          orderBy: { createdAt: 'asc' },
          select: {
            name: true,
            description: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
            product: { select: { handle: true } },
          },
        },
      },
    })
  );
  if (!order) return {};
  // reviewUrl → the first purchased product's PDP (where the review UI lives),
  // falling back to the store root when no item resolves a product (docs/91 §3).
  const firstHandle = order.items.find((i) => i.product?.handle)?.product?.handle ?? '';
  const reviewUrl = firstHandle ? storefrontUrl(slug, `/products/${firstHandle}`) : homeUrl(slug);
  return {
    number: order.orderNumber,
    status: order.status,
    total: money(order.total),
    subtotal: money(order.subtotal),
    placedAt: dateLabel(order.placedAt),
    reviewUrl,
    items: order.items.map((i) => ({
      name: firstText(i.name, i.description),
      quantity: qty(i.quantity),
      unitPrice: money(i.unitPrice),
      lineTotal: money(i.lineTotal),
    })),
  };
}

// ── cart ──────────────────────────────────────────────────────────────────

async function resolveCart(
  ctx: ServiceContext,
  ref: EmailRecipientRef | undefined,
  slug: string
): Promise<Record<string, unknown>> {
  const where = ref?.cartId
    ? { id: ref.cartId }
    : ref?.customerId
      ? { customerId: ref.customerId, recoveredAt: null }
      : null;
  if (!where) return {};
  const cart = await withTenant(ctx, (tx) =>
    tx.cart.findFirst({
      where,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        totalCents: true,
        items: {
          orderBy: { createdAt: 'asc' },
          select: {
            quantity: true,
            unitPriceCents: true,
            subtotalCents: true,
            variant: {
              select: {
                product: {
                  select: {
                    title: true,
                    images: {
                      where: { variantId: null },
                      orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }],
                      take: 1,
                      select: { mediaAssetId: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })
  );
  if (!cart) return {};
  return {
    total: moneyCents(cart.totalCents),
    itemCount: String(cart.items.reduce((n, it) => n + it.quantity, 0)),
    recoveryUrl: storefrontUrl(slug, '/cart'),
    items: cart.items.map((it) => ({
      name: it.variant.product.title,
      quantity: qty(it.quantity),
      unitPrice: moneyCents(it.unitPriceCents),
      lineTotal: moneyCents(it.subtotalCents),
      imageUrl: mediaUrl(it.variant.product.images[0]?.mediaAssetId, slug),
    })),
  };
}

// ── quote ──────────────────────────────────────────────────────────────────

async function resolveQuote(
  ctx: ServiceContext,
  ref: EmailRecipientRef | undefined,
  slug: string
): Promise<Record<string, unknown>> {
  if (!ref?.quoteId) return {};
  const quote = await withTenant(ctx, (tx) =>
    tx.quote.findUnique({
      where: { id: ref.quoteId! },
      select: {
        quoteNumber: true,
        status: true,
        total: true,
        validUntil: true,
        b2bAccountId: true,
        items: {
          orderBy: { createdAt: 'asc' },
          select: {
            name: true,
            description: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
          },
        },
      },
    })
  );
  if (!quote) return {};
  return {
    number: quote.quoteNumber,
    status: quote.status,
    total: money(quote.total),
    validUntil: dateLabel(quote.validUntil),
    reviewUrl: quote.b2bAccountId
      ? storefrontUrl(slug, `/account/b2b/${quote.b2bAccountId}/quotes`)
      : storefrontUrl(slug, '/account'),
    items: quote.items.map((i) => ({
      name: firstText(i.name, i.description),
      quantity: qty(i.quantity),
      unitPrice: money(i.unitPrice),
      lineTotal: money(i.lineTotal),
    })),
  };
}

// ── invoice (billing document) ──────────────────────────────────────────────

async function resolveInvoice(
  ctx: ServiceContext,
  ref: EmailRecipientRef | undefined,
  slug: string
): Promise<Record<string, unknown>> {
  if (!ref?.billingDocumentId) return {};
  const doc = await withTenant(ctx, (tx) =>
    tx.billingDocument.findUnique({
      where: { id: ref.billingDocumentId! },
      select: {
        number: true,
        total: true,
        balance: true,
        dueAt: true,
        b2bAccountId: true,
        lines: {
          orderBy: { sortOrder: 'asc' },
          select: { description: true, quantity: true, unitPrice: true, lineTotal: true },
        },
      },
    })
  );
  if (!doc) return {};
  const now = Date.now();
  const dueMs = doc.dueAt ? doc.dueAt.getTime() : null;
  const daysUntilDue = dueMs !== null ? Math.floor((dueMs - now) / MS_PER_DAY) : '';
  const overdueDays = dueMs !== null && dueMs < now ? Math.floor((now - dueMs) / MS_PER_DAY) : 0;
  return {
    number: doc.number ?? '',
    total: money(doc.total),
    balance: money(doc.balance),
    dueDate: dateLabel(doc.dueAt),
    daysUntilDue: String(daysUntilDue),
    overdueDays: String(overdueDays),
    payUrl: doc.b2bAccountId
      ? storefrontUrl(slug, `/account/b2b/${doc.b2bAccountId}/invoices`)
      : storefrontUrl(slug, '/account'),
    items: doc.lines.map((l) => ({
      description: l.description,
      quantity: qty(l.quantity),
      unitPrice: money(l.unitPrice),
      lineTotal: money(l.lineTotal),
    })),
  };
}

// ── b2bAccount ──────────────────────────────────────────────────────────────

async function resolveB2bAccount(
  ctx: ServiceContext,
  ref: EmailRecipientRef | undefined,
  slug: string
): Promise<Record<string, string>> {
  if (!ref?.b2bAccountId) return {};
  const account = await withTenant(ctx, (tx) =>
    tx.b2BAccount.findUnique({
      where: { id: ref.b2bAccountId! },
      select: { companyName: true, status: true, paymentTerms: true, creditLimit: true },
    })
  );
  if (!account) return {};
  return {
    companyName: account.companyName,
    status: account.status,
    paymentTerms: account.paymentTerms ?? '',
    creditLimit: account.creditLimit != null ? money(account.creditLimit) : '',
    portalUrl: storefrontUrl(slug, `/account/b2b/${ref.b2bAccountId}`),
  };
}

// ── per-recipient legacy alias + loyalty (kept) ───────────────────────────────

async function resolveRecipient(
  ctx: ServiceContext,
  ref: EmailRecipientRef | undefined
): Promise<Record<string, string>> {
  // `recipient` is the historical alias of `customer` (firstName/lastName/email).
  const c = await resolveCustomer(ctx, ref);
  return { firstName: c.firstName ?? '', lastName: c.lastName ?? '', email: c.email ?? '' };
}

async function resolveLoyalty(
  ctx: ServiceContext,
  ref: EmailRecipientRef | undefined
): Promise<Record<string, string>> {
  // No points model exists — surface the store-credit balance (mirrors the
  // section loyalty resolver; revisit if a points engine lands).
  const empty = { pointsLabel: '', tierName: '' };
  if (!ref?.customerId) return empty;
  const bal = await discountService.getStoreCreditBalance(ctx, ref.customerId);
  if (!bal || bal.balanceCents <= 0) return empty;
  return { pointsLabel: moneyCents(bal.balanceCents), tierName: 'Store credit available' };
}

// ── per-send sources (kept) ─────────────────────────────────────────────────

async function resolveProducts(
  ctx: ServiceContext,
  slug: string
): Promise<Record<string, string>[]> {
  const { items } = await productService.list(ctx, {
    status: 'active',
    take: 6,
    sortBy: 'createdAt',
  });
  return items.map((p) => ({
    title: p.title,
    priceLabel: moneyCents(p.priceMinCents),
    imageUrl: p.imageUrl ?? '',
    url: storefrontUrl(slug, `/products/${p.handle}`),
  }));
}

async function resolvePromotion(ctx: ServiceContext): Promise<Record<string, string>> {
  const now = Date.now();
  const active = (await discountService.listDiscounts(ctx, { status: 'active' })).find((d) => {
    const startOk = !d.startAt || new Date(d.startAt).getTime() <= now;
    const endOk = !d.endAt || new Date(d.endAt).getTime() >= now;
    return startOk && endOk;
  });
  if (!active) return { title: '', body: '', ctaLabel: '', ctaHref: '' };
  return {
    title: active.name ?? '',
    body: active.description ?? '',
    ctaLabel: '',
    ctaHref: '',
  };
}

async function resolveCmsCollection(
  ctx: ServiceContext,
  slug: string,
  typeKey: string
): Promise<Record<string, unknown>[]> {
  const rows = await withTenant(ctx, (tx) =>
    tx.contentEntry.findMany({
      where: { typeKey, status: 'published', deletedAt: null },
      orderBy: { publishedAt: 'desc' },
      take: 6,
      select: { slug: true, body: true, publishedAt: true },
    })
  );
  return rows.map((r) => {
    const body = (r.body ?? {}) as Record<string, unknown>;
    const featured = typeof body.featuredImage === 'string' ? body.featuredImage : undefined;
    return {
      ...body,
      slug: r.slug ?? '',
      url: storefrontUrl(slug, `/${typeKey === 'blog_post' ? 'blog' : typeKey}/${r.slug ?? ''}`),
      imageUrl: featured ? mediaUrl(featured, slug) : '',
      dateLabel: dateLabel(r.publishedAt),
    };
  });
}

// ── Entry point ─────────────────────────────────────────────────────────────

/** Resolve only the sources an email tree references — both node bindings and
 *  `{{token}}` merge paths (`collectEmailSourceKeys`), plus any source named only
 *  in `extraStrings` (the subject / preheader) — into the nested `DataSources` the
 *  renderer reads. `ref` carries the send's entity ids for the entity-scoped
 *  sources; absent → per-recipient sources resolve empty (render-once / preview). */
export async function resolveEmailData(
  ctx: ServiceContext,
  tree: BuilderNode,
  ref?: EmailRecipientRef,
  extraStrings: string[] = []
): Promise<DataSources> {
  const keys = collectEmailSourceKeys(tree, extraStrings);
  if (keys.size === 0) return {};

  // Any URL-bearing or per-tenant source needs the slug + tenant identity.
  const tenant = await tenantRow(ctx);
  const slug = tenant.slug;

  const out: DataSources = {};
  const tasks: Promise<void>[] = [];

  if (keys.has('customer')) {
    tasks.push(resolveCustomer(ctx, ref).then((v) => void (out.customer = v)));
  }
  if (keys.has('recipient')) {
    tasks.push(resolveRecipient(ctx, ref).then((v) => void (out.recipient = v)));
  }
  if (keys.has('tenant')) {
    tasks.push(resolveTenant(ctx, tenant).then((v) => void (out.tenant = v)));
  }
  if (keys.has('order')) {
    tasks.push(resolveOrder(ctx, ref, slug).then((v) => void (out.order = v)));
  }
  if (keys.has('cart')) {
    tasks.push(resolveCart(ctx, ref, slug).then((v) => void (out.cart = v)));
  }
  if (keys.has('quote')) {
    tasks.push(resolveQuote(ctx, ref, slug).then((v) => void (out.quote = v)));
  }
  if (keys.has('invoice')) {
    tasks.push(resolveInvoice(ctx, ref, slug).then((v) => void (out.invoice = v)));
  }
  if (keys.has('b2bAccount')) {
    tasks.push(resolveB2bAccount(ctx, ref, slug).then((v) => void (out.b2bAccount = v)));
  }
  if (keys.has('loyalty')) {
    tasks.push(resolveLoyalty(ctx, ref).then((v) => void (out.loyalty = v)));
  }
  if (keys.has('commerce.product')) {
    tasks.push(
      resolveProducts(ctx, slug).then((v) => {
        const commerce = (out.commerce as Record<string, unknown>) ?? {};
        commerce.product = v;
        out.commerce = commerce;
      })
    );
  }
  if (keys.has('promotion')) {
    tasks.push(resolvePromotion(ctx).then((v) => void (out.promotion = v)));
  }
  for (const key of keys) {
    if (!key.startsWith('cms.')) continue;
    const typeKey = key.slice('cms.'.length);
    tasks.push(
      resolveCmsCollection(ctx, slug, typeKey).then((v) => {
        const cms = (out.cms as Record<string, unknown>) ?? {};
        cms[typeKey] = v;
        out.cms = cms;
      })
    );
  }

  await Promise.all(tasks);
  return out;
}

/** Overlay an automation's flat trigger-time snapshot (`{ "invoice.number": … }`)
 *  as a FALLBACK onto the live-resolved nested data: a scalar token whose live
 *  value is missing/empty falls back to the value captured when the automation
 *  fired (immunity to an entity deleted/changed during a `wait` step, docs/91 §3).
 *  Collections + `*Url` tokens aren't in the flat snapshot, so they always come
 *  from the live resolve. Mutates + returns `data`. */
export function applyEntitySnapshot(
  data: DataSources,
  snapshot: Record<string, unknown> | null | undefined
): DataSources {
  if (!snapshot) return data;
  for (const [path, value] of Object.entries(snapshot)) {
    if (value == null || value === '') continue;
    const segs = path.split('.');
    if (segs.length < 2) continue;
    let cursor = data as Record<string, unknown>;
    for (let i = 0; i < segs.length - 1; i += 1) {
      const seg = segs[i]!;
      if (typeof cursor[seg] !== 'object' || cursor[seg] === null) cursor[seg] = {};
      cursor = cursor[seg] as Record<string, unknown>;
    }
    const leaf = segs[segs.length - 1]!;
    const cur = cursor[leaf];
    if (cur == null || cur === '') cursor[leaf] = value;
  }
  return data;
}

/** A `resolveEmailData` callback bound to a request's context — what the broadcast
 *  send path and the dispatch tick inject so @sparx/email-platform resolves email
 *  data without a @sparx/commerce dependency (docs/52 §6). */
export function emailDataResolver(ctx: ServiceContext) {
  return (
    tree: BuilderNode,
    ref?: EmailRecipientRef,
    extraStrings?: string[]
  ): Promise<DataSources> => resolveEmailData(ctx, tree, ref, extraStrings);
}
