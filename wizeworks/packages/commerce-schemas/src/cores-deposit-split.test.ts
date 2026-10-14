// A returned core's deposit comes off the open invoice first (sparx persona issue
// 183). Wasatch's O-000007 sat on INV-000001, unpaid; its $150.00 deposit had
// never been paid, so none of it could go back.

import { describe, expect, it } from 'vitest';

import { coresOutstanding, splitCoreDeposit } from './cores';

describe('splitCoreDeposit', () => {
  it('takes the whole deposit off an invoice that still owes more', () => {
    expect(splitCoreDeposit(15_000, 67_800)).toEqual({ offInvoiceCents: 15_000, backCents: 0 });
  });

  it('gives back only what the invoice cannot take', () => {
    expect(splitCoreDeposit(90_000, 30_000)).toEqual({
      offInvoiceCents: 30_000,
      backCents: 60_000,
    });
  });

  it('gives all of it back when nothing is owed', () => {
    expect(splitCoreDeposit(15_000, 0)).toEqual({ offInvoiceCents: 0, backCents: 15_000 });
  });
});

// Nobody owes an old part for a new one still on the shelf (sparx persona issue
// 184). Wasatch's six injectors on O-000008 had not been handed over, and Cores
// owed chased all six.
describe('coresOutstanding', () => {
  const line = {
    quantity: 6,
    quantityFulfilled: 0,
    quantityRefunded: 0,
    coresReturned: 0,
    coresKept: 0,
    coreFirst: false,
  };

  it('owes nothing on parts not handed over yet', () => {
    expect(coresOutstanding(line)).toBe(0);
  });

  it('owes one core for each part handed over', () => {
    expect(coresOutstanding({ ...line, quantityFulfilled: 2 })).toBe(2);
  });

  it('counts a core that came back early against the parts handed over', () => {
    expect(coresOutstanding({ ...line, quantityFulfilled: 2, coresReturned: 1 })).toBe(1);
  });

  it('counts a part that came back itself as its own core', () => {
    expect(
      coresOutstanding({ ...line, quantity: 1, quantityFulfilled: 1, quantityRefunded: 1 })
    ).toBe(0);
  });

  it('owes the old part first on a send-first line, before anything goes', () => {
    expect(coresOutstanding({ ...line, quantity: 1, coreFirst: true })).toBe(1);
  });
});
