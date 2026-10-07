// What a subscription is worth per month, for the CRM mirror's deal value.

import type Stripe from 'stripe';

/**
 * The subscription's total recurring revenue normalized to ONE MONTH, in cents.
 *
 * Normalizing here (rather than in the consumer) means every reader gets a
 * comparable number: an annual plan reports its monthly equivalent, so a CRM
 * board summing deal values isn't mixing yearly and monthly figures. Metered
 * items carry no unit_amount and are skipped — usage isn't recurring revenue
 * until it's billed. Returns null when nothing was computable.
 */
export function monthlyRecurringCents(sub: Stripe.Subscription): number | null {
  let total = 0;
  let counted = 0;

  for (const item of sub.items.data) {
    const amount = item.price.unit_amount;
    if (amount === null || amount === undefined) continue;
    const recurring = item.price.recurring;
    if (!recurring) continue;

    const every = recurring.interval_count > 0 ? recurring.interval_count : 1;
    const perMonth =
      recurring.interval === 'month'
        ? 1 / every
        : recurring.interval === 'year'
          ? 1 / (12 * every)
          : recurring.interval === 'week'
            ? 52 / 12 / every
            : // daily
              365 / 12 / every;

    total += amount * (item.quantity ?? 1) * perMonth;
    counted++;
  }

  return counted === 0 ? null : Math.round(afterLastingDiscount(total, sub.discount?.coupon));
}

/** A discount kept for the life of the subscription lowers what it is worth each
 *  month. One that runs out does not: that revenue comes back on its own. */
function afterLastingDiscount(monthly: number, coupon: Stripe.Coupon | null | undefined): number {
  if (coupon?.duration !== 'forever') return monthly;
  if (coupon.percent_off) return monthly * (1 - coupon.percent_off / 100);
  return Math.max(0, monthly - (coupon.amount_off ?? 0));
}
