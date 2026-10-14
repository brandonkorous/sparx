// A day's profit is filed on the BUSINESS's day (sparx persona issue 174).
//
// Gillett is in Denver: UTC−6 in October, UTC−7 in December. A sale, a payment
// and stock leaving are moments, so the evening of Oct 31 is Oct 31 in the shop
// even though UTC has already turned over to Nov 1. An expense is a DATE stored
// at midnight UTC, so it stays on the date written on it.
//
// The fake transaction answers each `where` the way the database would (a
// half-open range on the column the rollup filters), so this measures which day
// each figure lands on rather than which arguments were passed.

import type { TxClient } from '@wizeworks/db';
import { describe, expect, it } from 'vitest';

import { recomputeDay } from './rollup';
import { ORDER_MOVEMENT_REFERENCE } from './stock-movements';

const TENANT = '11111111-1111-4111-8111-111111111111';
const SITE = '22222222-2222-4222-8222-222222222222';
const ORDER = '33333333-3333-4333-8333-333333333333';
const WINTER_ORDER = '44444444-4444-4444-8444-444444444444';
const OPERATING = 'cat-operating';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const at = (iso: string) => new Date(iso);

interface Range {
  gte: Date;
  lt: Date;
}

const within = (value: Date, range: Range) =>
  value.getTime() >= range.gte.getTime() && value.getTime() < range.lt.getTime();

/** Gillett's books for the month edges, as the tables hold them. */
function gillett(timezone: string | null) {
  const orders = [
    // 11:30pm on Oct 31 in Denver, 05:30 on Nov 1 in UTC. A marketplace kept $3.
    { id: ORDER, propertyId: SITE, placedAt: at('2026-11-01T05:30:00Z'), channelFeeCents: 300 },
    // 11:30pm on Dec 31 in Denver (winter, UTC−7), 06:30 on Jan 1 in UTC.
    {
      id: WINTER_ORDER,
      propertyId: SITE,
      placedAt: at('2027-01-01T06:30:00Z'),
      channelFeeCents: 500,
    },
  ];
  const payments = [
    // 10pm on Oct 31 in Denver: $107 on a $107 service invoice with $7 tax.
    {
      receivedAt: at('2026-11-01T04:00:00Z'),
      amount: 107,
      kind: 'payment',
      document: { propertyId: SITE, total: 107, taxTotal: 7, coreChargeTotal: 0, orderId: null },
    },
  ];
  const movements = [
    // The goods on the Oct 31 order left the shelf with it.
    {
      createdAt: at('2026-11-01T05:30:00Z'),
      referenceType: ORDER_MOVEMENT_REFERENCE,
      referenceId: ORDER,
      costConsumedCents: 4_000,
    },
  ];
  const expenses = [
    // October's rent, dated Oct 1: stored as midnight UTC.
    {
      id: 'rent',
      propertyId: SITE,
      categoryId: OPERATING,
      incurredAt: at('2026-10-01T00:00:00Z'),
      amountCents: 2_500_00,
      deletedAt: null,
    },
  ];
  const written: { propertyId: string | null; bucket: Date }[] = [];

  const tx = {
    tenantBusiness: {
      findUnique: () => Promise.resolve({ timezone }),
    },
    // The commerce rollup is filed by commerce; nothing in it for these days.
    rollupCommerceDailyRevenue: { findMany: () => Promise.resolve([]) },
    billingDocumentPayment: {
      findMany: ({ where }: { where: { receivedAt: Range } }) =>
        Promise.resolve(payments.filter((p) => within(p.receivedAt, where.receivedAt))),
    },
    inventoryMovement: {
      findMany: ({ where }: { where: { createdAt: Range } }) =>
        Promise.resolve(movements.filter((m) => within(m.createdAt, where.createdAt))),
    },
    order: {
      findMany: ({ where }: { where: { id?: { in: string[] }; placedAt?: Range } }) =>
        Promise.resolve(
          orders.filter((o) =>
            where.id ? where.id.in.includes(o.id) : within(o.placedAt, where.placedAt!)
          )
        ),
    },
    financeExpenseCategory: {
      findMany: () => Promise.resolve([{ id: OPERATING, kind: 'operating' }]),
    },
    financeExpense: {
      groupBy: ({ where }: { where: { incurredAt: Range } }) =>
        Promise.resolve(
          expenses
            .filter((e) => within(e.incurredAt, where.incurredAt))
            .map((e) => ({
              propertyId: e.propertyId,
              categoryId: e.categoryId,
              _sum: { amountCents: e.amountCents },
            }))
        ),
    },
    financeExpenseAllocation: { findMany: () => Promise.resolve([]) },
    rollupFinanceDailyProfit: {
      findMany: () => Promise.resolve([]),
      findFirst: () => Promise.resolve(null),
      create: ({ data }: { data: { propertyId: string | null; bucket: Date } }) => {
        written.push({ propertyId: data.propertyId, bucket: data.bucket });
        return Promise.resolve(data);
      },
    },
  };
  return { tx: tx as unknown as TxClient, written };
}

async function dayOf(timezone: string | null, iso: string) {
  const { tx, written } = gillett(timezone);
  const rows = await recomputeDay(TENANT, day(iso), tx);
  const site = rows.find((r) => r.propertyId === SITE);
  return { site, written };
}

describe("a day's profit is the business's day (sparx persona issue 174)", () => {
  it('files the 11:30pm sale on Oct 31 under Oct 31 in Denver', async () => {
    const { site, written } = await dayOf('America/Denver', '2026-10-31');
    expect(site?.feeCents).toBe(300);
    expect(site?.cogsCents).toBe(4_000);
    // The $107 payment less its $7 tax.
    expect(site?.revenueCents).toBe(100_00);
    expect(written.map((w) => w.bucket.toISOString())).toEqual(['2026-10-31T00:00:00.000Z']);
  });

  it('leaves Nov 1 without the evening before it', async () => {
    const { site } = await dayOf('America/Denver', '2026-11-01');
    expect(site).toBeUndefined();
  });

  it('files the winter evening of Dec 31 under Dec 31, not New Year', async () => {
    expect((await dayOf('America/Denver', '2026-12-31')).site?.feeCents).toBe(500);
    expect((await dayOf('America/Denver', '2027-01-01')).site).toBeUndefined();
  });

  it('keeps an expense on the date written on it, in any zone', async () => {
    const { site } = await dayOf('America/Denver', '2026-10-01');
    expect(site?.operatingCents).toBe(2_500_00);
    expect((await dayOf('America/Denver', '2026-09-30')).site).toBeUndefined();
  });

  it('keeps the UTC day for a business that has not said where it is', async () => {
    expect((await dayOf(null, '2026-11-01')).site?.feeCents).toBe(300);
    expect((await dayOf(null, '2026-10-31')).site).toBeUndefined();
  });
});
