// Phase 10 report arithmetic (docs/146 §6 Phase 10.1).
//
// The cases that matter here are the empty ones. Every one of these functions is
// a ratio, and the failure mode of a ratio is not being slightly wrong — it is
// returning a confident 0% or 100% for a question nobody measured. Roughly half
// the assertions below exist to pin `null` in place.

import { describe, expect, it } from 'vitest';

import {
  availabilityPct,
  fillRate,
  fillRateVerdict,
  gmroi,
  gmroiVerdict,
  movementGroup,
  nextRunAt,
  pct1,
  ratio2,
  safeRatio,
  sellThrough,
  sellThroughVerdict,
  stockoutEpisodes,
  summarizeImportPlan,
  summarizeMovements,
  AdjustmentImportRow,
  CreateReportScheduleInput,
  type ImportRowPlan,
} from './reporting';

describe('safeRatio', () => {
  it('divides', () => {
    expect(safeRatio(1, 4)).toBe(0.25);
  });

  it('refuses a zero denominator rather than returning zero', () => {
    expect(safeRatio(0, 0)).toBeNull();
    expect(safeRatio(5, 0)).toBeNull();
  });

  it('refuses a negative denominator', () => {
    expect(safeRatio(5, -2)).toBeNull();
  });

  it('keeps a negative numerator — losing money is an answer', () => {
    expect(safeRatio(-10, 5)).toBe(-2);
  });

  it('refuses non-finite input', () => {
    expect(safeRatio(Number.NaN, 5)).toBeNull();
    expect(safeRatio(5, Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('rounding', () => {
  it('reports percentages to one decimal', () => {
    expect(pct1(0.96437)).toBe(96.4);
    expect(pct1(1)).toBe(100);
  });

  it('reports ratios to two decimals', () => {
    expect(ratio2(3.14159)).toBe(3.14);
  });
});

describe('sellThrough', () => {
  it('divides sold by what was there to sell', () => {
    const r = sellThrough({ unitsSold: 30, unitsOnHandAtEnd: 70 });
    expect(r.unitsAvailable).toBe(100);
    expect(r.sellThroughPct).toBe(30);
  });

  it('is null when nothing was there to sell', () => {
    expect(sellThrough({ unitsSold: 0, unitsOnHandAtEnd: 0 }).sellThroughPct).toBeNull();
  });

  it('reads 100% when everything sold and the shelf is empty', () => {
    expect(sellThrough({ unitsSold: 40, unitsOnHandAtEnd: 0 }).sellThroughPct).toBe(100);
  });

  it('clamps an oversold negative balance rather than exceeding 100%', () => {
    const r = sellThrough({ unitsSold: 10, unitsOnHandAtEnd: -4 });
    expect(r.unitsOnHandAtEnd).toBe(0);
    expect(r.sellThroughPct).toBe(100);
  });

  it('grades the bands, and never grades an unmeasured line', () => {
    expect(sellThroughVerdict(12)).toBe('overstocked');
    expect(sellThroughVerdict(55)).toBe('healthy');
    expect(sellThroughVerdict(92)).toBe('understocked');
    expect(sellThroughVerdict(null)).toBe('unmeasured');
  });
});

describe('gmroi', () => {
  it('returns margin per pound of stock held', () => {
    const r = gmroi({ revenueCents: 100_000, cogsCents: 60_000, avgInventoryCostCents: 20_000 });
    expect(r.grossMarginCents).toBe(40_000);
    expect(r.grossMarginPct).toBe(40);
    expect(r.gmroi).toBe(2);
  });

  it('is null when no stock was held — not zero', () => {
    const r = gmroi({ revenueCents: 100_000, cogsCents: 60_000, avgInventoryCostCents: 0 });
    expect(r.gmroi).toBeNull();
    // The margin still stands: it was measured, only the ratio could not be.
    expect(r.grossMarginCents).toBe(40_000);
  });

  it('is null on margin percent when nothing sold', () => {
    const r = gmroi({ revenueCents: 0, cogsCents: 0, avgInventoryCostCents: 50_000 });
    expect(r.grossMarginPct).toBeNull();
    expect(r.gmroi).toBe(0);
  });

  it('keeps a negative GMROI — selling below cost is the finding', () => {
    const r = gmroi({ revenueCents: 40_000, cogsCents: 60_000, avgInventoryCostCents: 20_000 });
    expect(r.grossMarginCents).toBe(-20_000);
    expect(r.gmroi).toBe(-1);
    expect(gmroiVerdict(r.gmroi)).toBe('losing');
  });

  it('grades the bands, and an unmeasured line is not a poor one', () => {
    expect(gmroiVerdict(0.4)).toBe('poor');
    expect(gmroiVerdict(2)).toBe('fair');
    expect(gmroiVerdict(4.5)).toBe('strong');
    expect(gmroiVerdict(null)).toBe('unmeasured');
  });
});

describe('fillRate', () => {
  it('scores lines and units separately', () => {
    const r = fillRate([
      { unitsOrdered: 10, unitsShort: 0, measured: true },
      { unitsOrdered: 400, unitsShort: 3, measured: true },
      { unitsOrdered: 3, unitsShort: 3, measured: true },
    ]);
    expect(r.linesMeasured).toBe(3);
    expect(r.linesFilledComplete).toBe(1);
    expect(r.lineFillRatePct).toBe(33.3);
    expect(r.unitsOrdered).toBe(413);
    expect(r.unitsShort).toBe(6);
    expect(r.unitFillRatePct).toBe(98.5);
  });

  it('excludes unmeasured lines from BOTH sides rather than scoring them as fills', () => {
    const r = fillRate([
      { unitsOrdered: 10, unitsShort: 0, measured: true },
      { unitsOrdered: 90, unitsShort: 0, measured: false },
    ]);
    expect(r.linesMeasured).toBe(1);
    expect(r.unmeasuredLines).toBe(1);
    expect(r.unitsOrdered).toBe(10);
    expect(r.lineFillRatePct).toBe(100);
  });

  it('is null when nothing at all was measured — never a perfect score', () => {
    const r = fillRate([
      { unitsOrdered: 10, unitsShort: 0, measured: false },
      { unitsOrdered: 20, unitsShort: 0, measured: false },
    ]);
    expect(r.lineFillRatePct).toBeNull();
    expect(r.unitFillRatePct).toBeNull();
    expect(r.unmeasuredLines).toBe(2);
  });

  it('is null on an empty period', () => {
    expect(fillRate([]).lineFillRatePct).toBeNull();
  });

  it('clamps a short count larger than the order', () => {
    const r = fillRate([{ unitsOrdered: 5, unitsShort: 9, measured: true }]);
    expect(r.unitsShort).toBe(5);
    expect(r.unitFillRatePct).toBe(0);
  });

  it('grades against distribution parity', () => {
    expect(fillRateVerdict(88)).toBe('poor');
    expect(fillRateVerdict(93)).toBe('below_par');
    expect(fillRateVerdict(96)).toBe('good');
    expect(fillRateVerdict(99.5)).toBe('excellent');
    expect(fillRateVerdict(null)).toBe('unmeasured');
  });
});

describe('stockoutEpisodes', () => {
  const day = (n: number): Date => new Date(Date.UTC(2027, 0, n));

  it('counts a run at zero as ONE episode, not one per movement', () => {
    const r = stockoutEpisodes(
      [
        { at: day(1), balanceAfter: 5 },
        { at: day(2), balanceAfter: 0 },
        { at: day(3), balanceAfter: 0 },
        { at: day(4), balanceAfter: 0 },
        { at: day(6), balanceAfter: 12 },
      ],
      day(10)
    );
    expect(r.episodeCount).toBe(1);
    expect(r.daysOut).toBe(4);
    expect(r.currentlyOut).toBe(false);
  });

  it('counts separate episodes separately', () => {
    const r = stockoutEpisodes(
      [
        { at: day(1), balanceAfter: 0 },
        { at: day(2), balanceAfter: 4 },
        { at: day(5), balanceAfter: -2 },
        { at: day(6), balanceAfter: 9 },
      ],
      day(10)
    );
    expect(r.episodeCount).toBe(2);
    expect(r.daysOut).toBe(2);
  });

  it('runs an open episode to the end of the window', () => {
    const r = stockoutEpisodes(
      [
        { at: day(1), balanceAfter: 3 },
        { at: day(8), balanceAfter: 0 },
      ],
      day(10)
    );
    expect(r.currentlyOut).toBe(true);
    expect(r.episodes[0]?.endedAt).toBeNull();
    expect(r.daysOut).toBe(2);
  });

  it('treats a negative balance as out', () => {
    const r = stockoutEpisodes(
      [
        { at: day(1), balanceAfter: 2 },
        { at: day(2), balanceAfter: -6 },
        { at: day(3), balanceAfter: 1 },
      ],
      day(5)
    );
    expect(r.episodeCount).toBe(1);
  });

  it('skips movements with no recorded balance and says how many', () => {
    const r = stockoutEpisodes(
      [
        { at: day(1), balanceAfter: null },
        { at: day(2), balanceAfter: null },
        { at: day(3), balanceAfter: 4 },
      ],
      day(5)
    );
    expect(r.unmeasuredPoints).toBe(2);
    expect(r.episodeCount).toBe(0);
  });

  it('measures nothing from an empty ledger', () => {
    const r = stockoutEpisodes([], day(5));
    expect(r.episodeCount).toBe(0);
    expect(r.daysOut).toBe(0);
    expect(r.currentlyOut).toBe(false);
  });

  it('sorts unordered points before walking them', () => {
    const r = stockoutEpisodes(
      [
        { at: day(6), balanceAfter: 7 },
        { at: day(2), balanceAfter: 0 },
        { at: day(1), balanceAfter: 5 },
      ],
      day(10)
    );
    expect(r.episodeCount).toBe(1);
    expect(r.daysOut).toBe(4);
  });

  it('keeps sub-day outages visible', () => {
    const r = stockoutEpisodes(
      [
        { at: new Date(Date.UTC(2027, 0, 1, 9)), balanceAfter: 0 },
        { at: new Date(Date.UTC(2027, 0, 1, 15)), balanceAfter: 4 },
      ],
      day(2)
    );
    expect(r.daysOut).toBe(0.3);
  });
});

describe('availabilityPct', () => {
  it('is the share of the window in stock', () => {
    expect(availabilityPct(3, 30)).toBe(90);
  });

  it('is null over a zero-length window', () => {
    expect(availabilityPct(0, 0)).toBeNull();
  });

  it('floors at zero rather than going negative', () => {
    expect(availabilityPct(40, 30)).toBe(0);
  });
});

describe('summarizeMovements', () => {
  it('groups, nets and orders the reasons', () => {
    const s = summarizeMovements([
      {
        reason: 'sale',
        movements: 40,
        unitsIn: 0,
        unitsOut: 120,
        costCents: -60_000,
        costedMovements: 40,
      },
      {
        reason: 'receive',
        movements: 5,
        unitsIn: 300,
        unitsOut: 0,
        costCents: null,
        costedMovements: 0,
      },
      {
        reason: 'damage',
        movements: 2,
        unitsIn: 0,
        unitsOut: 7,
        costCents: -900,
        costedMovements: 2,
      },
    ]);
    expect(s.rows.map((r) => r.reason)).toEqual(['receive', 'sale', 'damage']);
    expect(s.totalUnitsIn).toBe(300);
    expect(s.totalUnitsOut).toBe(127);
    expect(s.netUnits).toBe(173);
    expect(s.uncostedMovements).toBe(5);
  });

  it('leaves an uncosted reason blank rather than zero', () => {
    const s = summarizeMovements([
      {
        reason: 'recount',
        movements: 3,
        unitsIn: 2,
        unitsOut: 0,
        costCents: null,
        costedMovements: 0,
      },
    ]);
    expect(s.rows[0]?.costCents).toBeNull();
  });

  it('groups an unknown reason rather than dropping it', () => {
    expect(movementGroup('sale')).toBe('sold');
    expect(movementGroup('transfer_in')).toBe('internal');
    expect(movementGroup('something_new')).toBe('corrected');
    const s = summarizeMovements([
      {
        reason: 'something_new',
        movements: 1,
        unitsIn: 4,
        unitsOut: 0,
        costCents: null,
        costedMovements: 0,
      },
    ]);
    expect(s.totalUnitsIn).toBe(4);
  });

  it('summarises an empty period to zeroes, not to nothing', () => {
    const s = summarizeMovements([]);
    expect(s.rows).toEqual([]);
    expect(s.totalMovements).toBe(0);
  });
});

describe('nextRunAt', () => {
  it('moves a daily schedule to tomorrow once today has passed', () => {
    const next = nextRunAt({ cadence: 'daily', hour: 7 }, new Date('2027-03-01T09:00:00Z'));
    expect(next.toISOString()).toBe('2027-03-02T07:00:00.000Z');
  });

  it('keeps a daily schedule today when the hour is still ahead', () => {
    const next = nextRunAt({ cadence: 'daily', hour: 18 }, new Date('2027-03-01T09:00:00Z'));
    expect(next.toISOString()).toBe('2027-03-01T18:00:00.000Z');
  });

  it('finds the next matching weekday', () => {
    // 2027-03-01 is a Monday; asking for Friday (5) lands on the 5th.
    const next = nextRunAt(
      { cadence: 'weekly', dayOfWeek: 5, hour: 7 },
      new Date('2027-03-01T09:00:00Z')
    );
    expect(next.toISOString()).toBe('2027-03-05T07:00:00.000Z');
  });

  it('pushes a weekly schedule a full week when today already fired', () => {
    const next = nextRunAt(
      { cadence: 'weekly', dayOfWeek: 1, hour: 7 },
      new Date('2027-03-01T09:00:00Z')
    );
    expect(next.toISOString()).toBe('2027-03-08T07:00:00.000Z');
  });

  it('rolls a monthly schedule into next month', () => {
    const next = nextRunAt(
      { cadence: 'monthly', dayOfMonth: 1, hour: 7 },
      new Date('2027-03-01T09:00:00Z')
    );
    expect(next.toISOString()).toBe('2027-04-01T07:00:00.000Z');
  });

  it('never skips February — the day is capped at 28', () => {
    const next = nextRunAt(
      { cadence: 'monthly', dayOfMonth: 31, hour: 7 },
      new Date('2027-01-29T09:00:00Z')
    );
    expect(next.toISOString()).toBe('2027-02-28T07:00:00.000Z');
  });

  it('honours a timezone offset', () => {
    // 07:00 local at UTC-5 is 12:00 UTC.
    const next = nextRunAt({ cadence: 'daily', hour: 7 }, new Date('2027-03-01T20:00:00Z'), -300);
    expect(next.toISOString()).toBe('2027-03-02T12:00:00.000Z');
  });

  it('always lands strictly after the moment asked about', () => {
    const after = new Date('2027-03-01T07:00:00Z');
    expect(nextRunAt({ cadence: 'daily', hour: 7 }, after).getTime()).toBeGreaterThan(
      after.getTime()
    );
  });
});

describe('AdjustmentImportRow', () => {
  it('accepts a SKU and a new count', () => {
    expect(AdjustmentImportRow.safeParse({ sku: 'MUG-01', onHand: 12 }).success).toBe(true);
  });

  it('refuses a row that names no item', () => {
    expect(AdjustmentImportRow.safeParse({ onHand: 12 }).success).toBe(false);
  });

  it('refuses both a count and a change', () => {
    expect(AdjustmentImportRow.safeParse({ sku: 'MUG-01', onHand: 12, delta: 3 }).success).toBe(
      false
    );
  });

  it('refuses neither', () => {
    expect(AdjustmentImportRow.safeParse({ sku: 'MUG-01' }).success).toBe(false);
  });

  it('accepts a negative change', () => {
    expect(AdjustmentImportRow.safeParse({ sku: 'MUG-01', delta: -4 }).success).toBe(true);
  });
});

describe('summarizeImportPlan', () => {
  const row = (over: Partial<ImportRowPlan>): ImportRowPlan => ({
    line: 2,
    sku: 'MUG-01',
    variantId: null,
    warehouseId: null,
    outcome: 'apply',
    currentOnHand: 10,
    newOnHand: 12,
    delta: 2,
    error: null,
    ...over,
  });

  it('counts each outcome and the units at stake', () => {
    const plan = summarizeImportPlan([
      row({ line: 2, delta: 2 }),
      row({ line: 3, delta: -8 }),
      row({ line: 4, outcome: 'no_change', delta: 0 }),
      row({ line: 5, outcome: 'error', delta: 0, error: 'No item with that code' }),
    ]);
    expect(plan.totalRows).toBe(4);
    expect(plan.applyCount).toBe(2);
    expect(plan.noChangeCount).toBe(1);
    expect(plan.errorCount).toBe(1);
    // Absolute: an import that adds 2 and removes 8 touches ten units, not minus six.
    expect(plan.unitsChanged).toBe(10);
  });

  it('summarises an empty file without pretending it succeeded', () => {
    const plan = summarizeImportPlan([]);
    expect(plan.totalRows).toBe(0);
    expect(plan.applyCount).toBe(0);
  });
});

describe('CreateReportScheduleInput', () => {
  it('defaults the hour, format and timezone', () => {
    const parsed = CreateReportScheduleInput.parse({
      reportKey: 'dead_stock',
      name: 'Monday dead stock',
      cadence: 'weekly',
      dayOfWeek: 1,
      recipients: ['owner@example.com'],
    });
    expect(parsed.hour).toBe(7);
    expect(parsed.timezone).toBe('UTC');
    expect(parsed.format).toBe('csv');
    expect(parsed.isActive).toBe(true);
  });

  it('refuses a schedule with nobody to send it to', () => {
    const parsed = CreateReportScheduleInput.safeParse({
      reportKey: 'dead_stock',
      name: 'Nobody',
      cadence: 'daily',
      recipients: [],
    });
    expect(parsed.success).toBe(false);
  });

  it('refuses a day of month that would skip February', () => {
    const parsed = CreateReportScheduleInput.safeParse({
      reportKey: 'valuation',
      name: 'Month end',
      cadence: 'monthly',
      dayOfMonth: 31,
      recipients: ['owner@example.com'],
    });
    expect(parsed.success).toBe(false);
  });

  it('refuses an unknown report', () => {
    const parsed = CreateReportScheduleInput.safeParse({
      reportKey: 'made_up',
      name: 'x',
      cadence: 'daily',
      recipients: ['owner@example.com'],
    });
    expect(parsed.success).toBe(false);
  });
});
