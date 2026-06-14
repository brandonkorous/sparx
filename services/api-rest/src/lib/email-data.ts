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
// Every `*Url` token (site.url / recoveryUrl / reviewUrl / payUrl / portalUrl)
// resolves to a real storefront route so the CTAs work (docs/91 §1).

import { withTenant } from '@sparx/db';
import { discountService, productService } from '@sparx/commerce';
import { collectEmailSourceKeys, type BuilderNode, type DataSources } from '@sparx/builder-schemas';
import type { ServiceContext } from '@sparx/email-platform';

import { resolveActivePropertyName } from './property.js';

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
  /** The fulfillment a shipping-confirmation send is about (docs/93 §3). */
  fulfillmentId?: string | null;
  /** The service appointment an appointment-* send is about (docs/93 §3). */
  appointmentId?: string | null;
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
const SITE_BASE = process.env.SPARX_SITE_BASE ?? '';

function mediaUrl(mediaId: string | null | undefined, slug: string): string {
  if (!mediaId) return '';
  return `${API_BASE}/v1/public/media/${encodeURIComponent(mediaId)}?tenant=${encodeURIComponent(slug)}`;
}

function siteLink(slug: string, path: string): string {
  if (!SITE_BASE) return path;
  return `${SITE_BASE.replace('{slug}', slug)}${path}`;
}

/** The store root as an absolute-or-`/` URL — `siteLink(slug, '')` is `''`
 *  when the base is unset, so fall back to `/` for a still-valid link. */
function homeUrl(slug: string): string {
  const url = siteLink(slug, '');
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

/** A clock time — `2:30 PM`. */
function timeLabel(d: Date | null | undefined): string {
  return d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
}

/** A fleet-vehicle one-liner from an appointment's `vehicleRef` JSON snapshot
 *  (mirrors the scheduling route's `buildVehicleDescription`). */
function vehicleDescription(ref: unknown): string {
  if (!ref || typeof ref !== 'object') return '';
  const v = ref as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof v.year === 'number') parts.push(String(v.year));
  if (typeof v.make === 'string') parts.push(v.make);
  if (typeof v.model === 'string') parts.push(v.model);
  return parts.join(' ');
}

/** A frozen order address snapshot (CustomerAddress shape) → a flat string map the
 *  tree binds (`order.shippingAddress.line1`, `.oneLine`, …). '' fields when absent. */
function formatAddress(json: unknown): Record<string, string> {
  const a = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  const s = (k: string): string => {
    const v = a[k];
    return typeof v === 'string' ? v : '';
  };
  const name = s('recipientName') || s('name');
  const cityRegion = [s('city'), s('region')].filter(Boolean).join(', ');
  const cityStateZip = [cityRegion, s('postalCode')].filter(Boolean).join(' ');
  const oneLine = [name, s('line1'), s('line2'), cityStateZip, s('country')]
    .filter(Boolean)
    .join(', ');
  return {
    name,
    line1: s('line1'),
    line2: s('line2'),
    city: s('city'),
    region: s('region'),
    postalCode: s('postalCode'),
    country: s('country'),
    cityStateZip,
    oneLine,
  };
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
  tenant: { slug: string; name: string; email: string },
  propertyId?: string | null
): Promise<Record<string, string>> {
  const [settings, propertyName] = await Promise.all([
    withTenant(ctx, (tx) =>
      tx.emailSettings.findUnique({ where: { tenantId: ctx.tenantId }, select: { replyTo: true } })
    ),
    resolveActivePropertyName(ctx.tenantId, propertyId ?? null),
  ]);
  // `{{site.name}}` is customer-facing copy ("Welcome to …", "thanks for shopping
  // with …"), so it must be the SITE name — `Property.name` for the ACTIVE site,
  // else the tenant's PRIMARY site (docs/49 Phase 7) — the SAME per-site name the
  // wordmark/footer brand resolves, so a per-site email reads the site name in
  // body copy too, not just the chrome. It is NEVER the tenant's legal/org name.
  // The `tenant.name` tail is a defensive non-blank guard only: Property.name is
  // NOT NULL and seeded from the tenant name at provisioning, so it is effectively
  // unreachable.
  const siteName = propertyName || tenant.name;
  // `url` is the canonical field (`{{site.url}}`); `siteUrl` + `storeUrl` are
  // back-compat aliases (the store→site, then `tenant.*`→`site.*` renames) so an
  // email authored before either rename (an existing `{{tenant.siteUrl}}` /
  // `{{tenant.storeUrl}}` button) still resolves to the same URL.
  const home = homeUrl(tenant.slug);
  return {
    name: siteName,
    url: home,
    siteUrl: home,
    storeUrl: home,
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
        shippingAddress: true,
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
  const reviewUrl = firstHandle ? siteLink(slug, `/products/${firstHandle}`) : homeUrl(slug);
  // statusUrl → the customer's order detail (order-confirmation CTA, docs/93 §4).
  const statusUrl = siteLink(slug, '/account/orders');
  return {
    number: order.orderNumber,
    status: order.status,
    total: money(order.total),
    subtotal: money(order.subtotal),
    placedAt: dateLabel(order.placedAt),
    reviewUrl,
    statusUrl,
    shippingAddress: formatAddress(order.shippingAddress),
    items: order.items.map((i) => ({
      name: firstText(i.name, i.description),
      quantity: qty(i.quantity),
      unitPrice: money(i.unitPrice),
      lineTotal: money(i.lineTotal),
    })),
  };
}

// ── shipping (latest fulfillment of an order) ────────────────────────────────

async function resolveShipping(
  ctx: ServiceContext,
  ref: EmailRecipientRef | undefined,
  slug: string
): Promise<Record<string, unknown>> {
  const where = ref?.fulfillmentId
    ? { id: ref.fulfillmentId }
    : ref?.orderId
      ? { orderId: ref.orderId }
      : null;
  if (!where) return {};
  const f = await withTenant(ctx, (tx) =>
    tx.orderFulfillment.findFirst({
      where,
      orderBy: [{ shippedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        status: true,
        carrier: true,
        service: true,
        trackingNumber: true,
        trackingUrl: true,
        shippedAt: true,
      },
    })
  );
  if (!f) return {};
  return {
    status: f.status,
    carrier: f.carrier ?? '',
    service: f.service ?? '',
    trackingNumber: f.trackingNumber ?? '',
    // The carrier's tracking page when known; else the customer's order detail so
    // the CTA always resolves to something useful (docs/93 §3).
    trackingUrl: f.trackingUrl ?? siteLink(slug, '/account/orders'),
    shippedAt: dateLabel(f.shippedAt),
  };
}

// ── appointment (B2B service scheduling) ─────────────────────────────────────

async function resolveAppointment(
  ctx: ServiceContext,
  ref: EmailRecipientRef | undefined,
  slug: string
): Promise<Record<string, unknown>> {
  if (!ref?.appointmentId) return {};
  const appt = await withTenant(ctx, (tx) =>
    tx.serviceAppointment.findUnique({
      where: { id: ref.appointmentId! },
      select: {
        scheduledAt: true,
        durationMinutes: true,
        status: true,
        vehicleRef: true,
        cancellationReason: true,
        b2bAccountId: true,
        serviceType: { select: { name: true } },
      },
    })
  );
  if (!appt) return {};
  const date = dateLabel(appt.scheduledAt);
  const time = timeLabel(appt.scheduledAt);
  return {
    service: appt.serviceType?.name ?? '',
    date,
    time,
    when: date && time ? `${date} at ${time}` : date || time,
    duration: appt.durationMinutes ? `${appt.durationMinutes} min` : '',
    status: appt.status,
    vehicle: vehicleDescription(appt.vehicleRef),
    cancellationReason: appt.cancellationReason ?? '',
    // Where the customer manages/reschedules — their B2B portal appointments, else
    // their account home.
    manageUrl: appt.b2bAccountId
      ? siteLink(slug, `/account/b2b/${appt.b2bAccountId}/appointments`)
      : siteLink(slug, '/account'),
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
    recoveryUrl: siteLink(slug, '/cart'),
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
      ? siteLink(slug, `/account/b2b/${quote.b2bAccountId}/quotes`)
      : siteLink(slug, '/account'),
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
      ? siteLink(slug, `/account/b2b/${doc.b2bAccountId}/invoices`)
      : siteLink(slug, '/account'),
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
    portalUrl: siteLink(slug, `/account/b2b/${ref.b2bAccountId}`),
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
  // No points model exists — surface the account-credit balance (mirrors the
  // section loyalty resolver; revisit if a points engine lands).
  const empty = { pointsLabel: '', tierName: '' };
  if (!ref?.customerId) return empty;
  const bal = await discountService.getAccountCreditBalance(ctx, ref.customerId);
  if (!bal || bal.balanceCents <= 0) return empty;
  return { pointsLabel: moneyCents(bal.balanceCents), tierName: 'Account credit available' };
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
    url: siteLink(slug, `/products/${p.handle}`),
  }));
}

async function resolvePromotion(ctx: ServiceContext): Promise<Record<string, string>> {
  const now = Date.now();
  const active = (await discountService.listDiscounts(ctx, { status: 'active' })).items.find(
    (d) => {
      const startOk = !d.startAt || new Date(d.startAt).getTime() <= now;
      const endOk = !d.endAt || new Date(d.endAt).getTime() >= now;
      return startOk && endOk;
    }
  );
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
      url: siteLink(slug, `/${typeKey === 'blog_post' ? 'blog' : typeKey}/${r.slug ?? ''}`),
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
  extraStrings: string[] = [],
  propertyId?: string | null
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
  // Site identity is one resolve, emitted under BOTH the canonical `site` root and
  // the historical `tenant` alias, so `{{site.name}}` and a legacy `{{tenant.name}}`
  // both resolve regardless of which namespace a given tree was authored against.
  if (keys.has('site') || keys.has('tenant')) {
    tasks.push(
      resolveTenant(ctx, tenant, propertyId).then((v) => {
        out.site = v;
        out.tenant = v;
      })
    );
  }
  if (keys.has('order')) {
    tasks.push(resolveOrder(ctx, ref, slug).then((v) => void (out.order = v)));
  }
  if (keys.has('shipping')) {
    tasks.push(resolveShipping(ctx, ref, slug).then((v) => void (out.shipping = v)));
  }
  if (keys.has('appointment')) {
    tasks.push(resolveAppointment(ctx, ref, slug).then((v) => void (out.appointment = v)));
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
 *  send path, the dispatch tick, and the editor preview inject so
 *  @sparx/email-platform resolves email data without a @sparx/commerce dependency
 *  (docs/52 §6). `boundPropertyId` scopes `{{tenant.name}}` to the active site for
 *  callers that know the site at injection time (preview/test-send pass
 *  `ctx.propertyId`); a per-call `propertyId` lets a caller that learns the site
 *  later override it (the broadcast send path passes `broadcast.propertyId`). Absent
 *  → tenant-level, unchanged for single-site tenants. */
export function emailDataResolver(ctx: ServiceContext, boundPropertyId?: string | null) {
  return (
    tree: BuilderNode,
    ref?: EmailRecipientRef,
    propertyId?: string | null
  ): Promise<DataSources> =>
    resolveEmailData(ctx, tree, ref, undefined, propertyId ?? boundPropertyId);
}
