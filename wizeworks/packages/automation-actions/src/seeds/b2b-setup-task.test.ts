import { describe, expect, it } from 'vitest';

import { evaluateConditions } from '@wizeworks/automation-schemas';
import { ACCOUNT_SET_UP_TO_DO, accountNeedsSetUp } from '@wizeworks/crm';

import { B2B_NEW_ACCOUNT_TASK } from './b2b.js';

// A "set up prices and terms" task is only worth opening when that job is
// still to do (sparx persona issue 080): five accounts added complete got five
// open tasks asking for what was already done.
const opens = (fields: Record<string, unknown>) =>
  evaluateConditions(B2B_NEW_ACCOUNT_TASK.conditions, fields);

const CASES = [
  { terms: null, limit: 0 },
  { terms: null, limit: 25000 },
  { terms: 'net30', limit: 0 },
  { terms: 'net30', limit: 25000 },
  { terms: 'prepay', limit: 0 },
  { terms: 'net14', limit: 0.01 },
];

describe('the new wholesale customer set-up task', () => {
  it('opens when no terms were chosen', () => {
    expect(opens({ 'b2bAccount.paymentTerms': null, 'b2bAccount.creditLimit': 0 })).toBe(true);
  });

  it('opens when they are on terms with nothing to order against', () => {
    expect(opens({ 'b2bAccount.paymentTerms': 'net30', 'b2bAccount.creditLimit': 0 })).toBe(true);
  });

  it('stays quiet when terms and a credit limit are already set', () => {
    expect(opens({ 'b2bAccount.paymentTerms': 'net30', 'b2bAccount.creditLimit': 25000 })).toBe(
      false
    );
  });

  it('stays quiet for an account that pays before dispatch', () => {
    expect(opens({ 'b2bAccount.paymentTerms': 'prepay', 'b2bAccount.creditLimit': 0 })).toBe(false);
  });

  // Wasatch Front was put on Net 30 with a $25,000 limit and its task stayed
  // open: nothing closed it. It now closes by the rule that opened it, so the
  // two can never disagree about whether the job is done.
  it('opens on the very rule its task closes by', () => {
    expect(B2B_NEW_ACCOUNT_TASK.conditions).toBe(ACCOUNT_SET_UP_TO_DO);
  });

  it('agrees with the closing side on every account', () => {
    for (const { terms, limit } of CASES) {
      expect(
        opens({ 'b2bAccount.paymentTerms': terms, 'b2bAccount.creditLimit': limit }),
        `${String(terms)} with a limit of ${String(limit)}`
      ).toBe(accountNeedsSetUp({ paymentTerms: terms, creditLimit: limit }));
    }
  });

  it('closes its task once the account is set up', () => {
    expect(B2B_NEW_ACCOUNT_TASK.actions[0]).toMatchObject({
      type: 'crm.create_task',
      config: { closeWhenAccountSetUp: true },
    });
  });
});
