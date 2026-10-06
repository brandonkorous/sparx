import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The card on a held wholesale order, once it is decided (sparx persona issue
 * 087). Approved: the held card is charged. Turned down: a held card is let go,
 * a charged one refunded in full through the same refund path as any order. And
 * nothing fails quietly: a card that could not be charged leaves a placed order
 * unpaid, a refund that did not go through leaves the buyer out the money, so
 * each is written on the order and handed to the business as a task.
 */

const capturePayment = vi.fn();
const cancelPayment = vi.fn();
const refund = vi.fn();
const recordRefund = vi.fn((_ctx: unknown, input: unknown) => Promise.resolve(input));
const createTask = vi.fn((_ctx: unknown, input: unknown) => Promise.resolve(input));
const paymentWrites: { where: { id: string }; data: Record<string, unknown> }[] = [];
const notes: { description: string }[] = [];

const tx = {
  orderPayment: {
    findUnique: vi.fn(() => Promise.resolve({ metadata: { transactionRef: 'ch_1' } })),
    update: vi.fn((write: { where: { id: string }; data: Record<string, unknown> }) => {
      paymentWrites.push(write);
      return Promise.resolve({});
    }),
  },
  crmActivity: {
    create: vi.fn(({ data }: { data: { description: string } }) => {
      notes.push(data);
      return Promise.resolve(data);
    }),
  },
  user: {
    findFirst: vi.fn(({ where }: { where?: { role?: string } }) =>
      Promise.resolve(where?.role === 'owner' ? { id: 'u-owner' } : { id: 'u-anyone' })
    ),
  },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));
vi.mock('@wizeworks/payments', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  paymentService: { capturePayment, cancelPayment, refund },
}));
vi.mock('@wizeworks/crm', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>();
  return {
    ...real,
    orderRefundsService: { recordRefund },
    taskService: {
      create: createTask,
      dueAtIn: () => Promise.resolve(new Date('2026-10-03T23:59:59Z')),
    },
  };
});

const { PaymentConfigError } = await import('@wizeworks/payments');
const { settle, TURNED_DOWN_REFUND_REASON } = await import('./held-order-payments');

const TENANT = 'tenant-gillett';
const card = {
  paymentId: 'pay-1',
  orderId: 'order-14',
  orderNumber: 'O-000014',
  customerId: 'c-renee',
  processor: 'sparx_pay',
  paymentRef: 'pi_wasatch',
  amountCents: 120_800,
  currency: 'USD',
};

beforeEach(() => {
  for (const fn of [capturePayment, cancelPayment, refund, recordRefund, createTask]) {
    fn.mockClear();
  }
  capturePayment.mockReset();
  cancelPayment.mockReset();
  refund.mockReset();
  paymentWrites.length = 0;
  notes.length = 0;
});

describe('approved: the held card is charged', () => {
  it('charges the whole hold on the tenant’s gateway, and gives nobody a task', async () => {
    capturePayment.mockResolvedValue({ success: true, status: 'succeeded' });
    const [result] = await settle({ tenantId: TENANT, userId: 'u-doty' }, [
      { action: 'capture', ...card },
    ]);
    expect(result).toMatchObject({ ok: true });
    expect(capturePayment).toHaveBeenCalledWith(TENANT, 'pi_wasatch', 120_800);
    expect(createTask).not.toHaveBeenCalled();
    expect(paymentWrites).toEqual([]);
  });

  it('when the hold has run out, records it unpaid and tells whoever approved it', async () => {
    capturePayment.mockResolvedValue({
      success: false,
      errorMessage: 'This PaymentIntent could not be captured because it has a status of canceled.',
    });
    const [result] = await settle({ tenantId: TENANT, userId: 'u-doty' }, [
      { action: 'capture', ...card },
    ]);
    expect(result).toMatchObject({ ok: false });
    expect(paymentWrites).toEqual([
      {
        where: { id: 'pay-1' },
        data: {
          status: 'failed',
          failureReason:
            'This PaymentIntent could not be captured because it has a status of canceled.',
          metadata: { transactionRef: 'ch_1', signOffCaptureFailed: true },
        },
      },
    ]);
    expect(notes[0]!.description).toContain(
      'Order #O-000014 was approved, but the $1,208.00 held on the card could not be charged'
    );
    expect(createTask).toHaveBeenCalledTimes(1);
    const [taskCtx, task] = createTask.mock.calls[0]! as [
      { userId: string },
      { title: string; description: string; assignedToUserId: string; customerId: string },
    ];
    expect(taskCtx.userId).toBe('u-doty');
    expect(task).toMatchObject({
      title: 'Order O-000014 is approved but not paid: ask for the $1,208.00',
      assignedToUserId: 'u-doty',
      customerId: 'c-renee',
      priority: 'high',
    });
    expect(task.description).toContain('Make an invoice under Asking for payment');
  });

  it('gives the task to the owner when the account’s own approver approved it', async () => {
    capturePayment.mockResolvedValue({ success: false, errorMessage: 'card_declined' });
    await settle({ tenantId: TENANT }, [{ action: 'capture', ...card }]);
    expect(createTask.mock.calls[0]![1]).toMatchObject({ assignedToUserId: 'u-owner' });
  });

  it('records a gateway that is no longer set up as a failure, not a crash', async () => {
    capturePayment.mockRejectedValue(new PaymentConfigError('no gateway'));
    const [result] = await settle({ tenantId: TENANT }, [{ action: 'capture', ...card }]);
    expect(result).toMatchObject({ ok: false, error: 'no card payments are set up any more' });
    expect(createTask).toHaveBeenCalledTimes(1);
  });
});

describe('turned down: the buyer gets their money back', () => {
  it('lets a held card go and records it as let go', async () => {
    cancelPayment.mockResolvedValue({ success: true, status: 'canceled' });
    const [result] = await settle({ tenantId: TENANT }, [{ action: 'release', ...card }]);
    expect(result).toMatchObject({ ok: true });
    expect(cancelPayment).toHaveBeenCalledWith(TENANT, 'pi_wasatch');
    expect(paymentWrites[0]).toMatchObject({
      where: { id: 'pay-1' },
      data: { status: 'voided' },
    });
  });

  it('says so on the order when a hold cannot be lifted, which costs the buyer nothing', async () => {
    cancelPayment.mockResolvedValue({ success: false, errorMessage: 'rate limited' });
    const [result] = await settle({ tenantId: TENANT }, [{ action: 'release', ...card }]);
    expect(result).toMatchObject({ ok: false });
    expect(notes[0]!.description).toContain('drops off the card by itself');
    expect(createTask).not.toHaveBeenCalled();
  });

  it('refunds a charged card in full and records the refund against its payment', async () => {
    refund.mockResolvedValue({ success: true, refundId: 're_wasatch', amount: 120_800 });
    const [result] = await settle({ tenantId: TENANT, userId: 'u-doty' }, [
      { action: 'refund', ...card },
    ]);
    expect(result).toMatchObject({ ok: true });
    expect(refund).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, chargeId: 'pi_wasatch', amount: 120_800 })
    );
    expect(recordRefund).toHaveBeenCalledWith(
      { tenantId: TENANT, userId: 'u-doty' },
      {
        orderId: 'order-14',
        paymentId: 'pay-1',
        amount: 1208,
        currency: 'USD',
        reason: TURNED_DOWN_REFUND_REASON,
        processorRef: 're_wasatch',
      }
    );
  });

  it('hands a refund that did not go through to the business, and writes none', async () => {
    refund.mockResolvedValue({ success: false, amount: 0, errorMessage: 'charge_disputed' });
    const [result] = await settle({ tenantId: TENANT }, [{ action: 'refund', ...card }]);
    expect(result).toMatchObject({ ok: false, error: 'charge_disputed' });
    expect(recordRefund).not.toHaveBeenCalled();
    expect(createTask.mock.calls[0]![1]).toMatchObject({
      title: 'Order O-000014 was turned down: refund the $1,208.00 by hand',
      assignedToUserId: 'u-owner',
    });
  });
});
