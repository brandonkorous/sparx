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
import {
  holdQueueNotice,
  holdReasonWords,
  type HoldRule,
  type QueueHoldReason,
} from './approval-hold-notice';

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
    expect(notice.detail).toContain('no order is being held for its size');
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
    expect(notice.detail).toContain(
      'No other customer’s order is held for its size, however large.'
    );
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

// Sparx persona issue 085: an order over the credit limit waits for sign-off
// whatever the spending limits say, so no empty-queue sentence may promise that
// nothing is held.
describe('the credit limit', () => {
  it('is mentioned in every state of the empty queue', () => {
    const shapes: HoldRule[][] = [
      [],
      [rule({ isActive: false })],
      [rule({ isActive: false }), rule({ isActive: false, minAmountCents: 1 })],
      [rule()],
      [loomRule()],
      [rule(), loomRule()],
    ];
    for (const rules of shapes) {
      expect(holdQueueNotice(rules).detail, JSON.stringify(rules)).toContain(
        'past its credit limit still waits here'
      );
    }
  });
});

// Sparx persona issue 087: a limit can be signed off by the customer's own
// approvers, so "waits here for your yes" is wrong about the orders it holds.
describe('a limit the customer signs off', () => {
  it('says the order waits for the customer’s approvers, not for you', () => {
    const shapes: HoldRule[][] = [
      [rule({ signOffBy: 'account' })],
      [loomRule({ signOffBy: 'account' })],
      [rule(), loomRule({ signOffBy: 'account' })],
    ];
    for (const rules of shapes) {
      expect(holdQueueNotice(rules).detail, JSON.stringify(rules)).toContain(
        'signed off by the customer’s own approvers, the order waits here for them'
      );
    }
  });

  it('says nothing of it while that limit is switched off, or when the team signs', () => {
    expect(
      holdQueueNotice([rule(), loomRule({ signOffBy: 'account', isActive: false })]).detail
    ).not.toContain('own approvers');
    expect(holdQueueNotice([rule({ signOffBy: 'business' })]).detail).not.toContain(
      'own approvers'
    );
  });

  it('offers both when no limit is set yet', () => {
    expect(holdQueueNotice([]).detail).toContain(
      'from your team or from the customer’s own approvers'
    );
  });
});

describe('holdReasonWords', () => {
  const money = (cents: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);

  it('gives both figures for an order over the credit limit', () => {
    const reason: QueueHoldReason = {
      kind: 'over_credit_limit',
      orderTotal: 3808,
      creditLeft: 3807,
      currency: 'USD',
    };
    expect(holdReasonWords(reason, money, 'USD')).toBe(
      'Over the credit limit: it comes to $3,808.00 and the account has $3,807.00 of credit left.'
    );
  });

  it('says there is no credit left rather than printing $0.00', () => {
    const reason: QueueHoldReason = {
      kind: 'over_credit_limit',
      orderTotal: 12.5,
      creditLeft: 0,
      currency: 'USD',
    };
    expect(holdReasonWords(reason, money, 'USD')).toContain('has no credit left');
  });

  it('names the spending limit by its amount, and a zero limit as every order', () => {
    expect(holdReasonWords({ kind: 'approval_rule', limitCents: 250000 }, money, 'USD')).toBe(
      'Over your $2,500.00 spending limit.'
    );
    expect(holdReasonWords({ kind: 'approval_rule', limitCents: 0 }, money, 'USD')).toBe(
      'You hold every order from them for sign-off.'
    );
    expect(holdReasonWords({ kind: 'approval_rule', limitCents: null }, money, 'USD')).toBe(
      'Over a spending limit you set.'
    );
  });
});
