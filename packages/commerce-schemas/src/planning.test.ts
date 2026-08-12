// Pure planning arithmetic (docs/146 Phase 7).
//
// Every assertion here is a rule that decides how much stock a business keeps,
// so each one names the decision rather than the formula. The cases that matter
// most are the degenerate ones — no history, no demand, no supplier measurement
// — because those are the majority of any real catalogue and they are where a
// planning feature quietly produces a confident wrong number.

import { describe, expect, it } from 'vitest';

import {
  cadenceForAbcClass,
  cadenceIntervalDays,
  chooseForecast,
  classificationAdvice,
  classifyAbc,
  classifyXyz,
  coefficientOfVariation,
  daysOfCover,
  holdingCostCents,
  mean,
  projectedStockoutAt,
  reorderPoint,
  safetyStock,
  seasonalityIndex,
  serviceLevelZ,
  stdDev,
  stockoutRisk,
  suggestedOrderQuantity,
  xyzEvidenceIsSufficient,
} from './planning';

describe('service level', () => {
  it('p50 asks for no cushion at all — half the cycles run out, by definition', () => {
    expect(serviceLevelZ('p50')).toBe(0);
    expect(
      safetyStock({ demandPerDay: 10, demandStdDev: 4, leadTimeDays: 7, leadTimeStdDev: 2, z: 0 })
    ).toBe(0);
  });

  it('costs steeply at the top: p99 needs ~40% more cushion than p95', () => {
    const shared = { demandPerDay: 10, demandStdDev: 4, leadTimeDays: 7, leadTimeStdDev: 0 };
    const p95 = safetyStock({ ...shared, z: serviceLevelZ('p95') });
    const p99 = safetyStock({ ...shared, z: serviceLevelZ('p99') });
    expect(p99).toBeGreaterThan(p95);
    expect(p99 / p95).toBeGreaterThan(1.3);
    expect(p99 / p95).toBeLessThan(1.5);
  });

  it('falls back to p95 for an unknown level rather than throwing mid-sweep', () => {
    expect(serviceLevelZ('nonsense')).toBe(serviceLevelZ('p95'));
    expect(serviceLevelZ(null)).toBe(serviceLevelZ('p95'));
  });
});

describe('safety stock', () => {
  it('an unreliable SUPPLIER drives more cushion than wobbly demand does', () => {
    // Same demand, same average lead time. One supplier is metronomic, the other
    // swings by a week — and the second term of the formula is the only thing
    // that notices.
    const steady = safetyStock({
      demandPerDay: 20,
      demandStdDev: 5,
      leadTimeDays: 10,
      leadTimeStdDev: 0,
      z: 1.6449,
    });
    const erratic = safetyStock({
      demandPerDay: 20,
      demandStdDev: 5,
      leadTimeDays: 10,
      leadTimeStdDev: 7,
      z: 1.6449,
    });
    expect(erratic).toBeGreaterThan(steady * 5);
  });

  it('is zero when nothing varies — a perfectly predictable line needs no cushion', () => {
    expect(
      safetyStock({
        demandPerDay: 12,
        demandStdDev: 0,
        leadTimeDays: 5,
        leadTimeStdDev: 0,
        z: 2.3263,
      })
    ).toBe(0);
  });

  it('rounds UP — four fifths of a unit is a unit, and rounding a cushion down breaks it', () => {
    const ss = safetyStock({
      demandPerDay: 1,
      demandStdDev: 0.5,
      leadTimeDays: 2,
      leadTimeStdDev: 0,
      z: 1.6449,
    });
    // 1.6449 × √(2 × 0.25) = 1.163 → 2
    expect(ss).toBe(2);
  });

  it('survives NaN inputs with a number rather than poisoning the pass', () => {
    expect(
      safetyStock({
        demandPerDay: Number.NaN,
        demandStdDev: Number.POSITIVE_INFINITY,
        leadTimeDays: 5,
        leadTimeStdDev: 1,
        z: 1.6449,
      })
    ).toBe(0);
  });
});

describe('reorder point', () => {
  it('covers demand across the lead time plus the cushion', () => {
    // 8/day × 10 days = 80, plus 25 of cushion.
    expect(reorderPoint({ demandPerDay: 8, leadTimeDays: 10, safetyStockUnits: 25 })).toBe(105);
  });

  it('lifts the lead-time demand for a hot season, never the safety stock', () => {
    const plain = reorderPoint({ demandPerDay: 10, leadTimeDays: 10, safetyStockUnits: 40 });
    const busy = reorderPoint({
      demandPerDay: 10,
      leadTimeDays: 10,
      safetyStockUnits: 40,
      seasonalityIndex: 1.5,
    });
    expect(plain).toBe(140);
    // 10 × 10 × 1.5 + 40 — the 40 is untouched, so this is 190 and not 210.
    expect(busy).toBe(190);
  });

  it('treats an unknown season as normal rather than refusing to answer', () => {
    expect(
      reorderPoint({
        demandPerDay: 5,
        leadTimeDays: 4,
        safetyStockUnits: 10,
        seasonalityIndex: null,
      })
    ).toBe(30);
  });

  it('clamps an absurd seasonal multiplier — one freak order must not 30× the point', () => {
    const wild = reorderPoint({
      demandPerDay: 10,
      leadTimeDays: 10,
      safetyStockUnits: 0,
      seasonalityIndex: 30,
    });
    // Capped at 5×, so 500 rather than 3,000.
    expect(wild).toBe(500);
  });
});

describe('order quantity', () => {
  it('tops up to the point plus a review period, net of what is already coming', () => {
    const qty = suggestedOrderQuantity({
      reorderPointUnits: 100,
      available: 20,
      onOrder: 30,
      demandPerDay: 2,
      reviewPeriodDays: 14,
    });
    // target 100 + 28 = 128; position 50; so 78.
    expect(qty).toBe(78);
  });

  it('honours a fixed lot instead of the top-up when the business buys in pallets', () => {
    const qty = suggestedOrderQuantity({
      reorderPointUnits: 100,
      available: 20,
      onOrder: 0,
      demandPerDay: 2,
      fixedLot: 240,
    });
    expect(qty).toBe(240);
  });

  it("never orders below the supplier's minimum", () => {
    const qty = suggestedOrderQuantity({
      reorderPointUnits: 10,
      available: 8,
      onOrder: 0,
      demandPerDay: 0.1,
      reviewPeriodDays: 14,
      minOrderQty: 50,
    });
    expect(qty).toBe(50);
  });

  it('orders nothing when the position already covers the target', () => {
    expect(
      suggestedOrderQuantity({
        reorderPointUnits: 40,
        available: 200,
        onOrder: 0,
        demandPerDay: 1,
      })
    ).toBe(0);
  });
});

describe('cover and stockout', () => {
  it('has no cover figure when nothing is selling — not an infinite one', () => {
    expect(daysOfCover(500, 0)).toBeNull();
    expect(projectedStockoutAt(new Date('2026-08-11T00:00:00Z'), 500, 0)).toBeNull();
  });

  it('projects the stock-out date from a given instant, so it is reproducible', () => {
    const now = new Date('2026-08-11T00:00:00Z');
    const at = projectedStockoutAt(now, 30, 3);
    expect(at?.toISOString()).toBe('2026-08-21T00:00:00.000Z');
  });
});

describe('revenue at risk', () => {
  it('prices the demand that would go unserved before a replacement could land', () => {
    // 5 days of cover, 12-day lead time → 7 days × 4/day = 28 units at £9.50.
    const risk = stockoutRisk({
      available: 20,
      onOrder: 0,
      demandPerDay: 4,
      leadTimeDays: 12,
      unitPriceCents: 950,
    });
    expect(risk.daysOfCover).toBe(5);
    expect(risk.shortfallDays).toBe(7);
    expect(risk.unitsAtRisk).toBe(28);
    expect(risk.revenueAtRiskCents).toBe(26_600);
  });

  it('counts stock already on its way — an order placed is a gap closed', () => {
    const risk = stockoutRisk({
      available: 20,
      onOrder: 40,
      demandPerDay: 4,
      leadTimeDays: 12,
      unitPriceCents: 950,
    });
    expect(risk.daysOfCoverWithInbound).toBe(15);
    expect(risk.revenueAtRiskCents).toBe(0);
  });

  it('is zero risk when nothing is selling, however empty the shelf looks', () => {
    const risk = stockoutRisk({
      available: 0,
      onOrder: 0,
      demandPerDay: 0,
      leadTimeDays: 20,
      unitPriceCents: 5_000,
    });
    expect(risk.unitsAtRisk).toBe(0);
    expect(risk.revenueAtRiskCents).toBe(0);
    expect(risk.daysOfCover).toBeNull();
  });

  it('ranks a fast expensive line above a slow cheap one that looks emptier', () => {
    const emptyLooking = stockoutRisk({
      available: 1,
      onOrder: 0,
      demandPerDay: 0.1,
      leadTimeDays: 10,
      unitPriceCents: 200,
    });
    const busy = stockoutRisk({
      available: 60,
      onOrder: 0,
      demandPerDay: 15,
      leadTimeDays: 10,
      unitPriceCents: 4_000,
    });
    expect(busy.revenueAtRiskCents).toBeGreaterThan(emptyLooking.revenueAtRiskCents);
  });
});

describe('holding cost', () => {
  it('a quarter of the value a year, by default', () => {
    expect(holdingCostCents(4_100_000, 25)).toBe(1_025_000);
  });

  it('scales to a period rather than always reporting a year', () => {
    expect(holdingCostCents(1_200_000, 25, 30)).toBe(24_658);
  });
});

describe('ABC', () => {
  const items = [
    { key: 'engine', valueCents: 800_000 },
    { key: 'pump', valueCents: 120_000 },
    { key: 'filter', valueCents: 50_000 },
    { key: 'clip', valueCents: 20_000 },
    { key: 'washer', valueCents: 10_000 },
  ];

  it('ranks by value and cuts cumulatively at 80/95', () => {
    const byKey = new Map(classifyAbc(items).map((r) => [r.key, r]));
    // engine alone is 80% of the money, so it is the whole A class.
    expect(byKey.get('engine')?.abcClass).toBe('A');
    expect(byKey.get('pump')?.abcClass).toBe('B');
    expect(byKey.get('filter')?.abcClass).toBe('B');
    expect(byKey.get('clip')?.abcClass).toBe('C');
    expect(byKey.get('washer')?.abcClass).toBe('C');
  });

  it('gives the item that CROSSES the line to the class it crosses into', () => {
    // Two items, 79% and 21%. The first does not reach 80 on its own, so the
    // second is what carries the A group over the line — and belongs in it.
    const result = classifyAbc([
      { key: 'a', valueCents: 79 },
      { key: 'b', valueCents: 21 },
    ]);
    expect(result.map((r) => r.abcClass)).toEqual(['A', 'A']);
  });

  it('reports the share and the running total that explain the cut', () => {
    const engine = classifyAbc(items).find((r) => r.key === 'engine');
    expect(engine?.valueSharePct).toBeCloseTo(80, 4);
    expect(engine?.cumulativeSharePct).toBeCloseTo(80, 4);
    expect(engine?.rank).toBe(1);
  });

  it('makes everything C when nothing has moved, rather than crowning the least dormant row', () => {
    const result = classifyAbc([
      { key: 'a', valueCents: 0 },
      { key: 'b', valueCents: 0 },
    ]);
    expect(result.every((r) => r.abcClass === 'C')).toBe(true);
  });

  it('never puts a zero-usage item in A even when the catalogue is tiny', () => {
    const result = classifyAbc([
      { key: 'sells', valueCents: 100 },
      { key: 'dormant', valueCents: 0 },
    ]);
    expect(result.find((r) => r.key === 'dormant')?.abcClass).toBe('C');
  });

  it('respects a tenant that cuts at 70/90 instead', () => {
    const result = classifyAbc(items, { aThresholdPct: 70, bThresholdPct: 90 });
    const byKey = new Map(result.map((r) => [r.key, r]));
    expect(byKey.get('engine')?.abcClass).toBe('A');
    expect(byKey.get('pump')?.abcClass).toBe('B');
    // 92% cumulative before it → past the 90 cut.
    expect(byKey.get('filter')?.abcClass).toBe('C');
  });
});

describe('XYZ', () => {
  it('steady demand is X, wobbly is Y, erratic is Z', () => {
    expect(classifyXyz(0.2)).toBe('X');
    expect(classifyXyz(0.8)).toBe('Y');
    expect(classifyXyz(2.4)).toBe('Z');
  });

  it('no measurable demand is UNKNOWN, not Z — nobody measured it being erratic', () => {
    expect(classifyXyz(null)).toBeNull();
  });

  it('has no CV when the mean is zero, rather than a comfortable-looking 0', () => {
    expect(coefficientOfVariation(0, 4)).toBeNull();
    expect(classifyXyz(coefficientOfVariation(0, 4))).toBeNull();
  });

  // The defect this guard exists for: two sales in a month is arithmetically a
  // CV around 4, which sails past the Z threshold. Every line in a young
  // catalogue then reads "Erratic" and gets advised to order little and often —
  // confident nonsense built on a sample of two.
  it('will not call an item erratic on a couple of selling days', () => {
    const thinButSpiky = coefficientOfVariation(0.07, 0.28);
    expect(thinButSpiky).toBeGreaterThan(1);
    expect(classifyXyz(thinButSpiky, { daysWithDemand: 2, historyDays: 30 })).toBeNull();
  });

  it('needs a long enough window as well as enough selling days', () => {
    expect(classifyXyz(0.2, { daysWithDemand: 9, historyDays: 10 })).toBeNull();
    expect(classifyXyz(0.2, { daysWithDemand: 9, historyDays: 60 })).toBe('X');
  });

  it('classifies normally once both floors are cleared', () => {
    expect(classifyXyz(0.2, { daysWithDemand: 6, historyDays: 28 })).toBe('X');
    expect(classifyXyz(2.4, { daysWithDemand: 40, historyDays: 90 })).toBe('Z');
  });

  it('skips the guard entirely when no evidence is offered', () => {
    // Callers with no history to hand still get the old pure-CV behaviour, so
    // adding the guard did not silently blank out every existing call site.
    expect(classifyXyz(2.4)).toBe('Z');
    expect(xyzEvidenceIsSufficient({ daysWithDemand: 6, historyDays: 28 })).toBe(true);
    expect(xyzEvidenceIsSufficient({ daysWithDemand: 5, historyDays: 28 })).toBe(false);
    expect(xyzEvidenceIsSufficient({})).toBe(false);
  });

  it('still tells you what to do while steadiness is unknown', () => {
    // Value is knowable even when steadiness is not — an unknown pair must not
    // produce an empty cell, and must not borrow the Z advice either.
    const a = classificationAdvice('A', null);
    const c = classificationAdvice('C', null);
    expect(a).not.toBe(c);
    expect(a).not.toBe(classificationAdvice('A', 'Z'));
    expect(a.toLowerCase()).toContain('not sold on enough');
  });

  it('reads a spiky line as more erratic than a steady one at the same volume', () => {
    const steady = [3, 3, 4, 3, 3, 4, 3];
    const spiky = [0, 0, 0, 23, 0, 0, 0];
    const steadyCv = coefficientOfVariation(mean(steady), stdDev(steady));
    const spikyCv = coefficientOfVariation(mean(spiky), stdDev(spiky));
    expect(classifyXyz(steadyCv)).toBe('X');
    expect(classifyXyz(spikyCv)).toBe('Z');
  });
});

describe('advice', () => {
  it('turns every one of the nine pairs into an instruction, not a letter', () => {
    for (const abc of ['A', 'B', 'C'] as const) {
      for (const xyz of ['X', 'Y', 'Z'] as const) {
        const advice = classificationAdvice(abc, xyz);
        expect(advice.length).toBeGreaterThan(20);
        // Every pair has to end in a counting cadence — the letters are trivia,
        // "count it monthly" is the thing an operator can act on.
        expect(advice).toMatch(/count(ing)? it|counting/i);
        expect(advice).toMatch(/monthly|quarterly|once a year/i);
      }
    }
  });

  it('counts A monthly, B quarterly and C annually', () => {
    expect(cadenceIntervalDays(cadenceForAbcClass('A'))).toBe(30);
    expect(cadenceIntervalDays(cadenceForAbcClass('B'))).toBe(91);
    expect(cadenceIntervalDays(cadenceForAbcClass('C'))).toBe(365);
  });

  it('takes the interval from the number when the cadence is custom', () => {
    expect(cadenceIntervalDays('custom', 45)).toBe(45);
    expect(cadenceIntervalDays('custom', null)).toBe(30);
  });
});

describe('seasonality', () => {
  it('says nothing at all without a year of history', () => {
    expect(
      seasonalityIndex({
        samePeriodLastYearUnits: 200,
        periodDays: 30,
        trailingYearUnits: 1_000,
        historyDays: 200,
        minHistoryDays: 365,
      })
    ).toBeNull();
  });

  it('reads a busy period as a multiplier above one', () => {
    // 300 units in 30 days = 10/day, against 1,825/365 = 5/day → 2.0.
    expect(
      seasonalityIndex({
        samePeriodLastYearUnits: 300,
        periodDays: 30,
        trailingYearUnits: 1_825,
        historyDays: 400,
        minHistoryDays: 365,
      })
    ).toBeCloseTo(2, 4);
  });

  it('has no index when last year sold nothing — a ratio to zero is not a big number', () => {
    expect(
      seasonalityIndex({
        samePeriodLastYearUnits: 0,
        periodDays: 30,
        trailingYearUnits: 0,
        historyDays: 700,
        minHistoryDays: 365,
      })
    ).toBeNull();
  });
});

describe('forecast window', () => {
  it('uses the 30-day rate for an ordinary line', () => {
    expect(
      chooseForecast({
        perDay7: 3,
        perDay30: 2.5,
        perDay90: 2.2,
        units30: 75,
        units90: 198,
        historyDays: 400,
      })
    ).toEqual({ perDay: 2.5, basis: '30d' });
  });

  it('uses the 7-day rate for something too new to average over a month', () => {
    expect(
      chooseForecast({
        perDay7: 6,
        perDay30: 1.4,
        perDay90: 0.5,
        units30: 42,
        units90: 42,
        historyDays: 9,
      })
    ).toEqual({ perDay: 6, basis: '7d' });
  });

  it('falls back to 90 days for a slow mover whose last month was all zeroes', () => {
    expect(
      chooseForecast({
        perDay7: 0,
        perDay30: 0,
        perDay90: 0.07,
        units30: 0,
        units90: 6,
        historyDays: 500,
      })
    ).toEqual({ perDay: 0.07, basis: '90d' });
  });

  it('reports no basis at all when nothing has ever sold', () => {
    expect(
      chooseForecast({
        perDay7: 0,
        perDay30: 0,
        perDay90: 0,
        units30: 0,
        units90: 0,
        historyDays: 900,
      })
    ).toEqual({ perDay: 0, basis: 'none' });
  });
});

describe('descriptive statistics', () => {
  it('has no spread to report from a single observation', () => {
    expect(stdDev([7])).toBe(0);
    expect(stdDev([])).toBe(0);
  });

  it('uses the sample deviation (n−1), because these are samples of days', () => {
    // Population σ of [2,4,4,4,5,5,7,9] is 2; the sample figure is higher.
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.1381, 4);
  });
});
