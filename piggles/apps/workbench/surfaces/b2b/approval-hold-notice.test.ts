// THE EMPTY QUEUE MUST NOT PROMISE A CONTROL THAT IS SWITCHED OFF,
// OR A LIMIT ON ONE SHOP AS A LIMIT ON EVERYBODY.
//
// Measured on the real database: 38 tenants have a spending limit written down
// and 34 of them have every one switched off. All 34 were told "when one goes
// over a limit you set below, it lands here", with an Off badge on the very
// rule the sentence was about.
//
// The second half is issue 752, read on screen 2026-09-20: a $2,500 limit
// naming Loom and Larder sat beside a $5,000 limit on everybody, and the queue
// reported "every order over $2,500.00".

import { describe, expect, it } from 'vitest';
import { holdQueueNotice, type HoldRule } from './approval-hold-notice';

function rule(partial: Partial<HoldRule> = {}): HoldRule {
  return {
    isActive: true,
    minAmountCents: 500_000,
    minAmountFormatted: '$5,000.00',
    accountName: null,
    ...partial,
  };
}

/** The $2,500 limit that named one shop, exactly as it was entered. */
function loomRule(partial: Partial<HoldRule> = {}): HoldRule {
  return rule({
    minAmountCents: 250_000,
    minAmountFormatted: '$2,500.00',
    accountName: 'Loom and Larder',
    ...partial,
  });
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

  /* ── Who a limit is for (issue 752) ───────────────────────────────────── */

  it('does not report a limit on one shop as a limit on everybody', () => {
    // The screen as it stood: $5,000 on everybody, $2,500 on Loom and Larder.
    // A different shop ordering $4,000 is NOT held, so "every order over
    // $2,500.00" is a promise the rules do not keep.
    const notice = holdQueueNotice([rule(), loomRule()]);
    expect(notice.detail).not.toContain('every order over $2,500.00');
    expect(notice.detail).toContain('every order over $5,000.00');
    expect(notice.detail).toContain('anything over $2,500.00 from Loom and Larder');
  });

  it('says nobody else is covered when every live limit names a customer', () => {
    const notice = holdQueueNotice([rule({ isActive: false }), loomRule()]);
    expect(notice.detail).toContain('anything over $2,500.00 from Loom and Larder');
    expect(notice.detail).toContain('No other customer’s order is held, however large.');
    expect(notice.detail).not.toContain('every order');
  });

  it('counts named customers rather than listing them', () => {
    const notice = holdQueueNotice([
      loomRule(),
      loomRule({ accountName: 'Atlas Supply Co', minAmountFormatted: '$3,000.00' }),
    ]);
    expect(notice.detail).toContain(
      'orders from 2 wholesale customers, each over a limit of its own'
    );
    expect(notice.detail).toContain('however large');
  });

  it('keeps the blanket limit first when named customers sit under it', () => {
    const notice = holdQueueNotice([
      rule(),
      loomRule(),
      loomRule({ accountName: 'Atlas Supply Co' }),
    ]);
    expect(notice.detail).toContain('every order over $5,000.00');
    expect(notice.detail).toContain('2 wholesale customers have a limit of their own');
    expect(notice.detail).not.toContain('however large');
  });

  it('names a shop on a zero limit rather than saying "over $0.00"', () => {
    const notice = holdQueueNotice([loomRule({ minAmountCents: 0, minAmountFormatted: '$0.00' })]);
    expect(notice.detail).toContain('everything from Loom and Larder');
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
      [loomRule({ isActive: false })],
      [loomRule()],
      [rule(), loomRule()],
    ];
    for (const rules of shapes) {
      const notice = holdQueueNotice(rules);
      const promises = notice.detail.includes('lands here');
      const anyLive = rules.some((one) => one.isActive);
      expect(promises, JSON.stringify(rules)).toBe(anyLive);
    }
  });

  it('never says "every order" about an amount only one customer is held to', () => {
    // The property behind issue 752. Whatever the mix, an amount printed after
    // "every order over" has to be one that applies to everybody.
    const shapes: HoldRule[][] = [
      [loomRule()],
      [rule(), loomRule()],
      [rule({ isActive: false }), loomRule()],
      [loomRule(), loomRule({ accountName: 'Atlas Supply Co' })],
      [rule(), loomRule(), loomRule({ accountName: 'Atlas Supply Co' })],
    ];
    for (const rules of shapes) {
      const notice = holdQueueNotice(rules);
      for (const one of rules) {
        if (!one.isActive || one.accountName === null) continue;
        expect(notice.detail, JSON.stringify(rules)).not.toContain(
          `every order over ${one.minAmountFormatted}`
        );
      }
    }
  });
});
