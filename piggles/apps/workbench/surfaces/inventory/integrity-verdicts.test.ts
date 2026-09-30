import { describe, expect, it } from 'vitest';
import {
  CHECK_STALE_AFTER_HOURS,
  checkAgeHours,
  countVerdict,
  heldBackAtDecision,
  listOf,
  runVerdict,
  type OversellIncident,
  type ReconciliationRun,
} from './integrity-data';

/** A fixed clock, so "two nights ago" means the same thing every run. */
const NOW = Date.parse('2026-09-19T09:00:00.000Z');

/**
 * "WANTED 1, HAD 0" - ON THE PANE CALLED "THINGS THAT DO NOT ADD UP".
 *
 * The refused-sale table printed the two numbers and no reason. Four terms
 * decide what is free to sell and the incident stores three of them, so the
 * fourth - the quarantine shelf - has to be recovered by subtraction:
 *
 *     onHand - allocated - buffer - available  ===  unsellable
 *
 * The guard that matters is the one below called "names the quarantine shelf".
 * Drop `unsellable` out of `heldBackAtDecision` and it fails, because the
 * sentence is then the shorter, wronger "1 on the shelf" with nothing after it.
 */

function incident(over: Partial<OversellIncident>): OversellIncident {
  return {
    id: 'i1',
    variantId: 'v1',
    variantSku: 'BRASS-BELT-1',
    productTitle: 'Brass belt hardware, antique',
    variantName: null,
    warehouseId: 'w1',
    warehouseName: 'Fulfillment Center',
    warehouseCode: 'FC',
    kind: 'blocked',
    requestedQuantity: 1,
    availableQuantity: 0,
    shortfall: 1,
    onHandAtDecision: 0,
    allocatedAtDecision: 0,
    bufferAtDecision: 0,
    policy: 'deny',
    channel: 'storefront',
    holderType: null,
    holderId: null,
    actorType: 'customer',
    actorId: null,
    sourceId: null,
    stockAgeSeconds: 134,
    occurredAt: '2026-09-01T00:00:00.000Z',
    ...over,
  };
}

describe('heldBackAtDecision', () => {
  it('names the quarantine shelf, which is the term nothing records', () => {
    // Devi's real row: one unit in the building, all of it not fit to sell.
    const words = heldBackAtDecision(incident({ onHandAtDecision: 1, availableQuantity: 0 }));
    expect(words).toBe('1 on the shelf: 1 not fit to sell');
  });

  it('says nothing when the shelf was simply empty', () => {
    // "Had 0" is already the whole truth here; a breakdown would be noise.
    expect(heldBackAtDecision(incident({ onHandAtDecision: 0 }))).toBeNull();
  });

  it('says nothing when every unit is accounted for and free', () => {
    expect(heldBackAtDecision(incident({ onHandAtDecision: 5, availableQuantity: 5 }))).toBeNull();
  });

  it('lists all three holds in the order a person would check them', () => {
    const words = heldBackAtDecision(
      incident({
        onHandAtDecision: 20,
        allocatedAtDecision: 8,
        bufferAtDecision: 4,
        availableQuantity: 3, // 20 - 8 - 4 - 5 quarantined
      })
    );
    expect(words).toBe('20 on the shelf: 8 spoken for, 5 not fit to sell and 4 held back');
  });

  it('adds up: the parts it names come back to the number it started from', () => {
    const row = incident({
      onHandAtDecision: 20,
      allocatedAtDecision: 8,
      bufferAtDecision: 4,
      availableQuantity: 3,
    });
    const named = [...(heldBackAtDecision(row) ?? '').matchAll(/(\d+) (?!on the)/g)].map((m) =>
      Number(m[1])
    );
    expect(named.reduce((a, b) => a + b, 0) + row.availableQuantity).toBe(row.onHandAtDecision);
  });

  it('leaves a below-zero movement alone, because its numbers mean something else', () => {
    // `negative_on_hand` records availableQuantity as "what the level held",
    // not "what was free to sell". Subtracting would invent a quantity.
    expect(
      heldBackAtDecision(
        incident({
          kind: 'negative_on_hand',
          onHandAtDecision: 4,
          allocatedAtDecision: 2,
          availableQuantity: 4,
        })
      )
    ).toBeNull();
  });

  it('shows nothing rather than a negative on a row written before the guard had four terms', () => {
    // Old rows computed availability with three terms, so the residual can go
    // negative on one of them. It must never render as a quantity.
    const words = heldBackAtDecision(
      incident({ onHandAtDecision: 2, allocatedAtDecision: 0, availableQuantity: 5 })
    );
    expect(words).toBeNull();
  });
});

describe('listOf', () => {
  it('joins one, two and three the way a sentence does', () => {
    expect(listOf([])).toBe('');
    expect(listOf(['a'])).toBe('a');
    expect(listOf(['a', 'b'])).toBe('a and b');
    expect(listOf(['a', 'b', 'c'])).toBe('a, b and c');
  });
});

/**
 * A GREEN TICK FROM A JOB THAT STOPPED RUNNING.
 *
 * The sweep is a nightly CronJob. Nothing on this pane checked that it had
 * actually run, so "Everything adds up" was a present-tense claim sourced from
 * whatever the last pass found, at any age. Remove the age branch from
 * `runVerdict` and the first test below fails: a two-day-old clean pass goes
 * back to reading as today's answer.
 */
describe('runVerdict, on a check that has gone quiet', () => {
  const at = (hoursAgo: number): ReconciliationRun => ({
    id: 'r1',
    status: 'ok',
    scope: 'full',
    levelsChecked: 74,
    driftCount: 0,
    driftUnits: 0,
    driftValueCents: 0,
    startedAt: '2026-09-16T04:30:00.000Z',
    finishedAt: new Date(NOW - hoursAgo * 3_600_000).toISOString(),
    durationMs: 6000,
    error: null,
  });

  it('stops claiming the present once two nights have been missed', () => {
    const v = runVerdict(at(CHECK_STALE_AFTER_HOURS), NOW);
    expect(v.label).not.toBe('Everything adds up');
    expect(v.tone).toBe('warning');
  });

  it('forgives a single missed night', () => {
    // 04:30 nightly: one skipped pass tops out at 47 hours and change.
    expect(runVerdict(at(47), NOW)).toEqual({ label: 'Everything adds up', tone: 'success' });
  });

  it('still says so when the check ran last night', () => {
    expect(runVerdict(at(8), NOW)).toEqual({ label: 'Everything adds up', tone: 'success' });
  });

  it('leaves a real disagreement red however old it is', () => {
    // Age never downgrades a finding. Drift is still drift, and the fix is the
    // same stock count it always was.
    const v = runVerdict({ ...at(500), status: 'drift', driftCount: 2 }, NOW);
    expect(v).toEqual({ label: '2 items do not add up', tone: 'danger' });
  });

  it('does not call a run that is still going stale', () => {
    const v = runVerdict({ ...at(0), status: 'running', finishedAt: null }, NOW);
    expect(v).toEqual({ label: 'Checking now', tone: 'info' });
  });
});

describe('checkAgeHours', () => {
  it('is null while the check is still running', () => {
    expect(
      checkAgeHours(
        {
          id: 'r1',
          status: 'running',
          scope: 'full',
          levelsChecked: 0,
          driftCount: 0,
          driftUnits: 0,
          driftValueCents: 0,
          startedAt: new Date(NOW).toISOString(),
          finishedAt: null,
          durationMs: null,
          error: null,
        },
        NOW
      )
    ).toBeNull();
  });
});

/**
 * "NEVER CHECKED" IS NOT "NEVER COUNTED", AND THE STOCK LIST SHOWED BOTH AT ONCE.
 *
 * This badge sits on a row that HAS a number. The row is in the stock list, it
 * says how many are to sell, and what has never happened is somebody looking at
 * the shelf to see whether that number is still true.
 *
 * The band at the top of the same list means something else by almost the same
 * words: a version with NO number at all, which is not a row here and which the
 * website sells without limit. Both were on screen together on Juniper Row's
 * stock list — the band saying never-counted versions "are not below", and a row
 * below it badged "Never counted" with 45 beside it (issue 856).
 *
 * The function's own header had the right word the whole time: "when this stock
 * was last CHECKED against the shelf".
 */
describe('countVerdict', () => {
  const THIRTY_DAYS = 30;
  const day = 24 * 60 * 60 * 1000;

  it('says nothing at all when there is no counting schedule', () => {
    // A verdict needs a promise. With no schedule nothing is overdue, and a
    // warning against a deadline nobody set is a lie.
    expect(countVerdict(null, null)).toBeNull();
    expect(countVerdict(null, undefined)).toBeNull();
    expect(countVerdict(null, 0)).toBeNull();
    expect(countVerdict(null, -5)).toBeNull();
    expect(countVerdict(null, Number.NaN)).toBeNull();
  });

  it("does not use the band's words for a row that has a number", () => {
    const verdict = countVerdict(null, THIRTY_DAYS);
    expect(verdict?.label).toBe('Never checked');
    // The exact collision this exists to stop. "Never counted" is the band's
    // sentence, about versions that are NOT in this list.
    expect(verdict?.label).not.toBe('Never counted');
    expect(verdict?.detail).not.toContain('never been counted');
  });

  it('explains it in terms of the shelf, and names the schedule', () => {
    const verdict = countVerdict(null, THIRTY_DAYS);
    expect(verdict?.detail).toBe(
      'You count this every 30 days, and nobody has checked it against the shelf yet.'
    );
    expect(verdict?.tone).toBe('warning');
  });

  it('says "every day" rather than "every 1 days"', () => {
    expect(countVerdict(null, 1)?.detail).toBe(
      'You count this every day, and nobody has checked it against the shelf yet.'
    );
  });

  it('says nothing while the count is still within its schedule', () => {
    const yesterday = new Date(Date.now() - day).toISOString();
    expect(countVerdict(yesterday, THIRTY_DAYS)).toBeNull();
  });

  it('names how late the count is once it is overdue', () => {
    const longAgo = new Date(Date.now() - 40 * day).toISOString();
    const verdict = countVerdict(longAgo, THIRTY_DAYS);
    expect(verdict?.label).toMatch(/^Count due .+ ago$/);
    expect(verdict?.tone).toBe('warning');
  });

  it('treats a whole cycle late as a different fact from a day late', () => {
    // Not "one count slipped" but "the schedule is not being kept".
    const veryLate = new Date(Date.now() - 70 * day).toISOString();
    expect(countVerdict(veryLate, THIRTY_DAYS)?.tone).toBe('danger');
  });

  it('refuses to guess from a date it cannot read', () => {
    // A date that will not parse is NOT never checked. It is not known, and
    // either sentence would be one the screen cannot stand behind.
    expect(countVerdict('not a date', THIRTY_DAYS)).toBeNull();
    expect(countVerdict('', THIRTY_DAYS)).toBeNull();
  });
});
