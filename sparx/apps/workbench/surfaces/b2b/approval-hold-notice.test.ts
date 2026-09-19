// THE EMPTY QUEUE MUST NOT PROMISE A CONTROL THAT IS SWITCHED OFF.
//
// Measured on the real database: 38 tenants have a spending limit written down
// and 34 of them have every one switched off. All 34 were told "when one goes
// over a limit you set below, it lands here", with an Off badge on the very
// rule the sentence was about.

import { describe, expect, it } from 'vitest';
import { holdQueueNotice, type HoldRule } from './approval-hold-notice';

function rule(partial: Partial<HoldRule> = {}): HoldRule {
  return {
    isActive: true,
    minAmountCents: 500_000,
    minAmountFormatted: '$5,000.00',
    ...partial,
  };
}

describe('holdQueueNotice', () => {
  it('says nothing is set when no limit exists', () => {
    const notice = holdQueueNotice([]);
    expect(notice.title).toBe('Nothing waiting, and nothing set to wait');
    expect(notice.detail).toContain('you have not set a limit yet');
  });

  it('says the one limit is off, not that orders will be held', () => {
    // Juniper Row exactly: a single $5,000 rule, switched off.
    const notice = holdQueueNotice([rule({ isActive: false })]);
    expect(notice.title).toBe('Your limit is switched off');
    expect(notice.detail).toContain('it is switched off');
    expect(notice.detail).toContain('no order is being held');
    expect(notice.detail).not.toContain('lands here');
  });

  it('counts them when several are off, and stays plural', () => {
    const notice = holdQueueNotice([
      rule({ isActive: false }),
      rule({ isActive: false, minAmountCents: 250_000, minAmountFormatted: '$2,500.00' }),
    ]);
    expect(notice.title).toBe('Your limits are switched off');
    expect(notice.detail).toContain('All 2 of the limits');
    expect(notice.detail).not.toContain('it is switched off');
  });

  it('names the limit that actually bites when one is on', () => {
    // Atlas Supply Co: a $5,000 rule off, a $2,500 rule on. $2,500 is the one
    // an order has to clear, so it is the one worth printing.
    const notice = holdQueueNotice([
      rule({ isActive: false }),
      rule({ isActive: true, minAmountCents: 250_000, minAmountFormatted: '$2,500.00' }),
    ]);
    expect(notice.title).toBe('Nothing waiting');
    expect(notice.detail).toContain('every order over $2,500.00');
    expect(notice.detail).not.toContain('$5,000.00');
  });

  it('calls a zero limit every order, not "over $0.00"', () => {
    const notice = holdQueueNotice([
      rule({ isActive: true, minAmountCents: 0, minAmountFormatted: '$0.00' }),
    ]);
    expect(notice.detail).toContain('You are holding every order,');
    expect(notice.detail).not.toContain('$0.00');
  });

  it('never tells a business its orders will be held while every limit is off', () => {
    // The property, rather than a case: whatever the shape of the rules, the
    // promise and the switches have to agree.
    const shapes: HoldRule[][] = [
      [],
      [rule({ isActive: false })],
      [rule({ isActive: false }), rule({ isActive: false, minAmountCents: 1 })],
      [rule({ isActive: false }), rule({ isActive: true })],
      [rule({ isActive: true })],
    ];
    for (const rules of shapes) {
      const notice = holdQueueNotice(rules);
      const promises = notice.detail.includes('lands here');
      const anyLive = rules.some((one) => one.isActive);
      expect(promises, JSON.stringify(rules)).toBe(anyLive);
    }
  });
});
