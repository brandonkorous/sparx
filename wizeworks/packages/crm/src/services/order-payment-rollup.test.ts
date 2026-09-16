import { describe, expect, it, vi } from 'vitest';

import { recomputeOrderPaymentRollup } from './order-payments-service';

/**
 * THE BUYER'S FIGURES FOLLOW THE ORDER'S, OR THE CUSTOMERS LIST LIES.
 *
 * `customer.totalSpent` is `SUM(order.amountPaid)`. The moment anything writes
 * `amountPaid`, that sum is stale — so recomputing an order's money and
 * recomputing the buyer's money are not two jobs, they are one.
 *
 * They were two, paired by convention, and the convention failed in two of the
 * five callers:
 *
 *   billing-payment-service.recordPayment   a payment taken against an INVOICE
 *   payment-webhook-reconcile               a card settling at the gateway
 *
 * Measured 2026-09-15: of 647 customers on this platform exactly ONE had
 * drifted — Devi's customer Anneliese Vogt, showing **$0.00 spent** after paying
 * $180 through an invoice. The order said Paid. The invoice said Paid. The
 * person who paid it showed as having never spent anything. The second caller
 * had simply never run here, because no shop in development has a live payment
 * gateway; in production it is every online sale.
 *
 * A data migration had already repaired this exact drift once, months earlier,
 * while both writers went on shipping. It came back within three weeks. Which is
 * the whole reason this guard is on the CHOKEPOINT and not on the callers: a
 * rule that has to be remembered at five call sites is a rule with five chances
 * to be forgotten.
 */

/** A `tx` that answers the reads this function makes and records every write. */
function fakeTx(order: { total: number; paidAt: Date | null; customerId: string }) {
  const orderUpdate = vi.fn().mockResolvedValue({});
  const customerUpdate = vi.fn().mockResolvedValue({});
  return {
    orderUpdate,
    customerUpdate,
    tx: {
      orderPayment: { findMany: vi.fn().mockResolvedValue([{ amount: 180 }]) },
      orderRefund: { findMany: vi.fn().mockResolvedValue([]) },
      order: {
        findUnique: vi.fn().mockResolvedValue(order),
        aggregate: vi.fn().mockImplementation((args: { _sum?: Record<string, boolean> }) =>
          args._sum
            ? Promise.resolve({
                _sum: { amountPaid: 180, total: 180, refundTotal: 0 },
                _count: { _all: 1 },
              })
            : Promise.resolve({ _min: { placedAt: null }, _max: { placedAt: null } })
        ),
        update: orderUpdate,
      },
      customer: {
        findUnique: vi.fn().mockResolvedValue({ lifecycleStage: 'customer' }),
        update: customerUpdate,
      },
    },
  };
}

const TENANT = '2e78fb6c-a823-4698-bcb9-58a4f17710a0';
const CUSTOMER = 'e3ef888f-7702-4b10-ba30-9f3b4476d763';
const ORDER = '8f1c2a44-6b0e-4a1e-9c33-2d6f0a7b5e10';

async function roll() {
  const f = fakeTx({ total: 180, paidAt: null, customerId: CUSTOMER });
  const becamePaid = await recomputeOrderPaymentRollup(
    f.tx as unknown as Parameters<typeof recomputeOrderPaymentRollup>[0],
    TENANT,
    ORDER
  );
  return { ...f, becamePaid };
}

describe('recomputeOrderPaymentRollup', () => {
  it('writes the buyer’s figures, not only the order’s', async () => {
    const { orderUpdate, customerUpdate } = await roll();
    expect(orderUpdate).toHaveBeenCalledTimes(1);
    // The whole defect: this was zero.
    expect(customerUpdate).toHaveBeenCalledTimes(1);
    const data = customerUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(data.data.totalSpent).toBe('180');
  });

  it('writes the buyer AFTER the order, never before', async () => {
    // Order matters and is not decorative: the customer figures are summed from
    // the orders' own `amountPaid`, so running first would sum the numbers this
    // call is in the middle of replacing.
    const { orderUpdate, customerUpdate } = await roll();
    const orderAt = orderUpdate.mock.invocationCallOrder[0] ?? 0;
    const customerAt = customerUpdate.mock.invocationCallOrder[0] ?? 0;
    expect(orderAt).toBeLessThan(customerAt);
  });

  it('still reports the unpaid → paid edge', async () => {
    // The return value is what publishes `order.paid` exactly once. Adding work
    // to this function must not change what it answers.
    const { becamePaid } = await roll();
    expect(becamePaid).toBe(true);
  });

  it('touches nothing when the order is gone', async () => {
    const f = fakeTx({ total: 0, paidAt: null, customerId: CUSTOMER });
    f.tx.order.findUnique = vi.fn().mockResolvedValue(null);
    const becamePaid = await recomputeOrderPaymentRollup(
      f.tx as unknown as Parameters<typeof recomputeOrderPaymentRollup>[0],
      TENANT,
      ORDER
    );
    expect(becamePaid).toBe(false);
    expect(f.orderUpdate).not.toHaveBeenCalled();
    expect(f.customerUpdate).not.toHaveBeenCalled();
  });
});
