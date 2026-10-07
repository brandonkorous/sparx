// Email DataSources resolver (docs/52 §7, docs/91 §3). Reads tenant data
// (commerce + CRM + invoicing + CMS) and produces the nested `DataSources` map the
// Builder email renderer (`renderEmailTree`) resolves bindings + `{{token}}` merge
// fields against, keyed to the docs/91 §3 vocabulary.
//
// Lives in api-rest — the composition root that already has @wizeworks/commerce — so
// @wizeworks/email-platform (imported by the lean email-worker) stays commerce-free.
// Injected into the broadcast send path + the dispatch tick as the
// `resolveEmailData` callback (docs/52 §6).
//
// Two tiers of source, both selected by what the tree actually references
// (`collectEmailSourceKeys` over bindings AND `{{token}}` paths, so a static email
// costs nothing):
//   · entity-scoped — customer / order / cart / quote / invoice / company:
//     resolved from the send's `entityRefs` (the specific entity an automation
//     fired on), falling back to the recipient's most-recent for a broadcast.
//   · per-send      — tenant / commerce.product / promotion / cms.<type>: resolved
//     once.
// Every `*Url` token (site.url / recoveryUrl / reviewUrl / payUrl / portalUrl)
// resolves to a real storefront route so the CTAs work (docs/91 §1), as an ABSOLUTE
// address on the site the email is about (`lib/site-origin.ts`): a bare path
// opens nothing from an inbox, and every link here was one until issue 064.

import { withTenant } from '@wizeworks/db';
import { COLLECTION_RATE_REF, discountService, productService } from '@wizeworks/commerce';
import { carrierLabel } from '@wizeworks/commerce-schemas';
import { billingDocumentMail, businessTimeZone, daysPastDue } from '@wizeworks/crm';
import { EMAIL_FRAME_TOKENS } from '@wizeworks/email/silica';
import { ALL_MODULES, listEnabledModules, type ModuleSlug } from '@wizeworks/modules';
import {
  addressMergeValue,
  collectSilicaEmailSourceKeys,
  type DataSources,
  type SilicaEmailDocument,
} from '@wizeworks/builder-schemas';
import { findBookingPlace, joinNames } from '@wizeworks/scheduling';
import type { ServiceContext } from '@wizeworks/email-platform';

import { resolveCoreReturnAddress } from './business-identity.js';
import { resolveActivePropertyName, resolvePrimaryPropertyId } from './property.js';
import { loadSenderIdentity } from './tenant-email.js';
import { bookingIcsUrl } from './scheduling-ical.js';
import { bookingManagePath } from './scheduling-token.js';
import { resolveSiteOrigin, siteUrl } from './site-origin.js';

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
  companyId?: string | null;
  /** The fulfillment a shipping-confirmation send is about (docs/93 §3). */
  fulfillmentId?: string | null;
  /** The Scheduling-module booking a booking-* send is about (docs/79 §10). */
  bookingId?: string | null;
  /** The waitlist entry a waitlist-offer send is about (docs/79 §7). */
  waitlistEntryId?: string | null;
  /** The commerce subscription a subscription-* send is about (docs/impl transactional-email P2). */
  subscriptionId?: string | null;
  /** The return/RMA a return-* send is about (docs/impl transactional-email P3). */
  returnId?: string | null;
}

// Public api-rest origin for media URLs (GET /v1/public/media/:id) — REST-specific
// (GraphQL doesn't serve bytes); see brand-service.ts. Falls back to the internal
// REST url only for local/dev.
const API_BASE =
  process.env.SPARX_PUBLIC_API_REST_URL ??
  process.env.SPARX_API_REST_URL ??
  'http://localhost:3100';
function mediaUrl(mediaId: string | null | undefined, slug: string): string {
  if (!mediaId) return '';
  return `${API_BASE}/v1/public/media/${encodeURIComponent(mediaId)}?tenant=${encodeURIComponent(slug)}`;
}

/**
 * The site one email links into: its public origin, resolved ONCE per email and
 * handed to every source that builds a link, plus the tenant slug the media URLs
 * still carry. `link('/account')` is always absolute; there is no path-only mode
 * any more, because a path is a link to nowhere once it is in somebody's inbox.
 */
export interface EmailSite {
  slug: string;
  origin: string;
  link: (path: string) => string;
  home: string;
}

export function emailSite(slug: string, origin: string): EmailSite {
  return { slug, origin, link: (path) => siteUrl(origin, path), home: siteUrl(origin, '') };
}

/**
 * Which site an email is ABOUT. The record it names knows where it was placed (an
 * order's, booking's, basket's, subscription's or document's own site), and that
 * is the site whose address the customer knows, so it wins over the site the send
 * was made on behalf of; that one is the fallback, then the tenant's primary
 * (`resolveSiteOrigin` treats a null as the primary). A record with no site of its
 * own (an order placed before sites existed) falls through the same way.
 */
async function emailAboutPropertyId(
  ctx: ServiceContext,
  ref: EmailRecipientRef | undefined
): Promise<string | null> {
  if (!ref) return null;
  return withTenant(ctx, async (tx) => {
    if (ref.orderId) {
      const row = await tx.order.findUnique({
        where: { id: ref.orderId },
        select: { propertyId: true },
      });
      if (row?.propertyId) return row.propertyId;
    }
    if (ref.fulfillmentId) {
      const row = await tx.orderFulfillment.findUnique({
        where: { id: ref.fulfillmentId },
        select: { order: { select: { propertyId: true } } },
      });
      if (row?.order.propertyId) return row.order.propertyId;
    }
    if (ref.returnId) {
      const row = await tx.returnRequest.findUnique({
        where: { id: ref.returnId },
        select: { order: { select: { propertyId: true } } },
      });
      if (row?.order.propertyId) return row.order.propertyId;
    }
    if (ref.bookingId) {
      const row = await tx.booking.findUnique({
        where: { id: ref.bookingId },
        select: { propertyId: true },
      });
      if (row?.propertyId) return row.propertyId;
    }
    if (ref.waitlistEntryId) {
      const row = await tx.waitlistEntry.findUnique({
        where: { id: ref.waitlistEntryId },
        select: { service: { select: { propertyId: true } } },
      });
      if (row?.service.propertyId) return row.service.propertyId;
    }
    if (ref.subscriptionId) {
      const row = await tx.subscription.findUnique({
        where: { id: ref.subscriptionId },
        select: { propertyId: true },
      });
      if (row?.propertyId) return row.propertyId;
    }
    if (ref.cartId) {
      const row = await tx.cart.findUnique({
        where: { id: ref.cartId },
        select: { propertyId: true },
      });
      if (row?.propertyId) return row.propertyId;
    }
    const documentId = ref.quoteId ?? ref.billingDocumentId;
    if (documentId) {
      const row = await tx.billingDocument.findUnique({
        where: { id: documentId },
        select: { propertyId: true },
      });
      if (row?.propertyId) return row.propertyId;
    }
    return null;
  });
}

/**
 * The public origin every link in one email is built on: the site the email is
 * about (see `emailAboutPropertyId`), else the site it is sent for, else the
 * tenant's primary. Exported so the send path resolves it once and hands the same
 * answer to the body AND the footer, which must not point at two addresses.
 */
export async function resolveEmailSiteOrigin(
  ctx: ServiceContext,
  ref: EmailRecipientRef | undefined,
  propertyId: string | null | undefined
): Promise<string> {
  const about = await emailAboutPropertyId(ctx, ref);
  return resolveSiteOrigin(ctx.tenantId, about ?? propertyId ?? null);
}

/** A CMS slug → a human label (`privacy-policy` → `Privacy Policy`) — the fallback
 *  when a footer placement has no explicit label override. */
function prettifyLegalSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** One resolved footer link — an absolute URL (or `mailto:`) plus its label. */
export interface EmailFooterLink {
  label: string;
  href: string;
}

/**
 * The footer's utility + legal links for a site: the customer ACCOUNT portal, a
 * CONTACT mailto (only when the site set a public reply-to — never the owner's
 * private account email), and the site's PUBLISHED footer legal pages
 * (privacy · terms · returns · …).
 *
 * The legal links come from the SAME `siteDocPlacement` source the storefront footer
 * reads ([content.ts] `/v1/public/legal/placements`), filtered to published entries,
 * so the email footer and the site footer never disagree and no link is ever dead.
 * A brand-new site with nothing published yields just the account link.
 */
export async function resolveEmailFooterLinks(
  ctx: ServiceContext,
  propertyId: string | null,
  /** The email's own site origin when the caller already resolved it, so the
   *  footer and the body agree; resolved from `propertyId` otherwise. */
  origin?: string
): Promise<EmailFooterLink[]> {
  const [siteOrigin, identity, siteId] = await Promise.all([
    origin ?? resolveSiteOrigin(ctx.tenantId, propertyId),
    loadSenderIdentity(ctx.tenantId, propertyId),
    propertyId ?? resolvePrimaryPropertyId(ctx.tenantId),
  ]);
  const links: EmailFooterLink[] = [
    { label: 'Your account', href: siteUrl(siteOrigin, '/account') },
  ];
  // Only a deliberately-public reply-to becomes a Contact link; we never expose the
  // owner's private account email in a customer-facing footer.
  if (identity.replyTo) links.push({ label: 'Contact', href: `mailto:${identity.replyTo}` });

  const rows = await withTenant(ctx, (tx) =>
    tx.siteDocPlacement.findMany({
      where: {
        placement: 'footer',
        enabled: true,
        OR: [{ propertyId: null }, { propertyId: siteId }],
      },
      orderBy: { position: 'asc' },
      select: { label: true, entry: { select: { slug: true, status: true, deletedAt: true } } },
    })
  );
  for (const r of rows) {
    const e = r.entry;
    if (!e?.slug || e.status !== 'published' || e.deletedAt) continue;
    links.push({
      label: r.label ?? prettifyLegalSlug(e.slug),
      href: siteUrl(siteOrigin, `/${e.slug}`),
    });
  }
  return links;
}

/** Decimal-dollar money (orders / quotes / invoices) → `$1,234.50`. */
function money(amount: unknown): string {
  if (amount == null) return '';
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Money that HIDES a zero. A `$0.00` shipping / tax / discount line is noise on a
 *  receipt, and an empty string makes the cost-summary row self-drop (same
 *  `hideWhenEmpty` mechanism as any optional row) — so free shipping and a
 *  tax-exempt order simply show no line rather than a `$0.00` one. */
function moneyPositive(amount: unknown): string {
  const n = Number(amount);
  return Number.isFinite(n) && n > 0 ? money(amount) : '';
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

/**
 * A DATE column's day, read in UTC — `Aug 29, 2026`.
 *
 * Not `dateLabel`: a date-only column comes back as UTC midnight, and
 * formatting that in the process's own zone shifts it to the day before
 * anywhere west of Greenwich. The stored value is a calendar day somebody was
 * promised, so it is read as one (issue 026).
 */
function calendarDayLabel(d: Date | null | undefined): string {
  return d
    ? d.toLocaleDateString('en-US', {
        timeZone: 'UTC',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';
}

/** A clock time — `2:30 PM`. */
function timeLabel(d: Date | null | undefined): string {
  return d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
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

/** An order's frozen shipping address as the email reads it: the parts, on a value
 *  that also reads whole as its one line (`addressMergeValue`, which says why both
 *  spellings are in tenants' stored receipts). '' when there is nowhere to send it. */
export function shippingAddressValue(json: unknown): Record<string, string> | '' {
  const parts = formatAddress(json);
  return addressMergeValue({ ...parts, oneLine: parts.oneLine ?? '' });
}

/**
 * How an order reaches its customer: they come and PICK it UP, or it is DELIVERED
 * to them (posted, couriered, sent electronically).
 *
 * Picked up when the order was placed for collection: checkout's "Collect in
 * person" and a counter sale both record the collection rate (`shippingRateRef`),
 * which is the same test the shopper's own order page and the console make. A
 * record placed some other way that was then handed over the counter (every
 * fulfillment is a `pickup` one) is picked up too.
 *
 * The receipt said "We'll email you tracking the moment it ships" and "Shipping to"
 * to somebody collecting from the counter, and the hand-over email told them their
 * order "has been delivered" when they had carried it out of the shop themselves
 * (issue 064). Every one of those sentences now switches on this.
 */
export function orderHandover(
  metadata: unknown,
  fulfillmentCarriers: readonly (string | null)[]
): 'pickup' | 'delivery' {
  const meta =
    metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : {};
  if (meta.shippingRateRef === COLLECTION_RATE_REF) return 'pickup';
  if (fulfillmentCarriers.length > 0 && fulfillmentCarriers.every((c) => c === 'pickup')) {
    return 'pickup';
  }
  return 'delivery';
}

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
  companyName: true,
} as const;

interface CustomerRow {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  companyName: string | null;
}

function customerFields(c: CustomerRow | null, fallbackEmail: string): Record<string, string> {
  const fullName = [c?.firstName, c?.lastName].filter(Boolean).join(' ');
  return {
    firstName: c?.firstName ?? '',
    lastName: c?.lastName ?? '',
    fullName,
    email: c?.email ?? fallbackEmail,
    company: c?.companyName ?? '',
  };
}

/** The B2B account's addressable Customer — active primary contact, else any
 *  active contact (mirrors the automation resolver's `resolveContact`). */
async function b2bPrimaryCustomer(
  ctx: ServiceContext,
  companyId: string
): Promise<CustomerRow | null> {
  const primary = await withTenant(ctx, (tx) =>
    tx.b2bAccountContact.findFirst({
      where: { accountId: companyId, isActive: true, role: 'primary_contact' },
      select: { customer: { select: CUSTOMER_SELECT } },
    })
  );
  if (primary?.customer) return primary.customer;
  const any = await withTenant(ctx, (tx) =>
    tx.b2bAccountContact.findFirst({
      where: { accountId: companyId, isActive: true },
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
  if (ref?.companyId) {
    const c = await b2bPrimaryCustomer(ctx, ref.companyId);
    if (c) return customerFields(c, fallbackEmail);
  }
  return customerFields(null, fallbackEmail);
}

// ── tenant ──────────────────────────────────────────────────────────────────

async function resolveTenant(
  ctx: ServiceContext,
  tenant: { slug: string; name: string; email: string },
  site: EmailSite,
  propertyId?: string | null
): Promise<Record<string, string>> {
  const [settings, propertyName] = await Promise.all([
    // Per-site (docs/131 §3.4): `{{tenant.replyTo}}` in body copy must be the
    // address of the business whose name is on the message, and that is the same
    // site whose name resolves on the next line.
    loadSenderIdentity(ctx.tenantId, propertyId ?? null),
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
  const home = site.home;
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
  site: EmailSite
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
        shippingTotal: true,
        taxTotal: true,
        discountTotal: true,
        refundTotal: true,
        coreChargeTotal: true,
        amountPaid: true,
        readyOn: true,
        placedAt: true,
        deliveredAt: true,
        cancelledReason: true,
        shippingAddress: true,
        // How it reaches the customer (`orderHandover`): the collection rate
        // checkout and the counter record, and the carriers it actually left by.
        metadata: true,
        fulfillments: { select: { carrier: true } },
        items: {
          orderBy: { createdAt: 'asc' },
          select: {
            name: true,
            description: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
            coreCharge: true,
            coreFirst: true,
            product: { select: { handle: true } },
          },
        },
      },
    })
  );
  if (!order) return {};
  const handover = orderHandover(
    order.metadata,
    order.fulfillments.map((f) => f.carrier)
  );
  const pickup = handover === 'pickup';
  // The business's own address: where an old part goes (issue 057) and where a
  // pickup order is collected from (issue 064). Read only when one of them needs it.
  const businessAddress =
    pickup || order.items.some((i) => i.coreFirst) ? await resolveCoreReturnAddress(ctx) : null;
  const returnTo = order.items.some((i) => i.coreFirst) ? businessAddress : null;
  const sendTo = returnTo
    ? ` Bring or send it to ${[returnTo.name, ...returnTo.lines].filter(Boolean).join(', ')}.`
    : ' Contact us for where to send it.';
  // reviewUrl → the first purchased product's PDP (where the review UI lives),
  // falling back to the store root when no item resolves a product (docs/91 §3).
  const firstHandle = order.items.find((i) => i.product?.handle)?.product?.handle ?? '';
  const reviewUrl = firstHandle ? site.link(`/products/${firstHandle}`) : site.home;
  // statusUrl → the customer's order detail (order-confirmation CTA, docs/93 §4).
  const statusUrl = site.link('/account/orders');
  return {
    number: order.orderNumber,
    status: order.status,
    total: money(order.total),
    subtotal: money(order.subtotal),
    // The receipt breakdown — each hides its zero so a free-shipping / tax-exempt /
    // undiscounted order shows no line rather than a `$0.00` one.
    shippingTotal: moneyPositive(order.shippingTotal),
    taxTotal: moneyPositive(order.taxTotal),
    discountTotal: moneyPositive(order.discountTotal),
    // The amount refunded (order-refunded email hero) and the lifecycle fields the
    // delivered / cancelled emails read. Empty-string when absent so an optional
    // card row self-drops (a cancelled order with no reason shows no "Reason" line).
    refundTotal: money(order.refundTotal),
    // Refundable core deposits on rebuilt parts (sparx issue 051). Empty when none,
    // so an ordinary receipt shows no row.
    coreChargeTotal: moneyPositive(order.coreChargeTotal),
    // Made to order (issue 026). Both empty-string when they do not apply, so
    // an ordinary receipt drops both rows rather than printing "Ready: —" or a
    // balance of nothing. The balance is what is genuinely left to pay, so a
    // fully-paid order shows no row even when it had a deposit.
    readyOn: calendarDayLabel(order.readyOn),
    balanceDue: moneyPositive(Number(order.total) - Number(order.amountPaid)),
    deliveredAt: order.deliveredAt ? dateLabel(order.deliveredAt) : '',
    cancelReason: order.cancelledReason ?? '',
    placedAt: dateLabel(order.placedAt),
    reviewUrl,
    statusUrl,
    // Never on a pickup order, whatever the row holds: nothing is being sent there,
    // and a till order stores the JSON `null` rather than no value at all.
    shippingAddress: pickup ? '' : shippingAddressValue(order.shippingAddress),
    // Exactly one of these is 'yes'; the other is '' so a block gated on it drops.
    // A template says the pickup sentence or the delivery one with them, rather
    // than telling somebody at the counter that their parcel is on its way.
    pickup: pickup ? 'yes' : '',
    delivery: pickup ? '' : 'yes',
    // A pickup order is either still to collect or already gone. A counter sale is
    // handed over before its receipt is built, and "We'll let you know when it's
    // ready to pick up" arrived beside "You picked up order …" (issue 064).
    pickupLater: pickup && !order.deliveredAt ? 'yes' : '',
    pickedUp: pickup && order.deliveredAt ? 'yes' : '',
    // Where to collect it, when the business has a street address on file and it
    // has not already been collected.
    pickupFrom:
      pickup && !order.deliveredAt && businessAddress ? businessAddress.lines.join(', ') : '',
    // A rebuilt part's core deposit gets its own row under the part, so every
    // stored receipt (whatever its summary rows) shows what the extra money was
    // for and that it comes back (sparx issue 051).
    items: order.items.flatMap((i) => {
      const part = {
        name: firstText(i.name, i.description),
        quantity: qty(i.quantity),
        unitPrice: money(i.unitPrice),
        lineTotal: money(i.lineTotal),
      };
      // Bought by sending the old part first (issue 057): no money row, but the
      // promise and the address, under the part it is about.
      if (i.coreFirst) {
        return [
          part,
          {
            name: `${part.name} is ready once your old part arrives.${sendTo}`,
            quantity: qty(i.quantity),
            unitPrice: '',
            lineTotal: '',
          },
        ];
      }
      if (i.coreCharge === null) return [part];
      return [
        part,
        {
          name: `Refundable core deposit: ${part.name}. Paid back when you return your old part.`,
          quantity: qty(i.quantity),
          unitPrice: money(i.coreCharge),
          lineTotal: money(Number(i.coreCharge) * i.quantity),
        },
      ];
    }),
  };
}

// ── shipping (latest fulfillment of an order) ────────────────────────────────

async function resolveShipping(
  ctx: ServiceContext,
  ref: EmailRecipientRef | undefined,
  site: EmailSite
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
    // The stored code is lowercase (`usps`, `dropship`). Bound raw, the email
    // told a customer their parcel went by "usps" — the one place this fact
    // reaches somebody outside the business was the only one not translating it.
    carrier: carrierLabel(f.carrier),
    service: f.service ?? '',
    trackingNumber: f.trackingNumber ?? '',
    // The carrier's tracking page when known; else the customer's order detail so
    // the CTA always resolves to something useful (docs/93 §3).
    trackingUrl: f.trackingUrl ?? site.link('/account/orders'),
    shippedAt: dateLabel(f.shippedAt),
  };
}

// ── booking (Scheduling module, docs/79) ─────────────────────────────────────

/** A wall-clock date/time formatted in the BOOKING's own timezone — a booking's
 *  time is the one piece of email copy that must read in the customer's local
 *  zone, not the server's. Intl handles DST without a date library. */
function inZone(d: Date, tz: string, opts: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts }).format(d);
  } catch {
    // An invalid stored tz (shouldn't happen) falls back to UTC rather than throw.
    return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...opts }).format(d);
  }
}

async function resolveBooking(
  ctx: ServiceContext,
  ref: EmailRecipientRef | undefined,
  site: EmailSite
): Promise<Record<string, unknown>> {
  if (!ref?.bookingId) return {};
  const b = await withTenant(ctx, (tx) =>
    tx.booking.findUnique({
      where: { id: ref.bookingId! },
      select: {
        startAt: true,
        timezone: true,
        status: true,
        partySize: true,
        cancellationReason: true,
        locationId: true,
        serviceId: true,
        service: { select: { name: true, durationMinutes: true } },
        resources: {
          select: { resource: { select: { name: true, kind: true } } },
        },
      },
    })
  );
  if (!b) return {};
  // The "Location" row on the booking email is the one a customer reads in the
  // car. It carried the place's NAME, which the business already knows and the
  // customer cannot navigate to — and it was empty besides, because a one-chair
  // business never files a service under a location (issue 107).
  const place = await findBookingPlace(ctx.tenantId, {
    locationId: b.locationId,
    serviceId: b.serviceId,
  });
  const tz = b.timezone || 'UTC';
  const date = inZone(b.startAt, tz, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const time = inZone(b.startAt, tz, { hour: 'numeric', minute: '2-digit' });
  // Staff assigned to the booking (kind 'staff') — the "with {name}" line for an
  // appointment; empty for an asset/table/space booking (the conditional hides it).
  const staff = b.resources
    .map((r) => r.resource)
    .filter((r) => r.kind === 'staff')
    .map((r) => r.name);
  return {
    service: b.service?.name ?? '',
    date,
    time,
    when: date && time ? `${date} at ${time}` : date || time,
    duration: b.service?.durationMinutes ? `${b.service.durationMinutes} min` : '',
    location: place?.line ?? '',
    staff: joinNames(staff),
    partySize: b.partySize != null ? String(b.partySize) : '',
    status: b.status,
    cancellationReason: b.cancellationReason ?? '',
    // Where the customer manages a booking + where they re-book after a
    // cancellation. The manage link is signed and names THIS booking, because
    // the person reading it booked as a guest and has no account to sign in to
    // (issue 153); it used to point at the account portal, which meant the
    // "Change or cancel" button opened a login wall.
    manageUrl: site.link(bookingManagePath(ctx.tenantId, ref.bookingId)),
    bookUrl: site.link('/book'),
    // The per-booking `.ics` download (docs/79 §8.1) — an "Add to calendar" link in
    // the confirmation/reminder. Absolute api-rest URL (reachable by mail clients).
    addToCalendarUrl: bookingIcsUrl(ctx.tenantId, ref.bookingId),
    // Owner-facing helpers for the internal new-booking alert (booking-notification-internal):
    // `newHeadline` varies the subject/heading wording, and `pendingApproval` (truthy only
    // for a requires-approval booking that's still `requested`) gates the action-needed line.
    newHeadline: b.status === 'requested' ? 'New booking request' : 'New booking',
    pendingApproval: b.status === 'requested' ? 'requested' : '',
  };
}

// ── waitlist (Scheduling module offer, docs/79 §7) ───────────────────────────

async function resolveWaitlist(
  ctx: ServiceContext,
  ref: EmailRecipientRef | undefined,
  site: EmailSite
): Promise<Record<string, unknown>> {
  if (!ref?.waitlistEntryId) return {};
  const w = await withTenant(ctx, (tx) =>
    tx.waitlistEntry.findUnique({
      where: { id: ref.waitlistEntryId! },
      select: {
        desiredFrom: true,
        desiredTo: true,
        offerExpiresAt: true,
        serviceId: true,
        service: { select: { name: true } },
      },
    })
  );
  if (!w) return {};
  const from = dateLabel(w.desiredFrom);
  const to = dateLabel(w.desiredTo);
  const expires = w.offerExpiresAt
    ? `${dateLabel(w.offerExpiresAt)} at ${timeLabel(w.offerExpiresAt)}`
    : '';
  return {
    service: w.service?.name ?? '',
    window: from && to ? `${from} – ${to}` : from || to,
    offerExpires: expires,
    // Book-now goes straight to the service's public booking page.
    bookUrl: site.link(`/book/${w.serviceId}`),
    manageUrl: site.link('/account/bookings'),
  };
}

// ── subscription (commerce auto-ship, docs/impl transactional-email P2) ──────

async function resolveSubscription(
  ctx: ServiceContext,
  ref: EmailRecipientRef | undefined,
  site: EmailSite
): Promise<Record<string, unknown>> {
  if (!ref?.subscriptionId) return {};
  const s = await withTenant(ctx, (tx) =>
    tx.subscription.findUnique({
      where: { id: ref.subscriptionId! },
      select: {
        status: true,
        intervalUnit: true,
        intervalCount: true,
        nextOccurrenceAt: true,
        pausedUntil: true,
        currentPeriodEnd: true,
        items: { select: { quantity: true, unitPriceCents: true } },
      },
    })
  );
  if (!s) return {};
  // "every month" / "every 2 weeks" — the plain-language cadence for the copy.
  const n = s.intervalCount;
  const interval = `every ${n === 1 ? '' : `${n} `}${s.intervalUnit}${n === 1 ? '' : 's'}`;
  const amountCents = s.items.reduce((sum, it) => sum + it.unitPriceCents * it.quantity, 0);
  return {
    status: s.status,
    interval,
    amount: moneyCents(amountCents),
    itemCount: String(s.items.reduce((c, it) => c + it.quantity, 0)),
    nextOrderDate: s.nextOccurrenceAt ? dateLabel(s.nextOccurrenceAt) : '',
    pausedUntil: s.pausedUntil ? dateLabel(s.pausedUntil) : '',
    currentPeriodEnd: s.currentPeriodEnd ? dateLabel(s.currentPeriodEnd) : '',
    // The customer's storefront account home. NOTE: a dedicated
    // `/account/subscriptions` storefront page does not exist yet — until it does,
    // "Manage subscription" lands on the account home rather than a dead 404.
    // Repoint here once that page ships (docs/impl transactional-email §4 P2 follow-up).
    manageUrl: site.link('/account'),
  };
}

// ── return / RMA (docs/impl transactional-email §4 P3) ───────────────────────

/** A refund-method code → plain language for the copy. */
function refundMethodLabel(code: string | null): string {
  switch (code) {
    case 'account_credit':
      return 'account credit';
    case 'gift_card':
      return 'a gift card';
    case 'original_payment':
      return 'your original payment method';
    default:
      return '';
  }
}

async function resolveReturn(
  ctx: ServiceContext,
  ref: EmailRecipientRef | undefined,
  site: EmailSite
): Promise<Record<string, unknown>> {
  if (!ref?.returnId) return {};
  const r = await withTenant(ctx, (tx) =>
    tx.returnRequest.findUnique({
      where: { id: ref.returnId! },
      select: {
        status: true,
        preferredOutcome: true,
        refundedAmountCents: true,
        refundIssuedAs: true,
        // BOTH directions, newest first, split below. This relation used to
        // hold one thing — the prepaid label the customer sends the goods back
        // with — and now also holds the replacement travelling the other way.
        // Taking "the newest" without asking which way it points would answer
        // `return.labelUrl` with the replacement's tracking page, sending
        // somebody who wants to post a parcel to a page about one already sent.
        labels: {
          orderBy: { createdAt: 'desc' },
          select: {
            direction: true,
            carrier: true,
            trackingNumber: true,
            trackingUrl: true,
            labelMediaId: true,
          },
        },
      },
    })
  );
  if (!r) return {};
  const label = r.labels.find((row) => row.direction === 'inbound');
  // How the replacement is travelling, read from the ROW rather than taken on
  // trust from the send: a shop can record the tracking number a day after
  // settling the swap, and a snapshot taken at settle time would still say
  // there was none.
  const sent = r.labels.find((row) => row.direction === 'outbound');
  const OUTCOME: Record<string, string> = {
    refund: 'refund',
    account_credit: 'account credit',
    exchange: 'exchange',
    repair: 'repair',
  };
  // The prepaid return label — the carrier's tracking page wins, else the stored
  // label media (the PDF), else the customer's returns page. Built imperatively so
  // precedence is explicit and an empty string never sticks.
  const hasLabel = Boolean(label?.trackingUrl) || Boolean(label?.labelMediaId);
  let labelUrl = site.link('/account/orders');
  if (label?.labelMediaId) labelUrl = mediaUrl(label.labelMediaId, site.slug);
  if (label?.trackingUrl) labelUrl = label.trackingUrl;
  return {
    status: r.status,
    outcome: OUTCOME[r.preferredOutcome] ?? r.preferredOutcome,
    // The refund figure (return-refunded hero); '' until a refund is settled so the
    // optional row self-drops on the approved/received notices.
    refundAmount: r.refundedAmountCents != null ? moneyCents(r.refundedAmountCents) : '',
    refundMethod: refundMethodLabel(r.refundIssuedAs),
    labelUrl,
    hasLabel: hasLabel ? 'yes' : '',
    manageUrl: site.link('/account/orders'),
    // The two ENDING facts are not on the row and cannot be: a return has no
    // column for the replacement that went out, and a denial reason is written to
    // the same `staffNote` an approval uses, so reading it back could not tell a
    // reason meant for a shopper from a note meant for the team. Both ride on the
    // event and the send's snapshot overlays them here (persona issue 448).
    // Empty rather than absent so the optional rows self-drop on the other three
    // notices instead of rendering a raw token.
    replacement: '',
    deniedReason: '',
    // The replacement's journey, which IS on the row: an outbound ReturnLabel
    // written when the parcel went out. Empty until then, which drops the
    // tracking rows rather than printing a heading over a blank.
    // Through the same map the shipping confirmation reads, for the same reason:
    // this column holds a code, and a customer told their replacement went by
    // "usps" is the defect that map was written to end. A courier somebody typed
    // by hand is not a code, so it comes back exactly as they typed it.
    replacementCarrier: carrierLabel(sent?.carrier),
    replacementTracking: sent?.trackingNumber ?? '',
    replacementTrackingUrl: sent?.trackingUrl ?? '',
  };
}

// ── cart ──────────────────────────────────────────────────────────────────

async function resolveCart(
  ctx: ServiceContext,
  ref: EmailRecipientRef | undefined,
  site: EmailSite
): Promise<Record<string, unknown>> {
  const where = ref?.cartId
    ? { id: ref.cartId }
    : ref?.customerId
      ? // Their LIVE basket, so one they have already paid for does not answer.
        // Asked of the completed checkout session rather than `recoveredAt`,
        // which is a recovery and not a purchase (persona issue 289).
        { customerId: ref.customerId, checkoutSessions: { none: { step: 'completed' } } }
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
    recoveryUrl: site.link('/cart'),
    items: cart.items.map((it) => ({
      name: it.variant.product.title,
      quantity: qty(it.quantity),
      unitPrice: moneyCents(it.unitPriceCents),
      lineTotal: moneyCents(it.subtotalCents),
      imageUrl: mediaUrl(it.variant.product.images[0]?.mediaAssetId, site.slug),
    })),
  };
}

// ── quote (a BillingDocument — quotes are billing documents; `ref.quoteId` is
// a billing-document id, kept as its own merge source/ref name so "Quote
// received"/"Quote expiring" templates keep their `{{quote.*}}` merge tags
// distinct from `{{invoice.*}}`) ──────────────────────────────────────────

async function resolveQuote(
  ctx: ServiceContext,
  ref: EmailRecipientRef | undefined,
  site: EmailSite
): Promise<Record<string, unknown>> {
  if (!ref?.quoteId) return {};
  const doc = await withTenant(ctx, (tx) =>
    tx.billingDocument.findUnique({
      where: { id: ref.quoteId! },
      select: {
        number: true,
        status: true,
        total: true,
        validUntil: true,
        companyId: true,
        lines: {
          orderBy: { sortOrder: 'asc' },
          select: { description: true, quantity: true, unitPrice: true, lineTotal: true },
        },
      },
    })
  );
  if (!doc) return {};
  return {
    number: doc.number ?? '',
    status: doc.status,
    total: money(doc.total),
    validUntil: dateLabel(doc.validUntil),
    reviewUrl: doc.companyId
      ? site.link(`/account/b2b/${doc.companyId}/quotes`)
      : site.link('/account'),
    items: doc.lines.map((l) => ({
      name: l.description,
      quantity: qty(l.quantity),
      unitPrice: money(l.unitPrice),
      lineTotal: money(l.lineTotal),
    })),
  };
}

// ── invoice (billing document) ──────────────────────────────────────────────

async function resolveInvoice(
  ctx: ServiceContext,
  ref: EmailRecipientRef | undefined,
  site: EmailSite
): Promise<Record<string, unknown>> {
  if (!ref?.billingDocumentId) return {};
  const [doc, timeZone] = await withTenant(ctx, (tx) =>
    Promise.all([
      tx.billingDocument.findUnique({
        where: { id: ref.billingDocumentId! },
        select: {
          number: true,
          total: true,
          balance: true,
          dueAt: true,
          companyId: true,
          lines: {
            orderBy: { sortOrder: 'asc' },
            select: { description: true, quantity: true, unitPrice: true, lineTotal: true },
          },
        },
      }),
      businessTimeZone(tx, ctx.tenantId),
    ])
  );
  if (!doc) return {};
  // The count the rule that sent this email used: calendar days on the
  // business's clock, through the same `daysPastDue`. This was whole 24-hour
  // periods to noon UTC on the due day, so the "due in 3 days" rule sent an
  // email reading "due in 2 days" from 6pm in Denver (sparx persona issue 141).
  const past = doc.dueAt ? daysPastDue(doc.dueAt, new Date(), timeZone) : null;
  const daysUntilDue = past === null ? '' : String(-past);
  const overdueDays = past === null ? 0 : Math.max(0, past);
  const viewPath = billingDocumentMail.documentViewPath({
    id: ref.billingDocumentId,
    companyId: doc.companyId,
  });
  return {
    number: doc.number ?? '',
    total: money(doc.total),
    balance: money(doc.balance),
    dueDate: dateLabel(doc.dueAt),
    daysUntilDue,
    overdueDays: String(overdueDays),
    // The invoice itself, the page the email that sent it links to; empty when
    // there is none (sparx persona issue 144).
    viewUrl: viewPath ? site.link(viewPath) : '',
    // Kept for an email a business wrote with it. Nothing on the site takes a
    // payment here: it is the trade account's invoice LIST, or the account home.
    payUrl: doc.companyId
      ? site.link(`/account/b2b/${doc.companyId}/invoices`)
      : site.link('/account'),
    items: doc.lines.map((l) => ({
      description: l.description,
      quantity: qty(l.quantity),
      unitPrice: money(l.unitPrice),
      lineTotal: money(l.lineTotal),
    })),
  };
}

// ── company ──────────────────────────────────────────────────────────────

async function resolveB2bAccount(
  ctx: ServiceContext,
  ref: EmailRecipientRef | undefined,
  site: EmailSite
): Promise<Record<string, string>> {
  if (!ref?.companyId) return {};
  const account = await withTenant(ctx, (tx) =>
    tx.company.findUnique({
      where: { id: ref.companyId! },
      select: { companyName: true, status: true, paymentTerms: true, creditLimit: true },
    })
  );
  if (!account) return {};
  return {
    companyName: account.companyName,
    status: account.status,
    paymentTerms: account.paymentTerms ?? '',
    creditLimit: account.creditLimit != null ? money(account.creditLimit) : '',
    portalUrl: site.link(`/account/b2b/${ref.companyId}`),
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
  site: EmailSite
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
    url: site.link(`/products/${p.handle}`),
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

/** The tenant's active modules as a flat truthy map — `{ commerce: 'commerce',
 *  scheduling: '', … }` — the `modules` email source (binding.ts). A module that's on
 *  maps to its own slug (a truthy string); one that's off maps to '' so a
 *  `when('modules.<x>', …)` block self-drops via the standard `hideWhenEmpty` path.
 *  Reads the same `listEnabledModules` the dashboard sidebar does (honours the
 *  BUNDLED_FREE graph, so `invoicing`/`inventory` are on for B2B/Commerce tenants). */
async function resolveModules(ctx: ServiceContext): Promise<Record<string, string>> {
  const enabled = new Set<ModuleSlug>(await listEnabledModules(ctx.tenantId));
  // THE list, not a copy. A hand-maintained duplicate here means a new module's
  // merge tag silently resolves to nothing in every template that reads it.
  const out: Record<string, string> = {};
  for (const m of ALL_MODULES) out[m] = enabled.has(m) ? m : '';
  return out;
}

async function resolveCmsCollection(
  ctx: ServiceContext,
  site: EmailSite,
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
      url: site.link(`/${typeKey === 'blog_post' ? 'blog' : typeKey}/${r.slug ?? ''}`),
      imageUrl: featured ? mediaUrl(featured, site.slug) : '',
      dateLabel: dateLabel(r.publishedAt),
    };
  });
}

// ── Entry point ─────────────────────────────────────────────────────────────

/** Load the named sources into the nested `DataSources` the renderers read. The
 *  shared body behind BOTH the sparx-tree resolver and the silica-document resolver
 *  (docs/120) — they differ only in how they COLLECT the source keys, never in how
 *  the data is fetched, so a silica email and a legacy tree see identical data. */
async function loadEmailSources(
  ctx: ServiceContext,
  keys: Set<string>,
  ref?: EmailRecipientRef,
  propertyId?: string | null,
  origin?: string
): Promise<DataSources> {
  if (keys.size === 0) return {};

  // Any URL-bearing or per-tenant source needs the slug + tenant identity.
  const tenant = await tenantRow(ctx);
  const slug = tenant.slug;
  // The site every link in this email is built on, resolved at most ONCE however
  // many sources build links from it, and not at all for an email that has none.
  let sitePromise: Promise<EmailSite> | null = null;
  const site = (): Promise<EmailSite> => {
    sitePromise ??= (
      origin !== undefined ? Promise.resolve(origin) : resolveEmailSiteOrigin(ctx, ref, propertyId)
    ).then((o) => emailSite(slug, o));
    return sitePromise;
  };

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
      site()
        .then((s) => resolveTenant(ctx, tenant, s, propertyId))
        .then((v) => {
          out.site = v;
          out.tenant = v;
        })
    );
  }
  if (keys.has('order')) {
    tasks.push(
      site()
        .then((s) => resolveOrder(ctx, ref, s))
        .then((v) => void (out.order = v))
    );
  }
  if (keys.has('shipping')) {
    tasks.push(
      site()
        .then((s) => resolveShipping(ctx, ref, s))
        .then((v) => void (out.shipping = v))
    );
  }
  if (keys.has('booking')) {
    tasks.push(
      site()
        .then((s) => resolveBooking(ctx, ref, s))
        .then((v) => void (out.booking = v))
    );
  }
  if (keys.has('waitlist')) {
    tasks.push(
      site()
        .then((s) => resolveWaitlist(ctx, ref, s))
        .then((v) => void (out.waitlist = v))
    );
  }
  if (keys.has('subscription')) {
    tasks.push(
      site()
        .then((s) => resolveSubscription(ctx, ref, s))
        .then((v) => void (out.subscription = v))
    );
  }
  if (keys.has('return')) {
    tasks.push(
      site()
        .then((s) => resolveReturn(ctx, ref, s))
        .then((v) => void (out.return = v))
    );
  }
  if (keys.has('cart')) {
    tasks.push(
      site()
        .then((s) => resolveCart(ctx, ref, s))
        .then((v) => void (out.cart = v))
    );
  }
  if (keys.has('quote')) {
    tasks.push(
      site()
        .then((s) => resolveQuote(ctx, ref, s))
        .then((v) => void (out.quote = v))
    );
  }
  if (keys.has('invoice')) {
    tasks.push(
      site()
        .then((s) => resolveInvoice(ctx, ref, s))
        .then((v) => void (out.invoice = v))
    );
  }
  if (keys.has('b2bAccount')) {
    tasks.push(
      site()
        .then((s) => resolveB2bAccount(ctx, ref, s))
        .then((v) => void (out.b2bAccount = v))
    );
  }
  if (keys.has('loyalty')) {
    tasks.push(resolveLoyalty(ctx, ref).then((v) => void (out.loyalty = v)));
  }
  if (keys.has('commerce.product')) {
    tasks.push(
      site()
        .then((s) => resolveProducts(ctx, s))
        .then((v) => {
          const commerce = (out.commerce as Record<string, unknown>) ?? {};
          commerce.product = v;
          out.commerce = commerce;
        })
    );
  }
  if (keys.has('promotion')) {
    tasks.push(resolvePromotion(ctx).then((v) => void (out.promotion = v)));
  }
  if (keys.has('modules')) {
    tasks.push(resolveModules(ctx).then((v) => void (out.modules = v)));
  }
  for (const key of keys) {
    if (!key.startsWith('cms.')) continue;
    const typeKey = key.slice('cms.'.length);
    tasks.push(
      site()
        .then((s) => resolveCmsCollection(ctx, s, typeKey))
        .then((v) => {
          const cms = (out.cms as Record<string, unknown>) ?? {};
          cms[typeKey] = v;
          out.cms = cms;
        })
    );
  }

  await Promise.all(tasks);
  return out;
}

/** Resolve only the sources a silica `EmailDocument` references — its `data` binding
 *  markers plus the `{{token}}` paths in its copy (`collectSilicaEmailSourceKeys`) —
 *  plus any source named only in `extraStrings` (the subject / preheader). `ref` carries
 *  the send's entity ids for the entity-scoped sources; absent → per-recipient sources
 *  resolve empty (render-once / preview). */
export async function resolveSilicaEmailData(
  ctx: ServiceContext,
  doc: SilicaEmailDocument,
  ref?: EmailRecipientRef,
  extraStrings: string[] = [],
  propertyId?: string | null,
  /** The email's site origin when the caller resolved it already (the send path
   *  does, so the footer shares it); resolved here otherwise. */
  origin?: string
): Promise<DataSources> {
  return loadEmailSources(
    ctx,
    // The branded frame goes round every send, so its own tokens are always
    // looked up, whatever the body mentions (sparx persona issue 143).
    collectSilicaEmailSourceKeys(doc, [...extraStrings, ...EMAIL_FRAME_TOKENS]),
    ref,
    propertyId,
    origin
  );
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

/** The resolver callback bound to a request's context — what the broadcast send path,
 *  the dispatch tick, and the editor preview inject so @wizeworks/email-platform resolves
 *  email data without a @wizeworks/commerce dependency (docs/52 §6). `boundPropertyId`
 *  scopes `{{tenant.name}}` to the active site for callers that know the site at
 *  injection time (preview/test-send pass `ctx.propertyId`); a per-call `propertyId`
 *  lets a caller that learns the site later override it (the broadcast send path passes
 *  `broadcast.propertyId`). Absent → tenant-level, unchanged for single-site tenants. */
export function silicaEmailDataResolver(ctx: ServiceContext, boundPropertyId?: string | null) {
  return (
    doc: SilicaEmailDocument,
    ref?: EmailRecipientRef,
    propertyId?: string | null
  ): Promise<DataSources> =>
    resolveSilicaEmailData(ctx, doc, ref, undefined, propertyId ?? boundPropertyId);
}
