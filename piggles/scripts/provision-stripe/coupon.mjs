// The plan's introductory offer as a Stripe coupon: a fixed amount off the base
// price, kept for as long as the subscription runs, for the first `limit`.

import { couponNameFor } from './copy.mjs';
import { DRY_RUN, log, money } from './env.mjs';

/** The terms Stripe will not let us change once a coupon exists. */
function termsDiffer(coupon, offer) {
  return (
    coupon.amount_off !== offer.amountOffCents ||
    coupon.currency !== 'usd' ||
    coupon.duration !== 'forever' ||
    coupon.max_redemptions !== offer.limit
  );
}

async function findCoupon(stripe, id) {
  try {
    return await stripe.get(`/coupons/${id}`);
  } catch (err) {
    if (err.code === 'resource_missing') return null;
    throw err;
  }
}

/** Find-or-create the offer's coupon. A coupon whose terms disagree with the plan
 *  stops the run: Stripe cannot edit them, and quietly keeping the old ones would
 *  sell one price on the page and charge another. */
export async function ensureOfferCoupon(stripe, plan) {
  const offer = plan.offer;
  if (!offer) return log('  coupon  -  none: the plan has no offer');
  const label = `${offer.coupon} (${money(offer.amountOffCents)} off, first ${offer.limit})`;
  const existing = await findCoupon(stripe, offer.coupon);
  if (existing && termsDiffer(existing, offer)) {
    throw new Error(
      `Coupon ${offer.coupon} exists with different terms. Delete it in Stripe (places already taken keep their discount), then re-run.`
    );
  }
  if (existing) return log(`  coupon  ok ${label}, ${existing.times_redeemed} taken`);
  if (DRY_RUN) return log(`  coupon  +  ${label} [dry-run]`);
  await stripe.post('/coupons', {
    id: offer.coupon,
    name: couponNameFor(offer.coupon),
    amount_off: offer.amountOffCents,
    currency: 'usd',
    duration: 'forever',
    max_redemptions: offer.limit,
    applies_to: { products: [plan.base.product] },
    metadata: { piggles_managed: 'true' },
  });
  log(`  coupon  +  ${label}`);
}
