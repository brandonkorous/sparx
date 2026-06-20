import { describe, expect, it } from 'vitest';

import {
  computeLateCancelFee,
  computeNoShowFee,
  isLateCancellation,
  resolveDepositPlan,
  type DepositPolicyInput,
} from './deposits';

const base: DepositPolicyInput = {
  depositType: 'none',
  cancellationWindowHours: 24,
};

const PRICE = 10_000; // $100.00

describe('resolveDepositPlan', () => {
  it('none → collect nothing', () => {
    expect(resolveDepositPlan(base, PRICE)).toEqual({
      type: 'none',
      amountCents: 0,
      captureMethod: 'automatic',
    });
  });

  it('prepay → charge full price, automatic capture', () => {
    expect(resolveDepositPlan({ ...base, depositType: 'prepay' }, PRICE)).toEqual({
      type: 'prepay',
      amountCents: PRICE,
      captureMethod: 'automatic',
    });
  });

  it('deposit fixed amount → charge that, automatic', () => {
    expect(
      resolveDepositPlan({ ...base, depositType: 'deposit', depositAmountCents: 2500 }, PRICE)
    ).toEqual({ type: 'deposit', amountCents: 2500, captureMethod: 'automatic' });
  });

  it('deposit percent → charge percent of price', () => {
    expect(
      resolveDepositPlan({ ...base, depositType: 'deposit', depositPercent: 20 }, PRICE)
    ).toMatchObject({ type: 'deposit', amountCents: 2000 });
  });

  it('card_hold → authorize the worst-case fee, manual capture', () => {
    const plan = resolveDepositPlan(
      {
        ...base,
        depositType: 'card_hold',
        noShowFeeType: 'percent',
        noShowFeeValue: 50, // $50
        lateCancelFeeType: 'fixed',
        lateCancelFeeValue: 3000, // $30
      },
      PRICE
    );
    // max($50 no-show, $30 late) = $50.
    expect(plan).toEqual({ type: 'card_hold', amountCents: 5000, captureMethod: 'manual' });
  });

  it('a type whose amount computes to 0 collapses to none', () => {
    expect(resolveDepositPlan({ ...base, depositType: 'deposit' }, PRICE).type).toBe('none');
    expect(resolveDepositPlan({ ...base, depositType: 'card_hold' }, PRICE).type).toBe('none');
    expect(resolveDepositPlan({ ...base, depositType: 'prepay' }, 0).type).toBe('none');
  });
});

describe('computeNoShowFee / computeLateCancelFee', () => {
  it('fixed is cents; percent is a percent of the service price', () => {
    expect(computeNoShowFee({ ...base, noShowFeeType: 'fixed', noShowFeeValue: 2500 }, PRICE)).toBe(
      2500
    );
    expect(computeNoShowFee({ ...base, noShowFeeType: 'percent', noShowFeeValue: 25 }, PRICE)).toBe(
      2500
    );
    expect(
      computeLateCancelFee({ ...base, lateCancelFeeType: 'percent', lateCancelFeeValue: 10 }, PRICE)
    ).toBe(1000);
  });

  it('absent / zero / unknown fee → 0', () => {
    expect(computeNoShowFee(base, PRICE)).toBe(0);
    expect(computeNoShowFee({ ...base, noShowFeeType: 'fixed', noShowFeeValue: 0 }, PRICE)).toBe(0);
    expect(computeNoShowFee({ ...base, noShowFeeType: 'weird', noShowFeeValue: 99 }, PRICE)).toBe(
      0
    );
  });
});

describe('isLateCancellation', () => {
  const start = new Date('2026-07-01T12:00:00.000Z');

  it('inside the notice window → late', () => {
    // 2h before a 24h-window booking → late.
    expect(isLateCancellation(base, start, new Date('2026-07-01T10:00:00.000Z'))).toBe(true);
  });

  it('outside the window → not late', () => {
    // 3 days before → on time.
    expect(isLateCancellation(base, start, new Date('2026-06-28T12:00:00.000Z'))).toBe(false);
  });

  it('a 0-hour window never counts as late', () => {
    expect(
      isLateCancellation({ ...base, cancellationWindowHours: 0 }, start, new Date(start.getTime()))
    ).toBe(false);
  });
});
