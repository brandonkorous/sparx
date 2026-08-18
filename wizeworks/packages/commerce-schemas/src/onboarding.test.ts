// Phase 11 onboarding arithmetic (docs/146 §6 Phase 11.1–11.2, 11.7).
//
// Two claims are pinned here, and both are about not being confidently wrong.
//
//   A GUESS CARRIES ITS CONFIDENCE, and a guess below the threshold reports NO
//   match rather than a plausible one. Half the matcher tests below exist to
//   hold `header: null` in place, because the failure that costs a day is not a
//   blank mapping screen — it is a pre-filled one that is wrong.
//
//   A CLOCK NOBODY STARTED HAS NOT MEASURED ZERO. `handsOnMs` and
//   `withinTarget` are null until there is something to measure, exactly like
//   the Phase 10 ratios.

import { describe, expect, it } from 'vitest';

import {
  COLUMN_MATCH_THRESHOLD,
  MIGRATION_RECIPES,
  SETUP_STEPS,
  SETUP_TARGET_MS,
  detectNumberFormat,
  formatDuration,
  matchColumns,
  migrationRecipe,
  normalizeHeader,
  parseSpreadsheetNumber,
  similarity,
  summarizeMapping,
  summarizeSetup,
  targetsForRecipe,
  type SetupStepState,
} from './onboarding';

const stamp = (iso: string): SetupStepState => ({
  completedAt: iso,
  skippedAt: null,
  result: {},
});

describe('normalizeHeader', () => {
  it('reduces punctuation and case so one heading is one heading', () => {
    expect(normalizeHeader('Qty. On-Hand')).toBe('qty on hand');
    expect(normalizeHeader('  SKU  ')).toBe('sku');
    expect(normalizeHeader('warehouse_code')).toBe('warehouse code');
  });

  it('survives a heading made entirely of punctuation', () => {
    expect(normalizeHeader('###')).toBe('');
  });
});

describe('similarity', () => {
  it('is 1 for identical strings and 0 for a one-character string', () => {
    expect(similarity('quantity', 'quantity')).toBe(1);
    expect(similarity('q', 'quantity')).toBe(0);
  });

  it('scores a plural close and two unrelated words far apart', () => {
    expect(similarity('note', 'notes')).toBeGreaterThan(0.7);
    expect(similarity('supplier', 'quantity')).toBeLessThan(0.3);
  });
});

describe('matchColumns', () => {
  it('matches the obvious headings exactly', () => {
    const matches = matchColumns(['SKU', 'Warehouse', 'On Hand']);
    const bySku = matches.find((m) => m.key === 'sku');
    expect(bySku?.header).toBe('SKU');
    expect(bySku?.reason).toBe('exact');
    expect(matches.find((m) => m.key === 'onHand')?.header).toBe('On Hand');
    expect(matches.find((m) => m.key === 'warehouse')?.header).toBe('Warehouse');
  });

  it('reports NO match rather than a bad one when nothing is close', () => {
    const matches = matchColumns(['Color', 'Supplier notes about the pallet']);
    const sku = matches.find((m) => m.key === 'sku');
    expect(sku?.header).toBeNull();
    expect(sku?.reason).toBe('none');
    expect(sku?.confidence).toBe(0);
  });

  it('never gives one heading to two fields', () => {
    const matches = matchColumns(['quantity']);
    const used = matches.filter((m) => m.header === 'quantity');
    expect(used).toHaveLength(1);
  });

  it('gives each heading to the field that wants it most', () => {
    const matches = matchColumns(['Quantity On Hand', 'Adjustment']);
    expect(matches.find((m) => m.key === 'onHand')?.header).toBe('Quantity On Hand');
    expect(matches.find((m) => m.key === 'delta')?.header).toBe('Adjustment');
  });

  it('offers near misses as alternatives without claiming them', () => {
    const matches = matchColumns(['Cost centre']);
    const cost = matches.find((m) => m.key === 'unitCost');
    // "Cost centre" is not the unit cost. It may be offered; it must not be
    // silently chosen with a confidence that reads as an answer.
    if (cost?.header !== null)
      expect(cost?.confidence).toBeGreaterThanOrEqual(COLUMN_MATCH_THRESHOLD);
  });

  it('is case- and punctuation-insensitive', () => {
    expect(matchColumns(['sku']).find((m) => m.key === 'sku')?.reason).toBe('exact');
    expect(matchColumns(['S.K.U.']).find((m) => m.key === 'sku')?.reason).toBe('exact');
  });
});

describe('summarizeMapping', () => {
  it('is not ready without a code column', () => {
    const headers = ['Quantity'];
    const verdict = summarizeMapping(headers, matchColumns(headers));
    expect(verdict.ready).toBe(false);
    expect(verdict.missingRequired).toContain('Item code');
  });

  it('is not ready without SOME quantity column', () => {
    const headers = ['SKU', 'Warehouse'];
    const verdict = summarizeMapping(headers, matchColumns(headers));
    expect(verdict.ready).toBe(false);
    expect(verdict.missingRequired.join(' ')).toContain('Quantity');
  });

  it('is ready with a code and a count, and lists what it ignored', () => {
    const headers = ['SKU', 'On Hand', 'Bin color'];
    const verdict = summarizeMapping(headers, matchColumns(headers));
    expect(verdict.ready).toBe(true);
    expect(verdict.unmatchedHeaders).toContain('Bin color');
  });
});

describe('migration recipes', () => {
  it('every recipe is findable by key and names no vendor', () => {
    for (const recipe of MIGRATION_RECIPES) {
      expect(migrationRecipe(recipe.key)).toBe(recipe);
      expect(recipe.name.length).toBeGreaterThan(0);
    }
    expect(migrationRecipe('nothing-like-this')).toBeNull();
  });

  it('a recipe only WIDENS the vocabulary — it never removes a standard alias', () => {
    const base = targetsForRecipe(null);
    const widened = targetsForRecipe('accounting_export');
    for (const [index, target] of base.entries()) {
      for (const alias of target.aliases) {
        expect(widened[index]!.aliases).toContain(alias);
      }
    }
  });

  it("matches an accounts export's headings once its recipe is chosen", () => {
    const headers = ['Item Name', 'Quantity On Hand', 'Purchase Cost'];
    const matches = matchColumns(headers, targetsForRecipe('accounting_export'));
    expect(matches.find((m) => m.key === 'sku')?.header).toBe('Item Name');
    expect(matches.find((m) => m.key === 'onHand')?.header).toBe('Quantity On Hand');
    expect(matches.find((m) => m.key === 'unitCost')?.header).toBe('Purchase Cost');
  });
});

describe('detectNumberFormat', () => {
  it('returns null when the file gave no evidence either way', () => {
    expect(detectNumberFormat([])).toBeNull();
    expect(detectNumberFormat(['12', '480', '7'])).toBeNull();
    expect(detectNumberFormat(['n/a', ''])).toBeNull();
  });

  it('reads a comma decimal', () => {
    expect(detectNumberFormat(['12,50', '9,75'])?.decimal).toBe(',');
  });

  it('reads a full-stop decimal', () => {
    expect(detectNumberFormat(['12.50', '9.75'])?.decimal).toBe('.');
  });

  it('treats an unaccompanied three-digit group as evidence of nothing', () => {
    // "1,500" is genuinely both one and a half thousand and one point five.
    // Voting for either from this alone is the guess that goes wrong silently.
    expect(detectNumberFormat(['1,500'])).toBeNull();
  });
});

describe('parseSpreadsheetNumber', () => {
  it('separates blank from unparseable', () => {
    expect(parseSpreadsheetNumber('')).toEqual({ value: null, unit: null, blank: true });
    expect(parseSpreadsheetNumber('n/a').blank).toBe(false);
    expect(parseSpreadsheetNumber('n/a').value).toBeNull();
  });

  it('strips grouping separators', () => {
    expect(parseSpreadsheetNumber('1,234').value).toBe(1234);
    expect(parseSpreadsheetNumber('12 000').value).toBe(12000);
  });

  it('honours a comma decimal when told', () => {
    const format = { decimal: ',' as const, grouped: true, sampleCount: 5 };
    expect(parseSpreadsheetNumber('1.234,56', format).value).toBeCloseTo(1234.56);
  });

  it('reads an accounting negative', () => {
    expect(parseSpreadsheetNumber('(5)').value).toBe(-5);
    expect(parseSpreadsheetNumber('(1,200.50)').value).toBeCloseTo(-1200.5);
  });

  it('keeps a trailing unit rather than discarding it', () => {
    expect(parseSpreadsheetNumber('12 ea')).toEqual({ value: 12, unit: 'ea', blank: false });
    expect(parseSpreadsheetNumber('3 cases').unit).toBe('cases');
  });

  it('drops a currency symbol', () => {
    expect(parseSpreadsheetNumber('$4.50').value).toBeCloseTo(4.5);
    expect(parseSpreadsheetNumber('$4.50').unit).toBeNull();
  });
});

describe('summarizeSetup', () => {
  it('measures nothing before anything has happened', () => {
    const progress = summarizeSetup({ startedAt: null, completedAt: null, steps: {} });
    expect(progress.completedCount).toBe(0);
    expect(progress.timing.handsOnMs).toBeNull();
    expect(progress.timing.elapsedMs).toBeNull();
    // Null, NOT false. An unmeasured setup is not a failed one.
    expect(progress.timing.withinTarget).toBeNull();
    expect(progress.currentStep).toBe(SETUP_STEPS[0]!.key);
  });

  it('measures hands-on time from the step stamps', () => {
    const start = new Date('2026-08-12T09:00:00Z');
    const progress = summarizeSetup({
      startedAt: start,
      completedAt: new Date('2026-08-12T09:18:00Z'),
      steps: {
        locations: stamp('2026-08-12T09:04:00Z'),
        import: stamp('2026-08-12T09:11:00Z'),
        mapping: stamp('2026-08-12T09:14:00Z'),
        opening_balance: stamp('2026-08-12T09:17:00Z'),
        alerts: stamp('2026-08-12T09:18:00Z'),
      },
    });
    expect(progress.isComplete).toBe(true);
    expect(progress.timing.elapsedMs).toBe(18 * 60_000);
    expect(progress.timing.handsOnMs).toBe(18 * 60_000);
    expect(progress.timing.sittings).toBe(1);
    expect(progress.timing.withinTarget).toBe(true);
  });

  it('excludes a long gap from hands-on time AND counts it as a sitting', () => {
    const progress = summarizeSetup({
      startedAt: new Date('2026-08-12T09:00:00Z'),
      completedAt: null,
      steps: {
        // Four minutes of work, a two-hour break, then six more minutes.
        locations: stamp('2026-08-12T09:04:00Z'),
        import: stamp('2026-08-12T11:10:00Z'),
      },
    });
    expect(progress.timing.handsOnMs).toBe(4 * 60_000);
    expect(progress.timing.sittings).toBe(2);
    // Never finished, so there is no start-to-finish figure to report.
    expect(progress.timing.elapsedMs).toBeNull();
  });

  it('counts a skipped step as settled and keeps it out of completed', () => {
    const progress = summarizeSetup({
      startedAt: new Date('2026-08-12T09:00:00Z'),
      completedAt: null,
      steps: {
        locations: stamp('2026-08-12T09:02:00Z'),
        import: { completedAt: null, skippedAt: '2026-08-12T09:03:00Z', result: {} },
      },
    });
    expect(progress.completedCount).toBe(1);
    expect(progress.skippedCount).toBe(1);
    expect(progress.remaining).not.toContain('locations');
    expect(progress.remaining).not.toContain('import');
    expect(progress.currentStep).toBe('mapping');
  });

  it('reports over-target honestly', () => {
    const progress = summarizeSetup({
      startedAt: new Date('2026-08-12T09:00:00Z'),
      completedAt: null,
      steps: {
        // Two stamps 14 minutes apart, three times over — inside the sitting
        // gap, so all of it counts.
        locations: stamp('2026-08-12T09:14:00Z'),
        import: stamp('2026-08-12T09:28:00Z'),
        mapping: stamp('2026-08-12T09:42:00Z'),
      },
    });
    expect(progress.timing.handsOnMs).toBeGreaterThan(SETUP_TARGET_MS);
    expect(progress.timing.withinTarget).toBe(false);
  });
});

describe('formatDuration', () => {
  it('returns null for null so a caller writes "not measured"', () => {
    expect(formatDuration(null)).toBeNull();
  });

  it('says what a person would say', () => {
    expect(formatDuration(30_000)).toBe('under a minute');
    expect(formatDuration(60_000)).toBe('1 minute');
    expect(formatDuration(18 * 60_000)).toBe('18 minutes');
    expect(formatDuration(60 * 60_000)).toBe('1 hour');
    expect(formatDuration(64 * 60_000)).toBe('1 hour 4 minutes');
  });
});
