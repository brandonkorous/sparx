// Which option is chosen when a buyer who asked to have an order SENT sees how it
// can reach them (sparx persona issue 222). The options come cheapest first, and
// collecting is free, so taking the first chose collection for somebody who had
// just picked an address. Collecting stays on the list and behind its own button.

import { isCollectionRate, type ShippingRate } from './checkout-client';

export function deliveryDefault<T extends Pick<ShippingRate, 'providerSlug'>>(
  rates: readonly T[]
): T | null {
  return rates.find((rate) => !isCollectionRate(rate)) ?? rates[0] ?? null;
}
