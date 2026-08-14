// The finance worker's per-message handling.
//
// Most of this file is about ONE event, `module.activated`, because its absence
// is what made the entire money-out half of the platform inert: `provisionFinance`
// shipped with nothing outside its own tests calling it, so no tenant had a
// `wages` category, Spending had nothing to file against, and every staff labour
// derivation failed with `STAFF_WAGES_CATEGORY_MISSING`. A backfill repaired the
// 49 tenants that already existed; these tests are what stop it recurring.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { provisionFinance, generateDueExpenses, recomputeDay, recomputeRange } = vi.hoisted(() => ({
  provisionFinance: vi.fn(),
  generateDueExpenses: vi.fn(),
  recomputeDay: vi.fn(),
  recomputeRange: vi.fn(),
}));

vi.mock('@sparx/finance', () => ({
  provisionFinance,
  generateDueExpenses,
  recomputeDay,
  recomputeRange,
  utcMidnight: (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())),
}));

const { handle, parseEvent } = await import('./handler.js');
const { EVENTS } = await import('./index.js');

const noop = vi.fn();
const logger = { info: noop, warn: noop, debug: noop } as never;

const TENANT = '11111111-1111-4111-8111-111111111111';

function envelope(type: string, data: Record<string, unknown> = {}) {
  return { type, tenantId: TENANT, actorId: null, occurredAt: '2026-08-13T00:00:00.000Z', data };
}

beforeEach(() => {
  vi.clearAllMocks();
  provisionFinance.mockResolvedValue({ categoriesSeeded: 20, categoriesTotal: 20 });
  generateDueExpenses.mockResolvedValue([]);
  recomputeDay.mockResolvedValue([]);
  recomputeRange.mockResolvedValue([]);
});

describe('parseEvent', () => {
  it('accepts every topic the worker subscribes to', () => {
    // The guard against the original bug's shape: a handler that can process an
    // event the subscription does not ask for is as dead as one that never runs.
    for (const type of EVENTS) {
      const data =
        type === 'module.activated'
          ? { module: 'finance' }
          : type === 'finance.profit.recompute'
            ? { from: '2026-08-01', to: '2026-08-31' }
            : type.startsWith('finance.expense')
              ? { incurredAt: '2026-08-11' }
              : {};
      expect(parseEvent(envelope(type, data))?.type).toBe(type);
    }
  });
});

describe('module.activated', () => {
  it('seeds the categories when finance turns on', async () => {
    const result = await handle(
      parseEvent(envelope('module.activated', { module: 'finance' }))!,
      logger
    );

    expect(provisionFinance).toHaveBeenCalledWith(TENANT);
    expect(result).toMatchObject({
      outcome: 'provisioned',
      categoriesSeeded: 20,
      categoriesTotal: 20,
    });
  });

  it('seeds when finance arrives BUNDLED, which is how almost every tenant gets it', async () => {
    // Turning on Commerce or B2B announces `finance` with no finance flag of its
    // own — `applyModuleWrites` publishes on DERIVED-state transitions precisely
    // so this consumer runs. All 49 tenants found by the backfill were bundled,
    // so a fix that only handled explicit activation would have fixed nobody.
    await handle(parseEvent(envelope('module.activated', { module: 'finance' }))!, logger);
    expect(provisionFinance).toHaveBeenCalledTimes(1);
  });

  it('ignores another module turning on', async () => {
    const result = await handle(
      parseEvent(envelope('module.activated', { module: 'crm' }))!,
      logger
    );

    expect(provisionFinance).not.toHaveBeenCalled();
    expect(result.outcome).toBe('skipped');
  });

  it('is safe to receive twice, and says so honestly', async () => {
    // These two return values are the REAL contract, pinned by the
    // `reports rows it CREATED` integration test in @sparx/finance: the seed
    // upserts all 20 rows every run, but only counts the ones that did not
    // exist. An earlier version of this mock had the second call return
    // `categoriesSeeded: 0` against an implementation that in fact returned 20,
    // so the test asserted a behaviour nothing had — and the backfill script
    // reported redeliveries as fresh work because of it.
    provisionFinance.mockResolvedValueOnce({ categoriesSeeded: 20, categoriesTotal: 20 });
    provisionFinance.mockResolvedValueOnce({ categoriesSeeded: 0, categoriesTotal: 20 });

    const first = await handle(
      parseEvent(envelope('module.activated', { module: 'finance' }))!,
      logger
    );
    const second = await handle(
      parseEvent(envelope('module.activated', { module: 'finance' }))!,
      logger
    );

    expect(first.categoriesSeeded).toBe(20);
    // A redelivery reports zero CREATED rather than throwing, so the message is
    // acked — and carries the total, so "0" cannot be misread as "no categories".
    expect(second.categoriesSeeded).toBe(0);
    expect(second.categoriesTotal).toBe(20);
  });
});
