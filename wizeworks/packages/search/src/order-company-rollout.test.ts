// Finding a trade account's orders by the account's name, without breaking
// search while the release that adds the name is still rolling out.
//
// MEASURED 2026-10-04 on Gillett Diesel Service: typing "Wasatch" in the console
// search box found Wasatch Front Utility Contractors, LLC, its invoices, quotes
// and contacts, and none of its orders. The orders collection now carries the
// account's name in `company`.
//
// The trap: Typesense fails the WHOLE search when `query_by` names a field the
// collection does not have. The field reaches a live collection only when the
// indexer boots, and a release rolls api-rest and the indexer side by side in no
// fixed order. So a search may ask for `company` only once the live collection
// has it. Otherwise every search in the box errors, about everything, until the
// indexer catches up.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from 'typesense';

import { collectionHasField, forgetLiveFields, LIVE_FIELDS_TTL_MS } from './live-fields';
import { ORDERS_COLLECTION } from './schemas';

/** A Typesense stand-in: one collection whose fields can change under it. */
function fakeEngine(initial: string[]) {
  let fields = initial;
  const retrieve = vi.fn(() => Promise.resolve({ fields: fields.map((name) => ({ name })) }));
  const searches: Record<string, unknown>[] = [];
  const client = {
    collections: (_name: string) => ({
      retrieve,
      documents: () => ({
        search: (params: Record<string, unknown>) => {
          searches.push(params);
          return Promise.resolve({ found: 0, hits: [] });
        },
      }),
    }),
    multiSearch: {
      perform: (body: { searches: Record<string, unknown>[] }) => {
        searches.push(...body.searches);
        return Promise.resolve({ results: body.searches.map(() => ({ found: 0, hits: [] })) });
      },
    },
  } as unknown as Client;
  return {
    client,
    retrieve,
    searches,
    addField: (name: string) => {
      fields = [...fields, name];
    },
  };
}

const BEFORE = ['tenant_id', 'order_number', 'customer_name', 'customer_email'];

let engine = fakeEngine(BEFORE);
vi.mock('./client', () => ({ getClient: () => engine.client }));

const { orderQueryBy, palette, searchOrders } = await import('./search');
const { searchOrdersCrossTenant } = await import('./operator');

const T = '5944fe23-be83-4ce5-aafc-ef56b8594508';

function ordersSearch(): Record<string, unknown> {
  const found = engine.searches.find(
    (s) => s.collection === ORDERS_COLLECTION || String(s.query_by).startsWith('order_number')
  );
  if (!found) throw new Error('no orders search was sent');
  return found;
}

beforeEach(() => {
  forgetLiveFields();
});

describe('a collection the indexer has not caught up with yet', () => {
  beforeEach(() => {
    engine = fakeEngine(BEFORE);
  });

  it('the search box does not ask orders for the account name', async () => {
    await palette({ tenantId: T, q: 'Wasatch' });
    expect(ordersSearch().query_by).toBe('order_number,customer_name,customer_email');
  });

  it('the orders list does not ask for it either', async () => {
    await searchOrders({ tenantId: T, q: 'Wasatch' });
    expect(ordersSearch().query_by).not.toContain('company');
  });

  it('nor does the operator lookup', async () => {
    await searchOrdersCrossTenant({ q: 'Wasatch' });
    expect(ordersSearch().query_by).not.toContain('company');
  });
});

describe('once the collection has the field', () => {
  beforeEach(() => {
    engine = fakeEngine([...BEFORE, 'company']);
  });

  it('the search box finds orders by the account name', async () => {
    await palette({ tenantId: T, q: 'Wasatch' });
    expect(ordersSearch().query_by).toBe('order_number,customer_name,customer_email,company');
  });

  it('the orders list weighs it beside the buyer', async () => {
    await searchOrders({ tenantId: T, q: 'Wasatch O-000014' });
    const s = ordersSearch();
    expect(s.query_by).toBe(
      'order_number,customer_name,customer_email,company,item_titles,item_skus'
    );
    expect(s.query_by_weights).toBe('5,3,3,3,2,2');
  });

  it('the operator lookup finds them by it', async () => {
    await searchOrdersCrossTenant({ q: 'Wasatch' });
    expect(ordersSearch().query_by).toContain('company');
  });
});

describe('reading the live collection', () => {
  it('notices the field the indexer adds, within a minute, without a restart', async () => {
    engine = fakeEngine(BEFORE);
    const t0 = 1_000_000;
    expect(await collectionHasField(ORDERS_COLLECTION, 'company', engine.client, t0)).toBe(false);
    engine.addField('company');
    // Still the old reading inside the minute: one request per minute, not per search.
    expect(await collectionHasField(ORDERS_COLLECTION, 'company', engine.client, t0 + 1)).toBe(
      false
    );
    expect(engine.retrieve).toHaveBeenCalledTimes(1);
    expect(
      await collectionHasField(ORDERS_COLLECTION, 'company', engine.client, t0 + LIVE_FIELDS_TTL_MS)
    ).toBe(true);
    expect(engine.retrieve).toHaveBeenCalledTimes(2);
  });

  it('shares one request between searches that arrive together', async () => {
    engine = fakeEngine([...BEFORE, 'company']);
    const answers = await Promise.all([
      collectionHasField(ORDERS_COLLECTION, 'company', engine.client),
      collectionHasField(ORDERS_COLLECTION, 'company', engine.client),
      collectionHasField(ORDERS_COLLECTION, 'company', engine.client),
    ]);
    expect(answers).toEqual([true, true, true]);
    expect(engine.retrieve).toHaveBeenCalledTimes(1);
  });

  it('answers "not there" when it cannot look, rather than failing the search', async () => {
    const client = {
      collections: () => ({
        retrieve: () => Promise.reject(Object.assign(new Error('nope'), { httpStatus: 503 })),
      }),
    } as unknown as Client;
    expect(await collectionHasField(ORDERS_COLLECTION, 'company', client)).toBe(false);
  });
});

describe('the orders fields and their weights', () => {
  it('stay the same length, with or without the account name', () => {
    for (const withCompany of [true, false]) {
      const { query_by, query_by_weights } = orderQueryBy(withCompany);
      expect(query_by.split(',')).toHaveLength(query_by_weights.split(',').length);
    }
  });
});
