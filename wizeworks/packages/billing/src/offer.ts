// A plan's introductory offer (plans.ts `offer`): how much of it is left, and
// the discount a checkout should carry while any is.
//
// Stripe is the counter. The coupon's `max_redemptions` is enforced by Stripe at
// the moment a subscription is born, so two people taking the last place at once
// cannot both get it — a count kept on our side could not promise that.

import type Stripe from 'stripe';

import { getBillingStripe } from './client';
import type { BillingPlan, PlanOffer } from './plans';

export interface OfferStanding {
  coupon: string;
  amountOffCents: number;
  limit: number;
  /** Places still open. Zero once the limit is reached or the coupon is gone. */
  remaining: number;
}

/** The coupon as Stripe holds it, or null when it does not exist there. */
async function retrieveCoupon(stripe: Stripe, id: string): Promise<Stripe.Coupon | null> {
  try {
    return await stripe.coupons.retrieve(id);
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode === 404) return null;
    throw err;
  }
}

/** What is left of one offer, read from the coupon itself. */
function standingOf(offer: PlanOffer, coupon: Stripe.Coupon | null): OfferStanding {
  const limit = coupon?.max_redemptions ?? offer.limit;
  const open = coupon?.valid ? Math.max(0, limit - coupon.times_redeemed) : 0;
  return {
    coupon: offer.coupon,
    amountOffCents: coupon?.amount_off ?? offer.amountOffCents,
    limit,
    remaining: open,
  };
}

/**
 * How much of a plan's offer is left. Null when the plan has no offer or its
 * Stripe account is not wired — there is nothing to report, which is different
 * from an offer that has run out (`remaining: 0`).
 */
export async function offerStanding(plan: BillingPlan): Promise<OfferStanding | null> {
  if (!plan.offer) return null;
  const stripe = getBillingStripe(plan);
  if (!stripe) return null;
  return standingOf(plan.offer, await retrieveCoupon(stripe, plan.offer.coupon));
}

/** The discount a new subscription should carry, or undefined once none is left. */
export async function openOfferDiscount(
  stripe: Stripe,
  plan: BillingPlan
): Promise<Stripe.Checkout.SessionCreateParams.Discount[] | undefined> {
  if (!plan.offer) return undefined;
  const standing = standingOf(plan.offer, await retrieveCoupon(stripe, plan.offer.coupon));
  return standing.remaining > 0 ? [{ coupon: plan.offer.coupon }] : undefined;
}

export interface HeldDiscount {
  coupon: string;
  amountOffCents: number;
}

/** The fixed-amount discount a tenant's live subscription carries, read from
 *  Stripe, or null when it carries none (or there is no subscription yet). */
export async function heldDiscount(
  plan: BillingPlan,
  subscriptionId: string | null
): Promise<HeldDiscount | null> {
  const stripe = getBillingStripe(plan);
  if (!stripe || !subscriptionId) return null;
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const coupon = sub.discount?.coupon;
  if (!coupon?.amount_off) return null;
  return { coupon: coupon.id, amountOffCents: coupon.amount_off };
}

/** True when Stripe refused a session because the coupon ran out between our
 *  read and its create — the last place, taken by somebody else a moment ago. */
export function isSpentCouponError(err: unknown): boolean {
  const e = err as { type?: string; code?: string; param?: string };
  return e.type === 'StripeInvalidRequestError' && (e.param ?? '').startsWith('discounts');
}
