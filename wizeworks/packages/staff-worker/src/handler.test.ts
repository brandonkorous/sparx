// The staff worker's per-message dispatch.
//
// Three payload shapes share one subscription, and they are a plain `z.union`
// rather than a discriminated one — which is exactly how the labour branch once
// came to believe its payload might be `{ orderId }`. These tests pin the
// dispatch itself: every subscribed topic parses, and each one reaches the
// handler that can actually read it.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { commissionForOrder, commissionForDeal, deriveLaborForPeriod, deriveLaborForRoster } =
  vi.hoisted(() => ({
    commissionForOrder: vi.fn(),
    commissionForDeal: vi.fn(),
    deriveLaborForPeriod: vi.fn(),
    deriveLaborForRoster: vi.fn(),
  }));

vi.mock('@wizeworks/staff', () => ({
  commissionForOrder,
  commissionForDeal,
  deriveLaborForPeriod,
  deriveLaborForRoster,
  monthPeriod: (d: Date) => ({
    from: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)),
    to: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)),
  }),
}));

const { handle, parseEvent } = await import('./handler.js');
const { EVENTS } = await import('./index.js');

const noop = vi.fn();
const logger = { info: noop, warn: noop, debug: noop } as never;

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORDER = '22222222-2222-4222-8222-222222222222';
const DEAL = '33333333-3333-4333-8333-333333333333';
const PERSON = '44444444-4444-4444-8444-444444444444';

function envelope(type: string, data: Record<string, unknown>) {
  return { type, tenantId: TENANT, actorId: null, occurredAt: '2026-08-13T00:00:00.000Z', data };
}

const EMPTY_DERIVATION = {
  expenseIds: [],
  totalCents: 0,
  unpricedMinutes: 0,
  perSite: [],
  unpricedDays: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  commissionForOrder.mockResolvedValue({ outcome: 'recorded', amountCents: 3_000 });
  commissionForDeal.mockResolvedValue({ outcome: 'recorded', amountCents: 5_000 });
  deriveLaborForPeriod.mockResolvedValue(EMPTY_DERIVATION);
  deriveLaborForRoster.mockResolvedValue({ derived: [EMPTY_DERIVATION], staffMemberIds: [] });
});

describe('parseEvent', () => {
  it('accepts every topic the worker subscribes to', () => {
    // The guard against the original bug's shape: a handler that can process an
    // event its subscription does not ask for is as dead as one nothing calls.
    for (const type of EVENTS) {
      const data =
        type === 'crm.deal.won'
          ? { dealId: DEAL }
          : type.startsWith('order.')
            ? { orderId: ORDER }
            : { staffMemberId: PERSON, workedOn: '2026-08-11' };
      expect(parseEvent(envelope(type, data))?.type).toBe(type);
    }
  });

  it('rejects a sale event with no id rather than guessing', () => {
    expect(parseEvent(envelope('order.paid', {}))).toBeNull();
    expect(parseEvent(envelope('crm.deal.won', {}))).toBeNull();
  });
});

describe('commission on a sale', () => {
  it('commissions a paid order', async () => {
    const result = await handle(parseEvent(envelope('order.paid', { orderId: ORDER }))!, logger);

    expect(commissionForOrder).toHaveBeenCalledWith(TENANT, ORDER);
    expect(deriveLaborForPeriod).not.toHaveBeenCalled();
    expect(result).toMatchObject({ outcome: 'commissioned', totalCents: 3_000 });
  });

  it('RE-runs on a refund rather than reversing it', async () => {
    // The refund path is the same calculation, not a compensating entry: the
    // calculator reduces the basis and the upsert moves the existing row.
    commissionForOrder.mockResolvedValueOnce({ outcome: 'recorded', amountCents: 1_500 });
    const result = await handle(
      parseEvent(envelope('order.refunded', { orderId: ORDER }))!,
      logger
    );

    expect(commissionForOrder).toHaveBeenCalledWith(TENANT, ORDER);
    expect(result.totalCents).toBe(1_500);
  });

  it('commissions a won deal', async () => {
    const result = await handle(parseEvent(envelope('crm.deal.won', { dealId: DEAL }))!, logger);

    expect(commissionForDeal).toHaveBeenCalledWith(TENANT, DEAL);
    expect(result).toMatchObject({ outcome: 'commissioned', totalCents: 5_000 });
  });

  it('carries WHY a sale earned nothing, instead of a bare skip', async () => {
    // "Nobody is credited" and "they are not on commission" are both ordinary,
    // and they are fixed in completely different places — so the outcome has to
    // survive as far as the log.
    for (const outcome of [
      'no-attribution',
      'no-rate',
      'rate-not-in-force',
      'not-payable',
      'unknown-sale',
    ]) {
      commissionForOrder.mockResolvedValueOnce({ outcome });
      const result = await handle(parseEvent(envelope('order.paid', { orderId: ORDER }))!, logger);
      expect(result).toMatchObject({ outcome: 'skipped', commission: outcome });
    }
  });
});

describe('labour derivation', () => {
  it('derives one person when the event names one', async () => {
    await handle(
      parseEvent(
        envelope('staff.time.approved', { staffMemberId: PERSON, workedOn: '2026-08-11' })
      )!,
      logger
    );

    expect(deriveLaborForPeriod).toHaveBeenCalledTimes(1);
    expect(deriveLaborForRoster).not.toHaveBeenCalled();
  });

  it('derives the whole roster when it does not', async () => {
    await handle(parseEvent(envelope('staff.time.approved', { workedOn: '2026-08-11' }))!, logger);

    expect(deriveLaborForRoster).toHaveBeenCalledTimes(1);
    expect(deriveLaborForPeriod).not.toHaveBeenCalled();
  });

  it('clamps an absurd span instead of walking it', async () => {
    // A replayed event with an epoch date would otherwise walk the roster over
    // thousands of days inside the shared worker process.
    await handle(
      parseEvent(
        envelope('staff.time.approved', {
          staffMemberId: PERSON,
          from: '1970-01-01',
          to: '2026-08-11',
        })
      )!,
      logger
    );

    const call = deriveLaborForPeriod.mock.calls[0]?.[1] as { periodStart: Date; periodEnd: Date };
    const days = (call.periodEnd.getTime() - call.periodStart.getTime()) / 86_400_000;
    expect(days).toBeLessThanOrEqual(400);
  });

  it('warns when hours cannot be priced — the number that explains a low figure', async () => {
    deriveLaborForPeriod.mockResolvedValueOnce({ ...EMPTY_DERIVATION, unpricedMinutes: 270 });
    const warn = vi.fn();
    const result = await handle(
      parseEvent(envelope('staff.time.approved', { staffMemberId: PERSON }))!,
      { info: noop, warn, debug: noop } as never
    );

    expect(warn).toHaveBeenCalled();
    expect(result.unpricedMinutes).toBe(270);
  });
});
