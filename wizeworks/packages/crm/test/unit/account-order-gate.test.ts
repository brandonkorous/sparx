// One rule for a trade account's order, whichever path wrote it (sparx persona
// issue 085). The /b2b page promises an order that would run an account past
// its credit limit WAITS for the owner's sign-off. The checkout refused it, and
// an accepted quote made no order to decide about.

import { describe, expect, it } from 'vitest';
import {
  approvalHoldReasons,
  termsDecision,
  withApprovalHold,
  type HoldReason,
} from '../../src/services/account-order-gate';

/** An account good for $5,000, owing $1,193 of it: $3,807 left. */
const open = { status: 'active', creditLimit: '5000.00', creditUsed: '1193.00' };

describe('termsDecision', () => {
  it('lets an order through when the account has room for it', () => {
    expect(termsDecision(open, 100000, 'USD')).toEqual({ kind: 'place' });
    // Exactly the remaining credit still fits.
    expect(termsDecision(open, 380700, 'USD')).toEqual({ kind: 'place' });
  });

  it('holds an order a cent past the limit, with both figures, rather than refusing it', () => {
    expect(termsDecision(open, 380800, 'USD')).toEqual({
      kind: 'hold',
      reason: { kind: 'over_credit_limit', orderTotal: 3808, creditLeft: 3807, currency: 'USD' },
    });
  });

  it('holds every order against a limit nobody set', () => {
    const zero = { status: 'active', creditLimit: '0.00', creditUsed: '0.00' };
    expect(termsDecision(zero, 1, 'USD').kind).toBe('hold');
  });

  it('never reports negative credit left on an account already over', () => {
    const over = { status: 'active', creditLimit: '1000.00', creditUsed: '1500.00' };
    const decision = termsDecision(over, 100, 'USD');
    expect(decision.kind === 'hold' && decision.reason.creditLeft).toBe(0);
  });

  it('refuses an account the business has stopped, whatever its balance', () => {
    const held = { status: 'credit_hold', creditLimit: '5000.00', creditUsed: '0.00' };
    const off = { status: 'suspended', creditLimit: '5000.00', creditUsed: '0.00' };
    const dormant = { status: 'inactive', creditLimit: '5000.00', creditUsed: '0.00' };
    expect(termsDecision(held, 100, 'USD')).toMatchObject({ kind: 'refuse' });
    expect(termsDecision(off, 100, 'USD')).toMatchObject({ kind: 'refuse' });
    expect(termsDecision(dormant, 100, 'USD')).toMatchObject({ kind: 'refuse' });
    const message = termsDecision(held, 100, 'USD');
    expect(message.kind === 'refuse' && message.message).toContain('credit hold');
  });

  it('waits rather than waving through when a figure cannot be read', () => {
    const broken = { status: 'active', creditLimit: 'n/a', creditUsed: '0.00' };
    const nulls = { status: 'active', creditLimit: null, creditUsed: undefined };
    expect(termsDecision(broken, 100, 'USD').kind).toBe('hold');
    expect(termsDecision(nulls, 100, 'USD').kind).toBe('hold');
  });
});

describe('the reasons an order is waiting, on its metadata', () => {
  const reasons: HoldReason[] = [
    { kind: 'over_credit_limit', orderTotal: 3808, creditLeft: 3807, currency: 'USD' },
    { kind: 'approval_rule', ruleId: 'rule-1' },
  ];

  it('reads back exactly what was written, beside the keys already there', () => {
    const metadata = withApprovalHold({ poNumber: 'WFUC-24-0901' }, reasons);
    expect(metadata.poNumber).toBe('WFUC-24-0901');
    expect(approvalHoldReasons(metadata)).toEqual(reasons);
  });

  it('writes nothing for an order that is not held', () => {
    expect(withApprovalHold({ poNumber: 'X' }, [])).toEqual({ poNumber: 'X' });
  });

  it('drops anything it cannot read rather than guessing', () => {
    expect(approvalHoldReasons(null)).toEqual([]);
    expect(approvalHoldReasons({ approvalHold: { reasons: [{ kind: 'mystery' }] } })).toEqual([]);
  });
});
