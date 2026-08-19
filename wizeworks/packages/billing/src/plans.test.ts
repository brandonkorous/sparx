import { afterEach, describe, expect, it } from 'vitest';

import { listBillingPlans, planFor, resetBillingPlansForTesting } from './plans';

const FLAT = {
  id: 'brand_flat',
  label: 'Flat monthly',
  shape: 'flat',
  secretEnv: 'BRAND_STRIPE_SECRET_KEY',
  webhookSecretEnv: 'BRAND_STRIPE_WEBHOOK_SECRET_BILLING',
  base: {
    product: 'brand_base',
    lookupKey: 'brand_base_monthly',
    priceEnv: 'BRAND_PRICE_BASE',
    monthlyCents: 4900,
  },
};

function configure(plans: unknown): void {
  process.env.BILLING_PLANS = JSON.stringify(plans);
  resetBillingPlansForTesting();
}

afterEach(() => {
  delete process.env.BILLING_PLANS;
  resetBillingPlansForTesting();
});

describe('planFor', () => {
  it('resolves null/empty to the built-in default, so a pre-plans tenant row is unchanged', () => {
    expect(planFor(null).id).toBe('modules');
    expect(planFor(undefined).id).toBe('modules');
    expect(planFor('  ').id).toBe('modules');
    expect(planFor('modules').shape).toBe('per_module');
  });

  it('THROWS on a plan id it does not know rather than falling back', () => {
    // The failure that matters: falling back would bill a tenant the wrong amount in
    // somebody else's Stripe account, and nothing about it would look wrong.
    expect(() => planFor('brand_flat')).toThrow(/Unknown billing plan/);
  });

  it('resolves a configured plan, including which account it bills from', () => {
    configure([FLAT]);
    const plan = planFor('brand_flat');
    expect(plan.shape).toBe('flat');
    expect(plan.secretEnv).toBe('BRAND_STRIPE_SECRET_KEY');
    expect(plan.base?.monthlyCents).toBe(4900);
  });
});

describe('BILLING_PLANS validation', () => {
  it('rejects malformed JSON rather than silently running with no plans', () => {
    process.env.BILLING_PLANS = '{not json';
    resetBillingPlansForTesting();
    expect(() => listBillingPlans()).toThrow(/not valid JSON/);
  });

  it('rejects a plan with no shape', () => {
    configure([{ ...FLAT, shape: 'monthly' }]);
    expect(() => listBillingPlans()).toThrow(/expected per_module or flat/);
  });

  it('rejects a flat plan with no base item — there would be nothing to charge', () => {
    configure([{ ...FLAT, base: undefined }]);
    expect(() => listBillingPlans()).toThrow(/no base item/);
  });

  it('rejects a plan missing the env var that names its Stripe account', () => {
    configure([{ ...FLAT, secretEnv: '' }]);
    expect(() => listBillingPlans()).toThrow(/missing secretEnv/);
  });
});

describe('listBillingPlans', () => {
  it('always includes the default, so the webhook can verify sparx events unconfigured', () => {
    expect(listBillingPlans().map((p) => p.id)).toEqual(['modules']);
    configure([FLAT]);
    expect(listBillingPlans().map((p) => p.id)).toEqual(['modules', 'brand_flat']);
  });
});
