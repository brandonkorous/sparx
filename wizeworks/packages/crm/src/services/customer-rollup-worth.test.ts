// What a customer's ORDERS are worth, and what a refund does to it (issue 323).
//
// The card answered only "has this person paid me", which is the right question
// on a shop taking cards and the wrong one on a shop taking manual payment:
// Juniper Row's read "$0.00 across 3 orders" above a list of orders worth $502,
// and the figure was arithmetically correct.
//
// The decision these pin down is that `totalOrdered` is NET OF REFUNDS. It is not
// a preference — `totalSpent` is already net (the refund path writes `amountPaid`
// net), so a gross figure beside it would put two populations on one card, which
// is the defect this closes rather than repeats.

import { describe, expect, it, vi } from 'vitest';

import { recomputeCustomerCommerce } from './customer-rollup';

const TENANT = '2e78fb6c-a823-4698-bcb9-58a4f17710a0';
const CUSTOMER = 'e3ef888f-7702-4b10-ba30-9f3b4476d763';

/** A `tx` that answers the two aggregates and records what was written. */
function fakeTx(sums: { amountPaid: number; total: number; refundTotal: number; count: number }): {
  tx: unknown;
  written: () => Record<string, unknown>;
} {
  const update = vi.fn().mockResolvedValue({});
  const aggregate = vi.fn().mockImplementation((args: { _sum?: Record<string, boolean> }) =>
    args._sum
      ? Promise.resolve({
          _sum: {
            amountPaid: sums.amountPaid,
            total: sums.total,
            refundTotal: sums.refundTotal,
          },
          _count: { _all: sums.count },
        })
      : Promise.resolve({ _min: { placedAt: null }, _max: { placedAt: null } })
  );
  return {
    tx: {
      order: { aggregate },
      customer: {
        findUnique: vi.fn().mockResolvedValue({ lifecycleStage: 'customer' }),
        update,
      },
    },
    written: () => (update.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data,
  };
}

async function roll(sums: {
  amountPaid: number;
  total: number;
  refundTotal: number;
  count: number;
}) {
  const { tx, written } = fakeTx(sums);
  const rollup = await recomputeCustomerCommerce(
    tx as Parameters<typeof recomputeCustomerCommerce>[0],
    TENANT,
    CUSTOMER
  );
  return { rollup, written: written() };
}

describe('what a customer’s orders are worth', () => {
  it('counts orders that have not been paid for', async () => {
    // Anneliese Vogt, exactly: three orders, $502, nothing collected. The old card
    // called this customer worth $0.00.
    const { rollup } = await roll({ amountPaid: 0, total: 502, refundTotal: 0, count: 3 });
    expect(rollup.totalOrdered).toBe('502.00');
    expect(rollup.totalSpent).toBe('0');
    expect(rollup.orderCount).toBe(3);
  });

  it('takes a refund off what the orders are worth', async () => {
    // $502 placed, $170 of it refunded. The money went back, so the orders are
    // worth $332 — the same direction `totalSpent` already moves in.
    const { rollup } = await roll({ amountPaid: 0, total: 502, refundTotal: 170, count: 3 });
    expect(rollup.totalOrdered).toBe('332.00');
  });

  it('reduces by a PARTIAL refund rather than discarding the order', async () => {
    // A $170 order refunded $42 is worth $128, not nothing. Subtracting rather
    // than filtering is the whole reason this reads `refundTotal`.
    const { rollup } = await roll({ amountPaid: 128, total: 170, refundTotal: 42, count: 1 });
    expect(rollup.totalOrdered).toBe('128.00');
  });

  it('keeps a fully refunded order in the count, so the figures agree with the list', async () => {
    // Dropping it would make "1 order" disagree with the one order shown below —
    // the same contradiction this issue is about, moved to a different pair.
    const { rollup } = await roll({ amountPaid: 0, total: 170, refundTotal: 170, count: 1 });
    expect(rollup.totalOrdered).toBe('0.00');
    expect(rollup.orderCount).toBe(1);
  });

  it('never goes negative, whatever the refund column says', async () => {
    // A refund larger than its order is a data fault, not a customer worth minus
    // money. The increment version of this file shipped "-$42.00" once already.
    const { rollup } = await roll({ amountPaid: 0, total: 100, refundTotal: 250, count: 1 });
    expect(rollup.totalOrdered).toBe('0.00');
  });

  it('writes it to the customer alongside the figure it belongs beside', async () => {
    const { written } = await roll({ amountPaid: 60, total: 502, refundTotal: 0, count: 3 });
    expect(written.totalOrdered).toBe('502.00');
    expect(written.totalSpent).toBe('60');
  });
});
