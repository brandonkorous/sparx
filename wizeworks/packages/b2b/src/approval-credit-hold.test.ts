// A held order's page says when the account was out of credit (sparx persona
// issue 187). The reason was on the order all along; the view never carried it.

import { describe, expect, it } from 'vitest';

import { creditHoldOf, creditLeftNowCents } from './approval';

describe('creditHoldOf', () => {
  it('reads the credit an order ran past from its own hold reasons', () => {
    const metadata = {
      approvalHold: {
        reasons: [
          { kind: 'over_credit_limit', currency: 'USD', creditLeft: 1676.08, orderTotal: 2026.38 },
          { kind: 'approval_rule', ruleId: '40ca8bb6-74cb-4225-aea1-e21bffdfe10e' },
        ],
      },
    };
    expect(creditHoldOf(metadata)).toEqual({
      creditLeftCents: 167_608,
      orderTotalCents: 202_638,
      currency: 'USD',
    });
  });

  it('is null for an order held only by a spending limit', () => {
    const metadata = {
      approvalHold: { reasons: [{ kind: 'approval_rule', ruleId: 'r' }] },
    };
    expect(creditHoldOf(metadata)).toBeNull();
  });
});

describe('creditLeftNowCents (sparx persona issue 188)', () => {
  it('is what the account has left today, in cents', () => {
    expect(creditLeftNowCents({ creditLimit: '10000.00', creditUsed: '6204.32' })).toBe(379_568);
  });

  it('is zero, never negative, past the limit', () => {
    expect(creditLeftNowCents({ creditLimit: '1000', creditUsed: '1200' })).toBe(0);
  });

  it('is unknown when no limit is set', () => {
    expect(creditLeftNowCents({ creditLimit: null, creditUsed: '50' })).toBeNull();
  });
});
