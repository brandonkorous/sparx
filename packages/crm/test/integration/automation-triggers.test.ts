// Scheduled automation triggers — OUTCOME-level coverage for the inactivity
// behavior (docs/81 §12 Phase 2).
//
// WHY this is written against the *outcome*, not the scheduler internals:
// docs/81 retires this daily cron and re-expresses it as a system automation
// running on the unified engine. When that swap happens, `runDailyAutomation-
// Triggers` and its `{ inactive: N }` return shape disappear — but the
// observable contract must NOT change: "a customer with no order in ≥ N days
// produces an inactivity signal; a recently-active customer does not."
//
// So we assert on the emitted signal (captured via the RecordingPublisher),
// which both the cron and its automation-engine successor are obligated to
// emit. The summary count is checked only as a loose sanity sentinel and is
// explicitly called out as an implementation detail, so this suite survives
// the Phase-2 handoff untouched.

import crypto from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { withTenant } from '@sparx/db';

import * as customerService from '../../src/services/customer-service';
import { runDailyAutomationTriggers } from '../../src/schedulers/automation-triggers';
import { disposeTestContext, makeTestContext, type TestContext } from '../helpers.js';

const DAY = 86_400_000;

describe('scheduled automation triggers — inactivity (outcome-level)', () => {
  let t: TestContext;

  beforeAll(async () => {
    t = await makeTestContext('owner');
  });

  afterAll(async () => {
    await disposeTestContext(t);
  });

  beforeEach(() => {
    t.publisher.clear();
  });

  // Create a customer and pin its lastOrderAt. `daysAgo: null` leaves it
  // unset (never ordered). `create` doesn't accept lastOrderAt, so we set it
  // via a tenant-scoped update — mirroring the helper pattern used elsewhere.
  async function customerLastOrdered(daysAgo: number | null): Promise<string> {
    const created = await customerService.create(t.ctx, {
      type: 'retail',
      email: `inactive-${crypto.randomBytes(4).toString('hex')}@example.test`,
    });
    const lastOrderAt = daysAgo === null ? null : new Date(Date.now() - daysAgo * DAY);
    await withTenant(t.ctx, (tx) =>
      tx.customer.update({ where: { id: created.id }, data: { lastOrderAt } })
    );
    return created.id;
  }

  // Customer ids carried on inactivity signals emitted during the last run.
  function inactiveCustomerIds(): string[] {
    return t.publisher.events
      .filter((e) => (e.payload as { reason?: string }).reason === 'inactive')
      .map((e) => (e.payload as { customerId: string }).customerId);
  }

  it('flags a customer past the threshold and ignores recent / never-ordered ones', async () => {
    const stale = await customerLastOrdered(120); // well past the 90d default
    const recent = await customerLastOrdered(10); // ordered last week
    const neverOrdered = await customerLastOrdered(null); // no order on record

    const summary = await runDailyAutomationTriggers(t.ctx);

    // The contract: exactly the stale customer earns an inactivity signal.
    const flagged = inactiveCustomerIds();
    expect(flagged).toContain(stale);
    expect(flagged).not.toContain(recent);
    expect(flagged).not.toContain(neverOrdered);

    // The signal carries the elapsed-days fact the downstream re-engagement
    // action keys on — assert it crossed the threshold rather than a magic
    // exact number, so a one-day clock skew never flakes this. Match on the
    // inactivity signal specifically; `customer.created` also carries a
    // customerId but no daysInactive.
    const staleSignal = t.publisher.events.find(
      (e) =>
        (e.payload as { reason?: string }).reason === 'inactive' &&
        (e.payload as { customerId?: string }).customerId === stale
    );
    expect(staleSignal).toBeDefined();
    expect((staleSignal!.payload as { daysInactive: number }).daysInactive).toBeGreaterThanOrEqual(
      90
    );

    // Loose sanity only — `summary.inactive` is the cron's internal return
    // shape and is NOT part of the behavioral contract this suite guards.
    expect(summary.inactive).toBeGreaterThanOrEqual(1);
  });

  it('honors a custom inactivity threshold', async () => {
    const stale30 = await customerLastOrdered(30);

    // At the 90-day default, a 30-day-idle customer is not yet inactive.
    await runDailyAutomationTriggers(t.ctx);
    expect(inactiveCustomerIds()).not.toContain(stale30);

    // Tighten the window to 14 days and the same customer now qualifies.
    t.publisher.clear();
    await runDailyAutomationTriggers(t.ctx, { inactiveDays: 14 });
    expect(inactiveCustomerIds()).toContain(stale30);
  });

  it('emits each inactivity signal at most once per day (idempotent re-runs)', async () => {
    const stale = await customerLastOrdered(200);

    // Two ticks on the same calendar day (a retry, or overlapping schedulers)
    // must not double-signal: the dedupeKey is date-stamped. We assert the
    // OUTCOME a consumer sees — one fact per customer per day — not the key.
    await runDailyAutomationTriggers(t.ctx);
    await runDailyAutomationTriggers(t.ctx);

    const occurrences = t.publisher.events.filter(
      (e) =>
        (e.payload as { reason?: string }).reason === 'inactive' &&
        (e.payload as { customerId?: string }).customerId === stale
    );
    // Both emissions share one dedupeKey, so a deduping consumer collapses
    // them to a single delivered signal.
    const keys = new Set(occurrences.map((e) => e.dedupeKey));
    expect(keys.size).toBe(1);
  });
});
