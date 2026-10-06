'use client';

// How an order leaves: posted, or collected in person.

import type { Order } from './order-types';

/** The rate ref checkout writes when a shopper chooses to come and get it.
 *  Mirrors COLLECTION_RATE_REF in @wizeworks/commerce (collection-option.ts);
 *  copied rather than imported because that package is server-side and would
 *  drag Prisma into the browser bundle. */
const COLLECTION_RATE_REF = 'collection:in-person';

export interface DeliveryPlan {
  /** True when the customer is coming to fetch it -- so there is nothing to
   *  post, no carrier to name, and no warehouse walk that makes sense. */
  collected: boolean;
  /** What the shopper chose, in their words. Null when the order predates
   *  checkout recording it, which is NOT the same as "collection" -- an old
   *  order with no record must not be presented as one or the other. */
  description: string | null;
}

/**
 * How this order leaves, according to what the shopper picked at checkout.
 *
 * Reads the metadata checkout froze on. `collected` is deliberately keyed on
 * the RATE REF rather than the absence of a shipping address: a collection
 * order still carries an address (it is the billing address, and the shop may
 * well want it), so "no address" would call every one of them a despatch.
 */
export function deliveryPlan(order: Order): DeliveryPlan {
  const meta = order.metadata ?? {};
  const ref = typeof meta.shippingRateRef === 'string' ? meta.shippingRateRef : null;
  const described =
    typeof meta.shippingDescription === 'string' && meta.shippingDescription.trim()
      ? meta.shippingDescription.trim()
      : null;
  return { collected: ref === COLLECTION_RATE_REF, description: described };
}
