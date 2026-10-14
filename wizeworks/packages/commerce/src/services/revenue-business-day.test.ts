import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A DAY'S SALES ARE THE SHOP'S DAY (sparx persona issue 174).
 *
 * Gillett is in Denver: UTC−6 in October, UTC−7 in December. Every daily money
 * figure was filed on the UTC date of the moment, so Gillett's evening sales
 * landed on the next day, and the last evening of a month in the next month.
 * O-000001 to O-000006, placed on the evening of Oct 1, were filed under Oct 2.
 *
 * The fake transaction answers the order read's `placedAt` range the way the
 * database would, so these measure which day each sale is filed under: in the
 * nightly rollup the Profit screen reads, and on the Reports chart.
 */

const TENANT = '11111111-1111-4111-8111-111111111111';
const SITE = '22222222-2222-4222-8222-222222222222';

interface Range {
  gte: Date;
  lt: Date;
}

interface FakeOrder {
  propertyId: string;
  placedAt: Date;
  subtotal: number;
}

let timezone: string | null = 'America/Denver';
let orders: FakeOrder[] = [];
let written: { bucket: Date; ordersCount: number; netCents: bigint }[] = [];
let deletedFrom: Date | null = null;

const sale = (placedAt: string, subtotal: number): FakeOrder => ({
  propertyId: SITE,
  placedAt: new Date(placedAt),
  subtotal,
});

const tx = {
  tenantBusiness: { findUnique: () => Promise.resolve({ timezone }) },
  order: {
    findMany: ({ where }: { where: { placedAt: Range } }) =>
      Promise.resolve(
        orders
          .filter(
            (o) =>
              o.placedAt.getTime() >= where.placedAt.gte.getTime() &&
              o.placedAt.getTime() < where.placedAt.lt.getTime()
          )
          .map((o) => ({
            propertyId: o.propertyId,
            placedAt: o.placedAt,
            subtotal: o.subtotal,
            discountTotal: 0,
            shippingTotal: 0,
            surchargeTotal: 0,
            taxTotal: 0,
            refundTotal: 0,
            items: [],
          }))
      ),
  },
  rollupCommerceDailyRevenue: {
    // Never reconciled yet, so a read works the closed days out live.
    findMany: () => Promise.resolve([]),
    deleteMany: ({ where }: { where: { bucket: { gte: Date } } }) => {
      deletedFrom = where.bucket.gte;
      return Promise.resolve({ count: 0 });
    },
    createMany: ({ data }: { data: typeof written }) => {
      written = data;
      return Promise.resolve({ count: data.length });
    },
  },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));

const { reconcileRevenueRollup, revenueTimeseries } = await import('./reporting-service');

const ctx = { tenantId: TENANT };
const day = (d: Date) => d.toISOString().slice(0, 10);

beforeEach(() => {
  timezone = 'America/Denver';
  written = [];
  deletedFrom = null;
  orders = [
    // 7pm on Oct 1 in Denver, 01:00 on Oct 2 in UTC: O-000001's evening.
    sale('2026-10-02T01:00:00Z', 120),
    // 11:30pm on Oct 31 in Denver, 05:30 on Nov 1 in UTC.
    sale('2026-11-01T05:30:00Z', 450),
    // 11:30pm on Dec 31 in Denver (winter, UTC−7), 06:30 on Jan 1 in UTC.
    sale('2027-01-01T06:30:00Z', 900),
  ];
  vi.useFakeTimers({ toFake: ['Date'] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the nightly revenue rollup files a sale on the shop’s day', () => {
  it('files the evening of Oct 31 under Oct 31 and the evening of Oct 1 under Oct 1', async () => {
    // The job runs at 11:45pm on Oct 31 in Denver, already Nov 1 in UTC.
    vi.setSystemTime(new Date('2026-11-01T05:45:00Z'));
    await reconcileRevenueRollup(ctx, { sinceDays: 31 });

    expect(written.map((r) => [day(r.bucket), r.netCents])).toEqual([
      ['2026-10-01', 12000n],
      ['2026-10-31', 45000n],
    ]);
    // The window it rewrites starts on a whole business day, 31 days before
    // the shop's today, not before UTC's.
    expect(deletedFrom && day(deletedFrom)).toBe('2026-09-30');
  });

  it('files the winter evening of Dec 31 under Dec 31, not New Year', async () => {
    vi.setSystemTime(new Date('2027-01-01T06:45:00Z'));
    await reconcileRevenueRollup(ctx, { sinceDays: 1 });
    expect(written.map((r) => day(r.bucket))).toEqual(['2026-12-31']);
  });

  it('keeps the UTC day for a business that has not said where it is', async () => {
    timezone = null;
    vi.setSystemTime(new Date('2026-11-01T05:45:00Z'));
    await reconcileRevenueRollup(ctx, { sinceDays: 31 });
    expect(written.map((r) => day(r.bucket))).toEqual(['2026-10-02', '2026-11-01']);
  });
});

describe('the Reports chart reads the same days', () => {
  it("puts October's sales in October's days, and none in November", async () => {
    vi.setSystemTime(new Date('2026-11-15T18:00:00Z'));
    const series = await revenueTimeseries(ctx, {
      // A calendar range: midnight UTC means the date as written.
      range: { from: '2026-10-01T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' },
    });
    const byDay = new Map(series.points.map((p) => [p.bucket, p.netCents]));
    expect(byDay.get('2026-10-01')).toBe(12000);
    expect(byDay.get('2026-10-02')).toBe(0);
    expect(byDay.get('2026-10-31')).toBe(45000);
    expect(byDay.get('2026-11-01')).toBe(0);
    expect(series.totals.ordersCount).toBe(2);
  });

  it('ends a range anchored to now on the shop’s today, not tomorrow', async () => {
    vi.setSystemTime(new Date('2026-11-01T05:45:00Z'));
    const series = await revenueTimeseries(ctx, {
      range: { from: '2026-10-25T05:45:00.000Z', to: '2026-11-01T05:45:00.000Z' },
    });
    expect(series.range.to).toBe('2026-10-31');
    expect(series.points.at(-1)).toMatchObject({ bucket: '2026-10-31', netCents: 45000 });
  });
});
