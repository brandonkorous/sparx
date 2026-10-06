// A count of what matched has to be a count.
//
// MEASURED 2026-10-06 on Gillett Diesel Service, 15 orders O-000001 to
// O-000015, every one in the index. Typing "O-0000" in the console search box
// listed O-000006 to O-000015 and said "10 records matched". O-000001 to
// O-000005 were never shown and never counted. Typesense grows a half-typed
// word into at most `max_candidates` whole words, 4 by default, and its `found`
// moves with the page size asked for: 5 rows asked found 4, 16 asked found 10.
// At 100 it found all 15 at any page size.
//
// What this pins: every search that hands back a count asks with that setting,
// through the real wrappers, so a new search cannot quietly go back to 4.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from 'typesense';

import { forgetLiveFields } from './live-fields';

const sent: Record<string, unknown>[] = [];
const client = {
  collections: (_name: string) => ({
    retrieve: () => Promise.resolve({ fields: [{ name: 'company' }] }),
    documents: () => ({
      search: (params: Record<string, unknown>) => {
        sent.push(params);
        return Promise.resolve({ found: 0, hits: [] });
      },
    }),
  }),
  multiSearch: {
    perform: (body: { searches: Record<string, unknown>[] }) => {
      sent.push(...body.searches);
      return Promise.resolve({ results: body.searches.map(() => ({ found: 0, hits: [] })) });
    },
  },
} as unknown as Client;
vi.mock('./client', () => ({ getClient: () => client }));

const { EVERY_PREFIX, palette, searchAll, searchCustomers, searchOrders, searchProducts } =
  await import('./search');
const { searchCustomersCrossTenant, searchOrdersCrossTenant } = await import('./operator');

const T = '5944fe23-be83-4ce5-aafc-ef56b8594508';

beforeEach(() => {
  sent.length = 0;
  forgetLiveFields();
});

const searches: [string, () => Promise<unknown>][] = [
  ['products', () => searchProducts({ tenantId: T, q: 'O-0000' })],
  [
    'products, ranked for a fleet',
    () => searchProducts({ tenantId: T, q: 'O-0000', boostProductIds: ['p-1'] }),
  ],
  ['customers', () => searchCustomers({ tenantId: T, q: 'O-0000' })],
  ['orders', () => searchOrders({ tenantId: T, q: 'O-0000' })],
  ['everything', () => searchAll({ tenantId: T, q: 'O-0000' })],
  ['the search box', () => palette({ tenantId: T, q: 'O-0000', limitPerCollection: 8 })],
  ['support, customers', () => searchCustomersCrossTenant({ q: 'O-0000' })],
  ['support, orders', () => searchOrdersCrossTenant({ q: 'O-0000' })],
];

describe('every search that reports how many matched', () => {
  it.each(searches)('%s lets a half-typed word stand for every word it starts', async (_, run) => {
    await run();
    expect(sent.length).toBeGreaterThan(0);
    for (const params of sent) {
      expect(params.max_candidates).toBe(EVERY_PREFIX.max_candidates);
    }
  });

  it('is enough for a page of order numbers that share a prefix', () => {
    expect(EVERY_PREFIX.max_candidates).toBeGreaterThanOrEqual(100);
  });
});
