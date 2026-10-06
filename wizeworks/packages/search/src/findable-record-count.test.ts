// How many customers and orders the search box can reach, counted over the same
// people the database side of the comparison counts.
//
// The gap the console shows ("1 customer is not in this box yet") is the number
// of settled rows minus the number of indexed ones. The database side left out
// anything CHANGED in the last few minutes; the index side counted everything.
// So every customer somebody had just edited sat in the index count and not the
// database count, and hid one customer who was genuinely missing. A buyer who had
// signed up ten minutes earlier and was never indexed read as "nothing missing",
// and the box offered no way to put him back (sparx persona issue 086).
//
// Both sides now key on when the record CAME INTO BEING, which an edit never
// moves, and the index side asks the engine for exactly that.

import { describe, expect, it } from 'vitest';
import type { Client } from 'typesense';

import { findableRecordCount, indexedSecondBoundary } from './admin';
import { CUSTOMERS_COLLECTION, ORDERS_COLLECTION } from './schemas';

const TENANT = '5944fe23-be83-4ce5-aafc-ef56b8594508';

function recordingClient() {
  const asked: { collection: string; params: Record<string, unknown> }[] = [];
  const client = {
    collections: (collection: string) => ({
      documents: () => ({
        search: (params: Record<string, unknown>) => {
          asked.push({ collection, params });
          return Promise.resolve({ found: 6 });
        },
      }),
    }),
  } as unknown as Client;
  return { client, asked };
}

describe('findableRecordCount', () => {
  // 2026-10-03T03:30:44.900Z: the engine stores whole seconds, so the boundary is
  // the second it falls in.
  const settled = new Date(Date.UTC(2026, 9, 3, 3, 30, 44, 900));
  const second = Math.floor(settled.getTime() / 1000);

  it('counts customers who existed by then, not every document', async () => {
    const { client, asked } = recordingClient();
    expect(await findableRecordCount('customers', TENANT, settled, client)).toBe(6);
    expect(asked[0]?.collection).toBe(CUSTOMERS_COLLECTION);
    expect(asked[0]?.params.filter_by).toBe(
      `tenant_id:=${TENANT} && created_at:<=${String(second)}`
    );
  });

  it('counts orders placed by then', async () => {
    const { client, asked } = recordingClient();
    await findableRecordCount('orders', TENANT, settled, client);
    expect(asked[0]?.collection).toBe(ORDERS_COLLECTION);
    expect(asked[0]?.params.filter_by).toBe(
      `tenant_id:=${TENANT} && placed_at:<=${String(second)}`
    );
  });

  it('still counts everything when nobody gave it a moment', async () => {
    const { client, asked } = recordingClient();
    await findableRecordCount('customers', TENANT, null, client);
    expect(asked[0]?.params.filter_by).toBe(`tenant_id:=${TENANT}`);
  });
});

describe('indexedSecondBoundary', () => {
  // The database side stops where the index side does, or up to a second of
  // rows is counted on one side only.
  it('is the start of the second after the one the index counts up to', () => {
    const settled = new Date(Date.UTC(2026, 9, 3, 3, 30, 44, 900));
    expect(indexedSecondBoundary(settled).toISOString()).toBe('2026-10-03T03:30:45.000Z');
  });

  it('moves a whole second even from the top of one', () => {
    const settled = new Date(Date.UTC(2026, 9, 3, 3, 30, 44, 0));
    expect(indexedSecondBoundary(settled).toISOString()).toBe('2026-10-03T03:30:45.000Z');
  });
});
