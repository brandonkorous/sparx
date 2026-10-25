// Boot-time billing checks, so a broken offer is a log line at deploy, not a silent banner.

import type { FastifyBaseLogger } from 'fastify';
import { listBillingPlans, missingOfferCoupons } from '@wizeworks/billing';

/** Loads BILLING_PLANS now, so a bad value fails the rollout instead of the first checkout. */
export function loadBillingPlansAtBoot(): number {
  return listBillingPlans().length;
}

/** Logs every plan offer whose coupon Stripe lacks (WW-4); never fails the boot. */
export async function checkOfferCoupons(log: FastifyBaseLogger): Promise<string[]> {
  try {
    const missing = await missingOfferCoupons(listBillingPlans());
    if (missing.length) log.error({ missing }, 'billing: offer coupons missing in Stripe');
    return missing;
  } catch (err) {
    log.warn({ err }, 'billing: could not check offer coupons at boot');
    return [];
  }
}
