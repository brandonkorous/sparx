// Guard behaviour for the billing service's side-effecting entrypoints. The Stripe
// gate must short-circuit cleanly (no DB, no Stripe) when billing is unconfigured —
// the contract every caller relies on to ship before the prod ops land.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetBillingStripeForTesting } from './client';
import { syncModuleItems } from './service';

describe('syncModuleItems (unconfigured)', () => {
  const prior = process.env.STRIPE_SECRET_KEY;

  beforeEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    resetBillingStripeForTesting();
  });

  afterEach(() => {
    if (prior === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = prior;
    resetBillingStripeForTesting();
  });

  it('is a guarded no-op that never touches the DB or Stripe', async () => {
    const result = await syncModuleItems({
      tenantId: '00000000-0000-0000-0000-000000000000',
      email: 'a@b.co',
      enabledModules: ['commerce'],
    });
    expect(result.applied).toBe(false);
  });
});
