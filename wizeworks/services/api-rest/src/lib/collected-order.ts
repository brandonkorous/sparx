// Whether an order is collected: taken at the counter or fetched by the buyer,
// never sent. The account pages and the trade portal both say "Collected" for it,
// so they read it from one place (sparx persona issue 177).

import { COLLECTION_RATE_REF } from '@wizeworks/commerce';

export function isCollectedOrder(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false;
  return (metadata as Record<string, unknown>).shippingRateRef === COLLECTION_RATE_REF;
}
