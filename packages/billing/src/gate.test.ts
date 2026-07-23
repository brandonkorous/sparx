// Unit tests for the billing lifecycle gate (docs/17 §6). Pure function, no mocks —
// every case pins `now` and the tenant's billing columns and asserts the phase +
// countdown. This is the enforcement contract the public-site overlay and the
// dashboard banner ladder both read, so the edges (exact trial end, exact grace
// end, missing data, legacy tenants) are covered explicitly.

import { afterEach, describe, expect, it } from 'vitest';

import { GRACE_PERIOD_DAYS, isPlatformTenant, resolveBillingPhase } from './gate';

const NOW = new Date('2026-07-22T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const days = (n: number) => new Date(NOW.getTime() + n * DAY);

describe('resolveBillingPhase', () => {
  it('is trialing while the stamped trial is in the future (pre-Stripe, null status)', () => {
    const v = resolveBillingPhase(
      { subscriptionStatus: 'trialing', trialEndsAt: days(10), currentPeriodEnd: null },
      NOW
    );
    expect(v.phase).toBe('trialing');
    expect(v.daysLeft).toBe(10);
    expect(v.trialEndsAt).toBe(days(10).toISOString());
    // Site goes dark 7 days AFTER the trial ends.
    expect(v.suspendsAt).toBe(days(10 + GRACE_PERIOD_DAYS).toISOString());
  });

  it('treats a null status with a future trial as trialing (brand-new signup)', () => {
    const v = resolveBillingPhase(
      { subscriptionStatus: null, trialEndsAt: days(14), currentPeriodEnd: null },
      NOW
    );
    expect(v.phase).toBe('trialing');
    expect(v.daysLeft).toBe(14);
  });

  it('rounds a partial day UP so "N days left" never reads a day short', () => {
    const v = resolveBillingPhase(
      {
        subscriptionStatus: 'trialing',
        trialEndsAt: new Date(NOW.getTime() + 2 * DAY + 4 * 60 * 60 * 1000), // 2d 4h
        currentPeriodEnd: null,
      },
      NOW
    );
    expect(v.daysLeft).toBe(3);
  });

  it('is active for a paid subscription in good standing (trial fields ignored)', () => {
    const v = resolveBillingPhase(
      { subscriptionStatus: 'active', trialEndsAt: days(-1), currentPeriodEnd: days(20) },
      NOW
    );
    expect(v.phase).toBe('active');
    expect(v.daysLeft).toBeNull();
    expect(v.suspendsAt).toBeNull();
  });

  it('enters grace the instant the trial ends, keeping the site live for 7 days', () => {
    const v = resolveBillingPhase(
      { subscriptionStatus: 'paused', trialEndsAt: days(-1), currentPeriodEnd: null },
      NOW
    );
    expect(v.phase).toBe('grace');
    expect(v.daysLeft).toBe(GRACE_PERIOD_DAYS - 1);
    expect(v.suspendsAt).toBe(days(-1 + GRACE_PERIOD_DAYS).toISOString());
  });

  it('handles a still-"trialing" status whose clock has already elapsed as grace', () => {
    // The webhook flips trialing → paused a beat after the trial end; until it does,
    // an expired trial must already behave as grace (site live), not as active.
    const v = resolveBillingPhase(
      { subscriptionStatus: 'trialing', trialEndsAt: days(-2), currentPeriodEnd: null },
      NOW
    );
    expect(v.phase).toBe('grace');
    expect(v.daysLeft).toBe(GRACE_PERIOD_DAYS - 2);
  });

  it('suspends once the grace window has fully elapsed', () => {
    const v = resolveBillingPhase(
      {
        subscriptionStatus: 'paused',
        trialEndsAt: days(-(GRACE_PERIOD_DAYS + 1)),
        currentPeriodEnd: null,
      },
      NOW
    );
    expect(v.phase).toBe('suspended');
    expect(v.daysLeft).toBeNull();
    expect(v.suspendsAt).toBeNull();
  });

  it('suspends exactly AT the grace boundary (inclusive of the end instant)', () => {
    const v = resolveBillingPhase(
      {
        subscriptionStatus: 'paused',
        trialEndsAt: days(-GRACE_PERIOD_DAYS),
        currentPeriodEnd: null,
      },
      NOW
    );
    expect(v.phase).toBe('suspended');
  });

  it('anchors grace on the period end for a FAILED RENEWAL (past_due)', () => {
    const v = resolveBillingPhase(
      { subscriptionStatus: 'past_due', trialEndsAt: days(-90), currentPeriodEnd: days(-2) },
      NOW
    );
    expect(v.phase).toBe('grace');
    // Grace counts from the failed renewal (currentPeriodEnd), not the ancient trial.
    expect(v.daysLeft).toBe(GRACE_PERIOD_DAYS - 2);
  });

  it('suspends a past_due sub once its post-renewal grace elapses', () => {
    const v = resolveBillingPhase(
      {
        subscriptionStatus: 'unpaid',
        trialEndsAt: null,
        currentPeriodEnd: days(-(GRACE_PERIOD_DAYS + 3)),
      },
      NOW
    );
    expect(v.phase).toBe('suspended');
  });

  it('suspends a voluntarily-canceled subscription immediately (no second grace)', () => {
    const v = resolveBillingPhase(
      { subscriptionStatus: 'canceled', trialEndsAt: days(-1), currentPeriodEnd: days(-1) },
      NOW
    );
    expect(v.phase).toBe('suspended');
  });

  it('never suspends a legacy tenant with no billing clock (null status + null dates)', () => {
    const v = resolveBillingPhase(
      { subscriptionStatus: null, trialEndsAt: null, currentPeriodEnd: null },
      NOW
    );
    expect(v.phase).toBe('active');
  });

  it('exempts an enterprise tenant regardless of status/dates', () => {
    const v = resolveBillingPhase(
      {
        subscriptionStatus: 'past_due',
        trialEndsAt: days(-30),
        currentPeriodEnd: days(-30),
        planType: 'enterprise',
      },
      NOW
    );
    expect(v.phase).toBe('exempt');
  });

  it('exempts an explicitly-flagged (platform/internal) tenant', () => {
    const v = resolveBillingPhase(
      { subscriptionStatus: 'canceled', trialEndsAt: null, currentPeriodEnd: null, exempt: true },
      NOW
    );
    expect(v.phase).toBe('exempt');
  });
});

describe('isPlatformTenant', () => {
  const KEY = 'SPARX_PLATFORM_TENANT_ID';
  const original = process.env[KEY];

  afterEach(() => {
    if (original === undefined) delete process.env[KEY];
    else process.env[KEY] = original;
  });

  it('matches the ops-set platform tenant id', () => {
    process.env[KEY] = 'tenant-platform';
    expect(isPlatformTenant('tenant-platform')).toBe(true);
    expect(isPlatformTenant('tenant-other')).toBe(false);
  });

  it('is false for everyone when the env is unset', () => {
    delete process.env[KEY];
    expect(isPlatformTenant('anything')).toBe(false);
    expect(isPlatformTenant(null)).toBe(false);
  });
});
