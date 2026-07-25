// Operator billing operations (docs/apps/admin/build-plan.md §5 Slice 4) — the
// cross-tenant billing surface the WizeWorks operator console drives through the
// PLATFORM Stripe account (the same account @sparx/billing uses to charge tenants
// for modules — never a tenant's own Connect account).
//
// Every function is guarded by `getBillingStripe()`: when the platform Stripe key
// is unset (dev, and prod before the billing ops land) reads return empty and
// writes throw a clear "not configured" error — so nothing here can move money
// until billing is deliberately switched on. Stripe is the source of truth; these
// are thin, typed wrappers, not a parallel billing engine.

import type Stripe from 'stripe';

import { getBillingStripe } from './client';

// ── Result shapes (wire-compatible with @sparx/operator's billing DTOs) ───────

export interface PlatformStripeEvent {
  id: string;
  type: string;
  createdAt: string;
}

export interface PlatformCharge {
  id: string;
  amountCents: number;
  amountRefundedCents: number;
  currency: string;
  /** succeeded | pending | failed. */
  status: string;
  created: string;
  description: string | null;
  paymentIntentId: string | null;
  receiptUrl: string | null;
  /** Fully refunded already — the UI disables further refunds. */
  refunded: boolean;
}

export interface PlatformCoupon {
  id: string;
  name: string | null;
  percentOff: number | null;
  amountOffCents: number | null;
  currency: string | null;
  /** forever | once | repeating. */
  duration: string;
  durationInMonths: number | null;
  timesRedeemed: number;
  valid: boolean;
}

export type RefundReason = 'duplicate' | 'fraudulent' | 'requested_by_customer';

export interface RefundInput {
  chargeId: string;
  /** Partial refund amount in cents; omit for a full refund. */
  amountCents?: number;
  reason?: RefundReason;
}

export interface RefundResult {
  id: string;
  status: string;
  amountCents: number;
}

export interface CreateCouponInput {
  name: string;
  percentOff?: number;
  amountOffCents?: number;
  currency?: string;
  duration: 'forever' | 'once' | 'repeating';
  durationInMonths?: number;
}

/** A customer-facing promotion code — the typeable string (`LAUNCH50`) a tenant
 *  redeems in the Checkout discount box, layered on a coupon. `customerId` locks it
 *  to one tenant's Stripe customer (tenant-targeted); null means any tenant (public). */
export interface PlatformPromotionCode {
  id: string;
  code: string;
  couponId: string;
  couponName: string | null;
  active: boolean;
  customerId: string | null;
  maxRedemptions: number | null;
  timesRedeemed: number;
  /** ISO expiry, or null for no expiry. */
  expiresAt: string | null;
  firstTimeOnly: boolean;
  minimumAmountCents: number | null;
}

export interface CreatePromotionCodeInput {
  /** The coupon this code redeems (created via createPlatformCoupon). */
  couponId: string;
  /** The customer-facing code; Stripe generates one if omitted. Case-insensitive. */
  code?: string;
  /** A tenant's Stripe customer id — lock the code to that one tenant. Omit = public. */
  customerId?: string;
  maxRedemptions?: number;
  /** ISO date; the code stops working after this. */
  expiresAt?: string;
  /** Only redeemable by a customer with no prior successful payment/invoice. */
  firstTimeOnly?: boolean;
  minimumAmountCents?: number;
  currency?: string;
}

export interface EnterpriseInvoiceLine {
  description: string;
  amountCents: number;
}

export interface CreateInvoiceInput {
  customerId: string;
  lines: EnterpriseInvoiceLine[];
  daysUntilDue?: number;
  memo?: string;
  /** Finalize immediately (issue the invoice) vs. leave a draft. */
  autoFinalize: boolean;
}

export interface InvoiceResult {
  id: string;
  status: string;
  totalCents: number;
  hostedInvoiceUrl: string | null;
}

class BillingNotConfiguredError extends Error {
  readonly code = 'BILLING_NOT_CONFIGURED' as const;
  constructor() {
    super('Platform billing is not configured (STRIPE_SECRET_KEY unset).');
  }
}

function requireStripe(): Stripe {
  const stripe = getBillingStripe();
  if (!stripe) throw new BillingNotConfiguredError();
  return stripe;
}

function clampLimit(limit: number, max = 100): number {
  if (!Number.isFinite(limit)) return 25;
  return Math.min(max, Math.max(1, Math.trunc(limit)));
}

function isoFromUnix(seconds: number): string {
  return new Date(seconds * 1000).toISOString();
}

// ── Reads (empty when unconfigured) ──────────────────────────────────────────

/** Recent platform Stripe events — the webhook log viewer. Platform billing
 *  webhooks aren't persisted (fire-and-forget reconcile), so this reads Stripe's
 *  own event feed (retained ~30 days). */
export async function listPlatformStripeEvents(limit = 25): Promise<PlatformStripeEvent[]> {
  const stripe = getBillingStripe();
  if (!stripe) return [];
  const res = await stripe.events.list({ limit: clampLimit(limit) });
  return res.data.map((e) => ({ id: e.id, type: e.type, createdAt: isoFromUnix(e.created) }));
}

/** A tenant's recent platform charges (money sparx collected from the tenant) —
 *  the source list an operator refunds from. Empty when the tenant has no Stripe
 *  customer or billing is unconfigured. */
export async function listTenantCharges(customerId: string, limit = 20): Promise<PlatformCharge[]> {
  const stripe = getBillingStripe();
  if (!stripe) return [];
  const res = await stripe.charges.list({ customer: customerId, limit: clampLimit(limit) });
  return res.data.map(toCharge);
}

/** Every platform coupon (discounts on a tenant's sparx bill). */
export async function listPlatformCoupons(limit = 100): Promise<PlatformCoupon[]> {
  const stripe = getBillingStripe();
  if (!stripe) return [];
  const res = await stripe.coupons.list({ limit: clampLimit(limit) });
  return res.data.map(toCoupon);
}

/** Every platform promotion code (the typeable strings tenants redeem at checkout),
 *  optionally filtered to one coupon. Expands the coupon so each row carries its
 *  name. Empty when unconfigured. */
export async function listPromotionCodes(couponId?: string): Promise<PlatformPromotionCode[]> {
  const stripe = getBillingStripe();
  if (!stripe) return [];
  const res = await stripe.promotionCodes.list({
    limit: 100,
    expand: ['data.coupon'],
    ...(couponId ? { coupon: couponId } : {}),
  });
  return res.data.map(toPromotionCode);
}

// ── Writes (throw when unconfigured) ─────────────────────────────────────────

/** Refund a platform charge, fully or partially. */
export async function refundCharge(input: RefundInput): Promise<RefundResult> {
  const stripe = requireStripe();
  const refund = await stripe.refunds.create({
    charge: input.chargeId,
    ...(input.amountCents !== undefined ? { amount: input.amountCents } : {}),
    ...(input.reason ? { reason: input.reason } : {}),
  });
  return { id: refund.id, status: refund.status ?? 'unknown', amountCents: refund.amount };
}

export async function createPlatformCoupon(input: CreateCouponInput): Promise<PlatformCoupon> {
  const stripe = requireStripe();
  const coupon = await stripe.coupons.create({
    name: input.name,
    duration: input.duration,
    ...(input.durationInMonths !== undefined ? { duration_in_months: input.durationInMonths } : {}),
    ...(input.percentOff !== undefined ? { percent_off: input.percentOff } : {}),
    ...(input.amountOffCents !== undefined
      ? { amount_off: input.amountOffCents, currency: input.currency ?? 'usd' }
      : {}),
  });
  return toCoupon(coupon);
}

export async function deletePlatformCoupon(id: string): Promise<void> {
  const stripe = requireStripe();
  await stripe.coupons.del(id);
}

/** Mint a promotion code off an existing coupon — the string a tenant types in the
 *  Checkout discount box. Pass `customerId` to lock it to one tenant, or omit for a
 *  public code. Restrictions (expiry, redemption cap, first-time-only, minimum) are
 *  enforced by Stripe at redemption time. */
export async function createPromotionCode(
  input: CreatePromotionCodeInput
): Promise<PlatformPromotionCode> {
  const stripe = requireStripe();
  const restrictions: Stripe.PromotionCodeCreateParams.Restrictions = {};
  if (input.firstTimeOnly) restrictions.first_time_transaction = true;
  if (input.minimumAmountCents !== undefined) {
    restrictions.minimum_amount = input.minimumAmountCents;
    restrictions.minimum_amount_currency = input.currency ?? 'usd';
  }
  const created = await stripe.promotionCodes.create({
    coupon: input.couponId,
    ...(input.code ? { code: input.code } : {}),
    ...(input.customerId ? { customer: input.customerId } : {}),
    ...(input.maxRedemptions !== undefined ? { max_redemptions: input.maxRedemptions } : {}),
    ...(input.expiresAt
      ? { expires_at: Math.floor(new Date(input.expiresAt).getTime() / 1000) }
      : {}),
    ...(Object.keys(restrictions).length > 0 ? { restrictions } : {}),
    expand: ['coupon'],
  });
  return toPromotionCode(created);
}

/** Deactivate a promotion code. Stripe promotion codes can't be deleted, only
 *  turned off (`active: false`) — a deactivated code can't be reactivated. */
export async function deactivatePromotionCode(id: string): Promise<PlatformPromotionCode> {
  const stripe = requireStripe();
  const updated = await stripe.promotionCodes.update(id, { active: false });
  return toPromotionCode(updated);
}

/** Author (and optionally finalize) a manual invoice against a tenant's platform
 *  Stripe customer — the enterprise-invoice path (custom-priced tenants, docs/92). */
export async function createEnterpriseInvoice(input: CreateInvoiceInput): Promise<InvoiceResult> {
  const stripe = requireStripe();
  for (const line of input.lines) {
    await stripe.invoiceItems.create({
      customer: input.customerId,
      amount: line.amountCents,
      currency: 'usd',
      description: line.description,
    });
  }
  const invoice = await stripe.invoices.create({
    customer: input.customerId,
    collection_method: 'send_invoice',
    days_until_due: input.daysUntilDue ?? 30,
    auto_advance: input.autoFinalize,
    ...(input.memo ? { description: input.memo } : {}),
  });
  const issued =
    input.autoFinalize && invoice.id ? await stripe.invoices.finalizeInvoice(invoice.id) : invoice;
  return {
    id: issued.id ?? '',
    status: issued.status ?? 'draft',
    totalCents: issued.total ?? 0,
    hostedInvoiceUrl: issued.hosted_invoice_url ?? null,
  };
}

function toCharge(c: Stripe.Charge): PlatformCharge {
  return {
    id: c.id,
    amountCents: c.amount,
    amountRefundedCents: c.amount_refunded,
    currency: c.currency,
    status: c.status,
    created: isoFromUnix(c.created),
    description: c.description ?? null,
    paymentIntentId:
      typeof c.payment_intent === 'string' ? c.payment_intent : (c.payment_intent?.id ?? null),
    receiptUrl: c.receipt_url ?? null,
    refunded: c.refunded,
  };
}

function toPromotionCode(p: Stripe.PromotionCode): PlatformPromotionCode {
  const coupon = p.coupon;
  return {
    id: p.id,
    code: p.code,
    couponId: typeof coupon === 'string' ? coupon : coupon.id,
    couponName: typeof coupon === 'string' ? null : (coupon.name ?? null),
    active: p.active,
    customerId: typeof p.customer === 'string' ? p.customer : (p.customer?.id ?? null),
    maxRedemptions: p.max_redemptions ?? null,
    timesRedeemed: p.times_redeemed,
    expiresAt: p.expires_at ? isoFromUnix(p.expires_at) : null,
    firstTimeOnly: p.restrictions.first_time_transaction,
    minimumAmountCents: p.restrictions.minimum_amount ?? null,
  };
}

function toCoupon(c: Stripe.Coupon): PlatformCoupon {
  return {
    id: c.id,
    name: c.name ?? null,
    percentOff: c.percent_off ?? null,
    amountOffCents: c.amount_off ?? null,
    currency: c.currency ?? null,
    duration: c.duration,
    durationInMonths: c.duration_in_months ?? null,
    timesRedeemed: c.times_redeemed,
    valid: c.valid,
  };
}
