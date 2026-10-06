// The search box's "not in this box yet" count sees a customer who is missing.
//
// Found on Gillett Diesel, 2026-10-03: a buyer signed up on the website at
// 03:26, was never indexed, and minutes later the box answered "Nothing in your
// records matches" about him with no offer to put him back (sparx persona issue
// 086). Two things let that happen here. The count waited five minutes before
// it would call anybody missing. And it compared two different populations: the
// database side left out every customer CHANGED inside that wait, soft-deleted
// ones included, while the index side counted every document. So one customer
// edited in the last few minutes hid one who was genuinely missing, and a deleted
// one in the bin read as missing forever.
//
// Both halves now count the same people: live customers who came into being by
// the settled moment, on either side. Orders the same way, by when they were
// placed.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';

const findableRecordCount = vi.fn();
const customerWhere: unknown[] = [];
const orderWhere: unknown[] = [];

vi.mock('@wizeworks/api-core/auth', () => ({
  requireRole: vi.fn(),
  requireAuth: () => ({ tenantId: '5944fe23-be83-4ce5-aafc-ef56b8594508', actorId: 'u-1' }),
}));
vi.mock('@wizeworks/db', () => ({
  productSiteVisibilityWhere: () => ({}),
  withTenant: (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      product: { count: () => Promise.resolve(0) },
      customer: {
        count: ({ where }: { where: unknown }) => {
          customerWhere.push(where);
          return Promise.resolve(7);
        },
      },
      order: {
        count: ({ where }: { where: unknown }) => {
          orderWhere.push(where);
          return Promise.resolve(0);
        },
      },
    }),
}));
vi.mock('@wizeworks/search', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>();
  return {
    indexedSecondBoundary: real.indexedSecondBoundary,
    collectionStats: () => Promise.resolve([]),
    findableProductCount: () => Promise.resolve(0),
    findableRecordCount,
  };
});
vi.mock('../../lib/property.js', () => ({ resolveListScope: () => Promise.resolve(undefined) }));
vi.mock('../../lib/commerce-context.js', () => ({ requireCommerceModule: vi.fn() }));
vi.mock('../../lib/crm-context.js', () => ({ requireCrmModule: vi.fn() }));
vi.mock('@wizeworks/auth', () => ({ listEnabledModules: () => Promise.resolve([]) }));
vi.mock('@wizeworks/api-core/pubsub', () => ({ publish: vi.fn() }));

const { default: searchRoutes } = await import('./search.js');

beforeEach(() => {
  customerWhere.length = 0;
  orderWhere.length = 0;
  findableRecordCount
    .mockReset()
    .mockImplementation((collection: string) =>
      Promise.resolve(collection === 'customers' ? 6 : 0)
    );
});

async function status() {
  const app = Fastify();
  await app.register(searchRoutes);
  const res = await app.inject({ method: 'GET', url: '/v1/search/status' });
  await app.close();
  return res.json<{ data: { customersMissing: number | null } }>().data;
}

describe('GET /v1/search/status', () => {
  it('reports the customer the index is missing', async () => {
    expect((await status()).customersMissing).toBe(1);
  });

  it('counts both sides over the same settled moment, by when each record came to be', async () => {
    await status();
    const [customers] = findableRecordCount.mock.calls.filter((c) => c[0] === 'customers');
    const [orders] = findableRecordCount.mock.calls.filter((c) => c[0] === 'orders');
    const settled = customers?.[2] as Date;
    expect(settled).toBeInstanceOf(Date);
    expect(orders?.[2]).toEqual(settled);
    const boundary = new Date((Math.floor(settled.getTime() / 1000) + 1) * 1000);
    expect(customerWhere[0]).toEqual({ deletedAt: null, createdAt: { lt: boundary } });
    expect(orderWhere[0]).toEqual({ placedAt: { lt: boundary } });
  });

  // An owner who has just watched somebody sign up should not be told "nothing
  // matches" for long. The worker indexes in seconds; the wait only has to cover
  // that, not five minutes.
  it('stops waiting on a new arrival within a minute', async () => {
    const before = Date.now();
    await status();
    const settled = findableRecordCount.mock.calls[0]?.[2] as Date;
    expect(before - settled.getTime()).toBeLessThanOrEqual(60_000);
  });
});
