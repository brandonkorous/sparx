// AN EMPTY SIGN-OFF QUEUE MUST NOT READ AS REASSURANCE.
//
// Measured: zero purchase-order spending limits exist across every tenant, and
// zero orders have ever been held for sign-off. Every business was told "Every
// order that needed signing off has been dealt with."

import { describe, expect, it } from 'vitest';
import { poApprovalsEmptyWords, type PoApprovalLimit } from './po-approvals-empty';

const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US')}.00`;

function limit(partial: Partial<PoApprovalLimit> = {}): PoApprovalLimit {
  return { isActive: true, minAmountCents: 500_000, ...partial };
}

describe('poApprovalsEmptyWords', () => {
  it('says no order can be held when no limit exists', () => {
    // Every tenant on the platform, today.
    const words = poApprovalsEmptyWords('pending', [], money);
    expect(words.title).toBe('No order can be held for sign-off');
    expect(words.detail).toContain('You have not set a spending limit');
    expect(words.detail).toContain('every order goes straight to the supplier');
    expect(words.detail).not.toContain('dealt with');
  });

  it('says the one limit is off rather than that everything was dealt with', () => {
    const words = poApprovalsEmptyWords('pending', [limit({ isActive: false })], money);
    expect(words.title).toBe('Your spending limit is switched off');
    expect(words.detail).toContain('no order is being held');
    expect(words.detail).not.toContain('dealt with');
  });

  it('counts them when several are off, and stays plural', () => {
    const words = poApprovalsEmptyWords(
      'pending',
      [limit({ isActive: false }), limit({ isActive: false, minAmountCents: 100_000 })],
      money
    );
    expect(words.title).toBe('Your spending limits are switched off');
    expect(words.detail).toContain('All 2 of your limits');
  });

  it('names the limit that actually bites when one is on', () => {
    const words = poApprovalsEmptyWords(
      'pending',
      [limit({ isActive: true }), limit({ isActive: true, minAmountCents: 100_000 })],
      money
    );
    expect(words.title).toBe('Nothing is waiting on you');
    expect(words.detail).toContain('every order of $1,000.00 or more');
    expect(words.detail).not.toContain('$5,000.00');
  });

  it('calls a zero limit every order', () => {
    const words = poApprovalsEmptyWords('pending', [limit({ minAmountCents: 0 })], money);
    expect(words.detail).toContain('You are holding every order,');
    expect(words.detail).not.toContain('$0');
  });

  it('leaves the other tabs alone', () => {
    // Approved / rejected / cancelled are a plain "nothing reached this state",
    // which is true whatever the limits say.
    for (const status of ['approved', 'rejected', 'cancelled']) {
      expect(poApprovalsEmptyWords(status, [], money).title).toBe('Nothing here');
    }
  });

  it('never claims orders were dealt with while nothing can be held', () => {
    // The property: the reassuring sentence may appear only when a live limit
    // exists to make it meaningful.
    const shapes: PoApprovalLimit[][] = [
      [],
      [limit({ isActive: false })],
      [limit({ isActive: false }), limit({ isActive: false })],
      [limit({ isActive: false }), limit({ isActive: true })],
      [limit({ isActive: true })],
    ];
    for (const limits of shapes) {
      const words = poApprovalsEmptyWords('pending', limits, money);
      expect(words.detail.includes('dealt with'), JSON.stringify(limits)).toBe(
        limits.some((one) => one.isActive)
      );
    }
  });

  it('does not say a state was not reached when there is no state', () => {
    // "Everything" is the one filter with nothing to reach. The other three
    // share "No order has reached this state", which under Everything would be
    // telling her that nothing reached everything.
    const words = poApprovalsEmptyWords('all', [limit()], money);

    expect(words.title).toBe('No order has ever been held for sign-off');
    expect(words.detail).not.toContain('reached this state');
  });

  it('keeps the four decided filters on the plain sentence', () => {
    for (const status of ['approved', 'rejected', 'cancelled']) {
      const words = poApprovalsEmptyWords(status, [limit()], money);
      expect(words.title).toBe('Nothing here');
    }
  });
});
