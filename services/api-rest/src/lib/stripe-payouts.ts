// Real Stripe payout objects for sparx Pay (docs/94, docs/110 GAP A).
//
// The Finance → Payouts view is DERIVED for most funding sources (captured payments
// grouped into capture + 2 days — see routes/v1/finance/payouts.ts). That approximation
// never matches the bank: it can't see Stripe's real payout batching, its fees, refund
// clawbacks, or the true arrival date. For sparx Pay we own the connected Express
// account, so we can read Stripe's ACTUAL `payout` objects — the exact amount, arrival
// date, and status that hit the merchant's bank.
//
// A Stripe payout is ACCOUNT-LEVEL: one bank per connected account, settling money from
// every site at once. So this path is intentionally NOT site-scoped — a deposit is not a
// per-site thing. The derived model remains the site-attributable fallback and covers the
// non-sparx-Pay processors (manual/paypal/square/…). The caller falls back to derived on
// ANY error here, so the payouts view can never 500 on a Stripe hiccup.

import type Stripe from 'stripe';

import { getPlatformStripe } from '@sparx/payments';
import { prisma, withTenant } from '@sparx/db';

export interface ConnectedPayout {
  id: string; // Stripe payout id (po_…)
  processor: 'sparx_pay';
  arrivalDate: string; // YYYY-MM-DD
  currency: string;
  amount: number; // dollars
  status: string; // paid | in_transit | pending | in_transit | canceled | failed
  /** Present only in the detail — the list omits it (a per-payout balance-transaction
   *  expansion per row would be N+1 Stripe calls). */
  salesCount?: number;
}

export interface ConnectedPayoutSale {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  customerName: string | null;
  channel: string | null;
  source: string | null;
  amount: number;
  currency: string;
}

export interface ConnectedPayoutDetail extends ConnectedPayout {
  salesCount: number;
  sales: ConnectedPayoutSale[];
}

/** The tenant's sparx Pay connected account id from the root `tenant.stripeAccountId`
 *  column — the SAME source `getPaymentConfig` / the sparx-Pay balance + status endpoints
 *  resolve (payments-onboarding.ts `tenantAccountId`), so payouts read the exact account
 *  the rest of the finance surface reports. Returns null when the tenant has never onboarded
 *  a connected account, signalling the caller to fall back to the derived model. */
async function connectedAccountId(tenantId: string): Promise<string | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { stripeAccountId: true },
  });
  return tenant?.stripeAccountId ?? null;
}

/** Stripe payout ids are `po_…`; the derived model's ids are `<processor>~<date>`. */
export function isStripePayoutId(id: string): boolean {
  return id.startsWith('po_');
}

function arrivalDay(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

/** Whether sparx Pay real payouts are available for this tenant (platform key present
 *  AND a connected account exists). When false the caller uses the derived model. */
export async function hasConnectedPayouts(tenantId: string): Promise<boolean> {
  if (!getPlatformStripe()) return false;
  return (await connectedAccountId(tenantId)) !== null;
}

/** Real Stripe payouts on the tenant's sparx Pay connected account, newest first.
 *  Returns null when sparx Pay isn't usable (no platform key / no connected account),
 *  signalling the caller to fall back to the derived model. Bounded to `limit` (Stripe's
 *  page max is 100) — the list view pages a recent window, not the whole history. */
export async function listConnectedPayouts(
  tenantId: string,
  limit = 100
): Promise<ConnectedPayout[] | null> {
  const stripe = getPlatformStripe();
  if (!stripe) return null;
  const accountId = await connectedAccountId(tenantId);
  if (!accountId) return null;

  const res = await stripe.payouts.list(
    { limit: Math.min(Math.max(limit, 1), 100) },
    { stripeAccount: accountId }
  );
  return res.data.map((p) => ({
    id: p.id,
    processor: 'sparx_pay' as const,
    arrivalDate: arrivalDay(p.arrival_date),
    currency: p.currency.toUpperCase(),
    amount: centsToDollars(p.amount),
    status: p.status,
  }));
}

/** Pull the charge/PaymentIntent references a payout settled, from its balance
 *  transactions. Our captured OrderPayment stores the PaymentIntent id in
 *  `processorRef`, so a charge's `payment_intent` is the join key (with the charge id as
 *  a fallback). Best-effort: destination-charge settlement can surface as different
 *  balance-transaction shapes, so anything we can't resolve to a ref is simply skipped —
 *  the payout's own amount/date/status remain the source of truth regardless. */
function chargeRefsFromTxns(txns: Stripe.BalanceTransaction[]): string[] {
  const refs = new Set<string>();
  for (const t of txns) {
    if (t.type !== 'charge' && t.type !== 'payment') continue;
    const src = t.source;
    if (src && typeof src === 'object' && 'object' in src && src.object === 'charge') {
      const charge = src;
      const pi =
        typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : (charge.payment_intent?.id ?? null);
      if (pi) refs.add(pi);
      refs.add(charge.id);
    } else if (typeof src === 'string') {
      refs.add(src);
    }
  }
  return [...refs];
}

/** One real Stripe payout + the sales it settled. Returns null when sparx Pay isn't
 *  usable so the caller falls back to the derived detail. The settled-sales list is
 *  best-effort (see chargeRefsFromTxns); the header figures are Stripe's real truth. */
export async function getConnectedPayout(
  tenantId: string,
  payoutId: string
): Promise<ConnectedPayoutDetail | null> {
  const stripe = getPlatformStripe();
  if (!stripe) return null;
  const accountId = await connectedAccountId(tenantId);
  if (!accountId) return null;

  const payout = await stripe.payouts.retrieve(payoutId, { stripeAccount: accountId });
  const txns = await stripe.balanceTransactions.list(
    { payout: payoutId, limit: 100, expand: ['data.source'] },
    { stripeAccount: accountId }
  );

  const refs = chargeRefsFromTxns(txns.data);
  const sales: ConnectedPayoutSale[] = refs.length
    ? await withTenant({ tenantId }, async (tx) => {
        const payments = await tx.orderPayment.findMany({
          where: { processorRef: { in: refs } },
          select: {
            id: true,
            amount: true,
            currency: true,
            order: {
              select: {
                id: true,
                orderNumber: true,
                channel: true,
                source: true,
                customer: {
                  select: { firstName: true, lastName: true, companyName: true, email: true },
                },
              },
            },
          },
        });
        return payments.map((p) => {
          const c = p.order?.customer;
          // First non-blank of person name → company → email. A customer row can carry
          // an empty string as readily as a null, so blank-after-trim has to lose too.
          const name =
            [[c?.firstName, c?.lastName].filter(Boolean).join(' '), c?.companyName, c?.email]
              .map((v) => v?.trim())
              .find((v) => v) ?? null;
          return {
            paymentId: p.id,
            orderId: p.order?.id ?? '',
            orderNumber: p.order?.orderNumber ?? '—',
            customerName: name,
            channel: p.order?.channel ?? null,
            source: p.order?.source ?? null,
            amount: Number(p.amount),
            currency: p.currency,
          };
        });
      })
    : [];

  return {
    id: payout.id,
    processor: 'sparx_pay',
    arrivalDate: arrivalDay(payout.arrival_date),
    currency: payout.currency.toUpperCase(),
    amount: centsToDollars(payout.amount),
    status: payout.status,
    salesCount: sales.length,
    sales,
  };
}
