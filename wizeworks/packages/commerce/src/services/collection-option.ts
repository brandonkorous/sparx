// Collecting in person — the fulfilment every business with a counter already has.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
//
// A tenant that has never opened Postage and delivery has no zones and no rates,
// and that is the TRUTH about them: they have not told us they post things.
//
// The platform used to answer that silence by inventing a delivery — one
// "Everywhere" zone (empty `countries`, so it matches every address on earth),
// one flat rate, five US dollars, five days — purely so checkout had something
// to quote. It bought a working checkout with a promise the business had never
// made. A collection-only bakery, six days a week over the counter, was set up
// to post a sourdough loaf to another country for five dollars in a currency she
// does not trade in (issue #031). Nothing stopped a stranger paying for it, and
// she would have found the order after it was taken.
//
// The honest answer to "we do not know how you deliver" is not a delivery. It is
// the one thing a shop, a café, a bakery, a barber and a takeaway can all do:
// the customer comes and collects. It invents no carrier, no price and no
// currency, it costs the business nothing, and it cannot produce an order that
// cannot be fulfilled.
//
// ── WHEN IT IS OFFERED ──────────────────────────────────────────────────────
//
// Only while NO delivery has been set up at all — zero zones, the same condition
// the old bootstrap used to test before seeding. The moment a tenant creates
// their first zone they have said how they deliver, and this stops answering on
// their behalf.

import type { RateOption } from '@wizeworks/commerce-schemas';

/** Stable, deterministic, and survives a re-quote — `submitShipping` re-prices
 *  every choice server-side and matches it by this ref. */
export const COLLECTION_RATE_REF = 'collection:in-person';

/** Not a carrier. Reads as one in the data so nothing downstream has to special-
 *  case a null provider, and it is the flag `isCollection` matches on. */
export const COLLECTION_PROVIDER_SLUG = 'collection';

/** The words a shopper reads at checkout. A whole phrase, not a service code. */
export const COLLECTION_SERVICE = 'Collect in person';

const COLLECTION_CARRIER = 'Collection';

/** Free, always. Charging for collection is a decision a business makes on
 *  purpose, and a default that invents a price is what got us here. */
export function collectionOption(currency: string): RateOption {
  return {
    rateRef: COLLECTION_RATE_REF,
    providerSlug: COLLECTION_PROVIDER_SLUG,
    carrier: COLLECTION_CARRIER,
    service: COLLECTION_SERVICE,
    amountCents: 0,
    currency,
    isFreight: false,
  };
}

export function isCollection(option: Pick<RateOption, 'providerSlug'>): boolean {
  return option.providerSlug === COLLECTION_PROVIDER_SLUG;
}

/**
 * How an order records the choice.
 *
 * "Collect in person" is already a whole sentence, so the usual
 * `${carrier} ${service}` would put "Collection Collect in person" on the order
 * and in the confirmation email.
 */
export function describeRate(option: Pick<RateOption, 'providerSlug' | 'carrier' | 'service'>) {
  return isCollection(option) ? option.service : `${option.carrier} ${option.service}`.trim();
}
