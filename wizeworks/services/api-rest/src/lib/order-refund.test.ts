// A refund records how it was settled, so the email can say where the money goes
// (sparx persona issue 352). Brynn paid $1,587.00 cash at the counter, Doty gave
// $793.50 back on the order page, and her email said it would "take 5–10 business
// days to appear", a promise about a bank her money never went near.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const recordRefund = vi.fn((_ctx: unknown, input: unknown) => Promise.resolve(input));
const refund = vi.fn(() => Promise.resolve({ success: true, refundId: 're_test_1' }));
let payment = {
  id: 'pay-1',
  processor: 'manual',
  processorRef: null as string | null,
  currency: 'USD',
};

vi.mock('@wizeworks/db', () => ({
  withTenant: (_ctx: unknown, fn: (tx: unknown) => unknown) =>
    fn({
      order: { findUnique: () => Promise.resolve({ amountPaid: 793.5 }) },
      orderPayment: { findFirst: () => Promise.resolve(payment) },
    }),
}));
vi.mock('@wizeworks/crm', () => ({ orderRefundsService: { recordRefund } }));
vi.mock('@wizeworks/payments', () => ({
  GatewayNotFoundError: class extends Error {},
  PaymentConfigError: class extends Error {},
  paymentService: { refund },
  takenByGateway: (processor: string) => processor === 'sparx_pay',
}));

const { refundOrderThroughGateway } = await import('./order-refund');

describe('refundOrderThroughGateway', () => {
  beforeEach(() => {
    recordRefund.mockClear();
    refund.mockClear();
  });

  it('records money taken by hand as settled by hand, and calls no gateway', async () => {
    payment = { id: 'pay-1', processor: 'manual', processorRef: null, currency: 'USD' };
    await refundOrderThroughGateway({ tenantId: 't' }, { orderId: 'o-33' });
    expect(refund).not.toHaveBeenCalled();
    expect(recordRefund).toHaveBeenCalledWith(
      { tenantId: 't' },
      expect.objectContaining({ amount: 793.5, metadata: { settledBy: 'hand' } })
    );
  });

  it('records a card refund as settled by the gateway', async () => {
    payment = { id: 'pay-2', processor: 'sparx_pay', processorRef: 'pi_test', currency: 'USD' };
    await refundOrderThroughGateway({ tenantId: 't' }, { orderId: 'o-36', amount: 15 });
    expect(refund).toHaveBeenCalledOnce();
    expect(recordRefund).toHaveBeenCalledWith(
      { tenantId: 't' },
      expect.objectContaining({
        amount: 15,
        processorRef: 're_test_1',
        metadata: { settledBy: 'gateway' },
      })
    );
  });
});
