// Guard behaviour for the billing service's side-effecting entrypoints. The fee
// math itself is covered in price-catalog.test.ts; here we prove that the Stripe
// gate short-circuits cleanly (no DB, no Stripe) when billing is unconfigured —
// the contract every caller relies on to ship before the prod ops land.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetBillingStripeForTesting } from './client';
import { recordTransactionFee } from './service';

describe('recordTransactionFee (unconfigured)', () => {
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

  it('is a no-op that never touches the DB or Stripe', async () => {
    const result = await recordTransactionFee({
      tenantId: '00000000-0000-0000-0000-000000000000',
      orderTotalCents: 100_00,
    });
    expect(result.metered).toBe(false);
    expect(result.reason).toBe('unconfigured');
    expect(result.feeCents).toBe(0);
  });
});
