// Who has to say yes before a held wholesale order goes ahead (sparx persona
// issue 087).
//
// Wasatch Front had a contact whose role read "Can approve orders", and nothing
// ever asked her: every held order went to the business's team. A spending
// limit can now be signed off by the account's own approvers. What this pins:
//
//   1. A limit the account signs asks the account, and not the business too:
//      it is the buyer's own spending control.
//   2. The credit limit is the business's money, so an order over it always
//      asks the business, whoever else signs.
//   3. An account with nobody who can approve falls back to the business, so
//      a held order never waits on nobody.
//   4. The order goes ahead when the last side asked has signed, in either
//      order, and a signature from a side nobody asked does not count.

import { describe, expect, it } from 'vitest';
import {
  approvalSignatures,
  signOffState,
  withApprovalHold,
  withSignature,
  type AccountApprover,
  type HoldReason,
} from '../../src/services/account-order-gate';

const TEODORA: AccountApprover = {
  customerId: 'c-teodora',
  name: 'Teodora Vukić-Hale',
  email: 'teodora.vukic-hale@wasatchutility.test',
};
const LIMIT: HoldReason = { kind: 'approval_rule', ruleId: 'rule-1000' };
const CREDIT: HoldReason = {
  kind: 'over_credit_limit',
  orderTotal: 1208,
  creditLeft: 900,
  currency: 'USD',
};
const SIGNED = { name: 'Teodora Vukić-Hale', at: '2026-10-03T16:00:00.000Z' };

describe('who is asked', () => {
  it('a limit the account signs asks only the account', () => {
    const state = signOffState({
      reasons: [LIMIT],
      rule: { signOffBy: 'account' },
      accountApprovers: [TEODORA],
      signed: {},
    });
    expect(state.needs).toEqual(['account']);
    expect(state.waitingOn).toEqual(['account']);
  });

  it('a limit the business signs asks only the business', () => {
    const state = signOffState({
      reasons: [LIMIT],
      rule: { signOffBy: 'business' },
      accountApprovers: [TEODORA],
      signed: {},
    });
    expect(state.needs).toEqual(['business']);
  });

  it('over the credit limit asks the business too', () => {
    const state = signOffState({
      reasons: [LIMIT, CREDIT],
      rule: { signOffBy: 'account' },
      accountApprovers: [TEODORA],
      signed: {},
    });
    expect(state.needs).toEqual(['account', 'business']);
  });

  it('held for credit alone is never the account’s to sign', () => {
    const state = signOffState({
      reasons: [CREDIT],
      rule: { signOffBy: 'account' },
      accountApprovers: [TEODORA],
      signed: {},
    });
    expect(state.needs).toEqual(['business']);
  });

  it('an account with nobody who can approve falls back to the business', () => {
    const state = signOffState({
      reasons: [LIMIT],
      rule: { signOffBy: 'account' },
      accountApprovers: [],
      signed: {},
    });
    expect(state.needs).toEqual(['business']);
  });

  it('an order no rule governs any more is the business’s to release', () => {
    const state = signOffState({
      reasons: [LIMIT],
      rule: null,
      accountApprovers: [TEODORA],
      signed: {},
    });
    expect(state.needs).toEqual(['business']);
  });
});

describe('when it goes ahead', () => {
  it('waits on the business after the account signs, when both are asked', () => {
    const state = signOffState({
      reasons: [LIMIT, CREDIT],
      rule: { signOffBy: 'account' },
      accountApprovers: [TEODORA],
      signed: { account: SIGNED },
    });
    expect(state.waitingOn).toEqual(['business']);
  });

  it('waits on nobody once every side asked has signed', () => {
    const state = signOffState({
      reasons: [LIMIT],
      rule: { signOffBy: 'account' },
      accountApprovers: [TEODORA],
      signed: { account: SIGNED },
    });
    expect(state.waitingOn).toEqual([]);
  });

  it('a signature from a side nobody asked does not count', () => {
    const state = signOffState({
      reasons: [LIMIT],
      rule: { signOffBy: 'business' },
      accountApprovers: [TEODORA],
      signed: { account: SIGNED },
    });
    expect(state.waitingOn).toEqual(['business']);
    expect(state.signed).toEqual({});
  });
});

describe('signatures on the order', () => {
  it('keep the reasons it was held beside them', () => {
    const held = withApprovalHold({ poNumber: 'WFU-PO-24-0917' }, [LIMIT]);
    const signed = withSignature(held, 'account', { ...SIGNED, customerId: 'c-teodora' });
    expect(approvalSignatures(signed)).toEqual({
      account: { ...SIGNED, customerId: 'c-teodora' },
    });
    expect(signed).toMatchObject({
      poNumber: 'WFU-PO-24-0917',
      approvalHold: { reasons: [LIMIT] },
    });
  });

  it('a second side adds to the first rather than replacing it', () => {
    const one = withSignature({}, 'account', SIGNED);
    const both = withSignature(one, 'business', { name: 'Doty Brown', at: SIGNED.at });
    expect(Object.keys(approvalSignatures(both))).toEqual(['account', 'business']);
  });

  it('a signature that does not parse reads as not signed', () => {
    expect(approvalSignatures({ approvalHold: { signed: { account: { name: 7 } } } })).toEqual({});
  });
});
