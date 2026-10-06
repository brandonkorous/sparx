// The words the sample-data screen puts on a Remove.
//
// Remove leaves sample LOCATIONS standing on purpose (issue 174): an owner may
// have renamed one and counted real stock into it. So the one count that stays
// must never reach anything that says "removes". `countsTotal` feeds the
// "is anything here" test and `summarizeCounts` writes the confirmation and the
// toast; if either folded locations in, the confirmation would promise to delete
// a place the server will not touch, and a screen whose only sample rows are the
// kept locations would claim there was something left to remove.

import { describe, expect, it } from 'vitest';

import { countsTotal, durableTotal, summarizeCounts } from './counts';
import type { SampleDataCounts } from './data';

const NONE: SampleDataCounts = {
  warehouses: 0,
  products: 0,
  collections: 0,
  categories: 0,
  articles: 0,
  customers: 0,
  orders: 0,
  returns: 0,
  reviews: 0,
  questions: 0,
  bookings: 0,
  services: 0,
  resources: 0,
  deals: 0,
  tickets: 0,
  billingDocuments: 0,
  bundles: 0,
  movements: 0,
  images: 0,
  aiPrompts: 0,
  toolCalls: 0,
};

describe('services and people are counted, because Remove takes them (issue 085)', () => {
  it('adds them to the removable total', () => {
    expect(countsTotal({ ...NONE, services: 7, resources: 6 })).toBe(13);
  });
});

describe('sample locations are kept, never "removed"', () => {
  it('leaves them out of the removable total', () => {
    expect(countsTotal({ ...NONE, warehouses: 2 })).toBe(0);
    expect(countsTotal({ ...NONE, warehouses: 2, products: 5 })).toBe(5);
  });

  it('never names them in the sentence a Remove confirmation is built from', () => {
    expect(summarizeCounts({ ...NONE, warehouses: 2 })).toBe('no records');
    expect(summarizeCounts({ ...NONE, warehouses: 2, products: 5 })).toBe('5 products');
  });

  it('counts them on their own, for the note that says they stay', () => {
    expect(durableTotal({ ...NONE, warehouses: 2, products: 5 })).toBe(2);
    expect(durableTotal(NONE)).toBe(0);
  });
});
