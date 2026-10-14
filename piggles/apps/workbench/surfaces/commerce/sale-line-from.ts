// A new line on a sale at the counter, from something on her list or typed in.
// Moved out of sale-detail.tsx unchanged (sparx persona issue 230).

import type { SaleLine, Sellable } from './sale-data';

export function lineFrom(sellable: Sellable | null): SaleLine {
  const id = `l_${crypto.randomUUID().slice(0, 8)}`;
  if (!sellable) {
    return {
      id,
      name: '',
      quantity: 1,
      price: '0.00',
      sku: 'ITEM',
      productId: null,
      variantId: null,
      orderAheadDays: null,
      // Her own words and her own number from the first keystroke. Nothing in
      // the catalog to price, so nothing will ever overwrite it.
      priceTouched: true,
    };
  }
  return {
    id,
    // The version is half the name at a counter: two Marlow Knits on one sale
    // are two identical lines without it (issue 182 gave the picker this ladder
    // and the line dropped it again).
    name: sellable.detail ? `${sellable.name} · ${sellable.detail}` : sellable.name,
    quantity: 1,
    price: (sellable.priceCents / 100).toFixed(2),
    sku: sellable.sku,
    productId: sellable.productId ?? null,
    variantId: sellable.variantId ?? null,
    orderAheadDays: sellable.orderAheadDays ?? null,
    priceTouched: false,
    ...(sellable.deposit ? { deposit: sellable.deposit } : {}),
    // Paying the core deposit is the default, as it is on the website (sparx
    // issue 061): nobody waits on a part for a choice they never saw made.
    ...(sellable.core ? { core: sellable.core, coreFirst: false } : {}),
  };
}
