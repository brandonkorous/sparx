import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * CASH COLLECTED IS FILED ON THE SHOP'S DAY (sparx persona issue 174).
 *
 * Gillett is in Denver, UTC−6 in October. A payment taken at 10pm on Oct 31
 * was filed under Nov 1, the UTC date of the moment: November's cash on the
 * Invoicing chart, beside an invoice and a statement that print Oct 31.
 *
 * The fake database answers the two day-by-day reads the way Postgres would:
 * it keeps the rows inside the window it is handed, and files each one on its
 * date `AT TIME ZONE` the zone it is handed, worked out here with `Intl` rather
 * than with the code under test.
 */

const TENANT = '11111111-1111-4111-8111-111111111111';
const SITE = '22222222-2222-4222-8222-222222222222';

interface Payment {
  receivedAt: Date;
  amount: number;
}

let timezone: string | null = 'America/Denver';
let payments: Payment[] = [];
let written: { bucket: Date; collectedCents: bigint; paymentsCount: number }[] = [];
let summaryValues: unknown[] = [];

/** Postgres's `(at AT TIME ZONE zone)::date`, independently. */
function pgDate(at: Date, zone: string): Date {
  const text = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
  return new Date(`${text}T00:00:00.000Z`);
}

function queryRaw(strings: TemplateStringsArray, ...values: unknown[]) {
  const text = strings.join('?');
  if (text.includes('AS this_month')) {
    summaryValues = values;
    return Promise.resolve([{ this_month: 0, last_month: 0 }]);
  }
  if (!text.includes('FROM billing_document_payments p')) return Promise.resolve([]);
  // The day-by-day payment read: [zone, from, toExclusive, …].
  const [zone, from, toExclusive] = values as [string, Date, Date];
  const byDay = new Map<number, { bucket: Date; count: number; total: number }>();
  for (const p of payments) {
    if (p.receivedAt < from || p.receivedAt >= toExclusive) continue;
    const bucket = pgDate(p.receivedAt, zone);
    const row = byDay.get(bucket.getTime()) ?? { bucket, count: 0, total: 0 };
    row.count += 1;
    row.total += p.amount;
    byDay.set(bucket.getTime(), row);
  }
  return Promise.resolve(
    [...byDay.values()].map((r) => ({
      property_id: SITE,
      bucket: r.bucket,
      payments_count: r.count,
      gross_collected: r.total,
      refunded: 0,
    }))
  );
}

const tx = {
  tenantBusiness: { findUnique: () => Promise.resolve({ timezone }) },
  $queryRaw: queryRaw,
  rollupInvoicingDailyCollected: {
    findMany: () => Promise.resolve([]),
    deleteMany: () => Promise.resolve({ count: 0 }),
    createMany: ({ data }: { data: typeof written }) => {
      written = data;
      return Promise.resolve({ count: data.length });
    },
  },
  billingDocument: {
    aggregate: () => Promise.resolve({ _count: { _all: 0 }, _sum: { total: 0, depositTotal: 0 } }),
  },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));

const { collectedTimeseries, collectionsSummary, reconcileCollectedRollup } =
  await import('./invoicing-reporting-service');

const ctx = { tenantId: TENANT };
const day = (d: Date) => d.toISOString().slice(0, 10);

beforeEach(() => {
  timezone = 'America/Denver';
  written = [];
  summaryValues = [];
  payments = [
    // 9am and 10pm on Oct 31 in Denver; the second is 04:00 on Nov 1 in UTC.
    { receivedAt: new Date('2026-10-31T15:00:00Z'), amount: 100 },
    { receivedAt: new Date('2026-11-01T04:00:00Z'), amount: 250 },
  ];
  vi.useFakeTimers({ toFake: ['Date'] });
  // 11:45pm on Oct 31 in Denver.
  vi.setSystemTime(new Date('2026-11-01T05:45:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the collected rollup files a payment on the shop's day", () => {
  it('files the 10pm payment on Oct 31 under Oct 31', async () => {
    await reconcileCollectedRollup(ctx, { sinceDays: 31 });
    expect(written.map((r) => [day(r.bucket), r.paymentsCount, r.collectedCents])).toEqual([
      ['2026-10-31', 2, 35000n],
    ]);
  });

  it('keeps the UTC day for a business that has not said where it is', async () => {
    timezone = null;
    await reconcileCollectedRollup(ctx, { sinceDays: 31 });
    expect(written.map((r) => [day(r.bucket), r.collectedCents])).toEqual([
      ['2026-10-31', 10000n],
      ['2026-11-01', 25000n],
    ]);
  });

  it('shows the same on the chart, with nothing on Nov 1', async () => {
    const series = await collectedTimeseries(ctx, {
      range: { from: '2026-10-01T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' },
    });
    const byDay = new Map(series.points.map((p) => [p.bucket, p.collectedCents]));
    expect(byDay.get('2026-10-31')).toBe(35000);
    expect(byDay.get('2026-11-01')).toBe(0);
  });
});

describe("this month's cash starts on the shop's 1st", () => {
  it('is still October at 11:45pm on Oct 31 in Denver', async () => {
    await collectionsSummary(ctx);
    const [thisMonth, lastMonth] = summaryValues as Date[];
    expect(thisMonth?.toISOString()).toBe('2026-10-01T06:00:00.000Z');
    expect(lastMonth?.toISOString()).toBe('2026-09-01T06:00:00.000Z');
  });
});
