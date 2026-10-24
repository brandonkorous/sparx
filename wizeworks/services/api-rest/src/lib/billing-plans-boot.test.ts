import { afterEach, describe, expect, it } from 'vitest';
import { resetBillingPlansForTesting } from '@wizeworks/billing';
import { loadBillingPlansAtBoot } from './billing-boot-check.js';

// A malformed BILLING_PLANS only surfaced on the first billing request: 87 errors on
// 10-18 (fixed by dfaac9387). Loading at boot fails the rollout instead.

const saved = process.env.BILLING_PLANS;

afterEach(() => {
  if (saved === undefined) delete process.env.BILLING_PLANS;
  else process.env.BILLING_PLANS = saved;
  resetBillingPlansForTesting();
});

describe('loadBillingPlansAtBoot', () => {
  it('throws on a malformed BILLING_PLANS', () => {
    process.env.BILLING_PLANS = '{not json';
    resetBillingPlansForTesting();
    expect(() => loadBillingPlansAtBoot()).toThrow(/BILLING_PLANS is invalid/);
  });

  it('counts the plans when the value is good', () => {
    delete process.env.BILLING_PLANS;
    resetBillingPlansForTesting();
    expect(loadBillingPlansAtBoot()).toBeGreaterThan(0);
  });
});
