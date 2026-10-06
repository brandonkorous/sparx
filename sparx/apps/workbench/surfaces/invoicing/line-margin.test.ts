// Margin on a quote, as you price it (sparx persona issue 086).
//
// The /b2b page promises "Margin shows as you price, off the cost basis". It
// showed only on lines priced by a markup rule, and nowhere for the document.
// These pin what every line and the whole document say, and the rule under all
// of it: a line with no cost is left out and SAID to be left out. It is never
// counted as costing $0, which would report a 100% margin on it.

import { describe, expect, it } from 'vitest';
import {
  documentMargin,
  lineCostCents,
  lineMargin,
  marginWords,
  uncostedSentence,
} from './line-margin';
import type { DraftLine } from './totals';

const line = (over: Partial<DraftLine> = {}): DraftLine => ({
  key: 'k',
  description: 'Bosch Remanufactured Fuel Injector',
  quantity: 1,
  unitPrice: 600,
  discountAmount: 0,
  taxable: true,
  ...over,
});

describe('lineCostCents', () => {
  it('reads the cost typed in the editor before the one the server last stored', () => {
    expect(lineCostCents(line({ costCents: 41_250, explicitCostCents: 39_000 }))).toBe(39_000);
    expect(lineCostCents(line({ costCents: 41_250 }))).toBe(41_250);
  });

  it('is null when no cost was ever given, never 0', () => {
    expect(lineCostCents(line())).toBeNull();
    expect(lineCostCents(line({ costCents: null, explicitCostCents: null }))).toBeNull();
  });

  it('keeps a cost of zero that was typed', () => {
    expect(lineCostCents(line({ explicitCostCents: 0 }))).toBe(0);
  });
});

describe('lineMargin', () => {
  it('works out profit and margin on any line with a cost, not only a markup line', () => {
    const margin = lineMargin(line({ quantity: 2, unitPrice: 600, costCents: 41_250 }));
    expect(margin?.profitCents).toBe(37_500);
    expect(margin?.marginPct).toBe(31.3);
    expect(margin?.tone).toBe('success');
  });

  it('takes the line discount off what is earned', () => {
    const margin = lineMargin(line({ unitPrice: 600, discountAmount: 100, costCents: 41_250 }));
    expect(margin?.profitCents).toBe(8_750);
    expect(margin?.marginPct).toBe(17.5);
  });

  it('warns on a thin margin', () => {
    expect(lineMargin(line({ unitPrice: 100, costCents: 9_000 }))?.tone).toBe('warning');
  });

  it('is danger when the line sells below cost', () => {
    const margin = lineMargin(line({ unitPrice: 400, costCents: 41_250 }));
    expect(margin?.profitCents).toBe(-1_250);
    expect(margin?.tone).toBe('danger');
  });

  it('is danger with no percentage when the line is given away', () => {
    const margin = lineMargin(line({ unitPrice: 0, costCents: 2_000 }));
    expect(margin?.profitCents).toBe(-2_000);
    expect(margin?.marginPct).toBeNull();
    expect(margin?.tone).toBe('danger');
  });

  it('is null with no cost', () => {
    expect(lineMargin(line())).toBeNull();
  });
});

describe('marginWords', () => {
  it('says the margin and the money kept', () => {
    const margin = lineMargin(line({ costCents: 41_250 }));
    expect(margin && marginWords(margin, 'USD')).toBe('31.3% margin, $187.50 profit');
  });

  it('says plainly when a line loses money', () => {
    const margin = lineMargin(line({ unitPrice: 400, costCents: 41_250 }));
    expect(margin && marginWords(margin, 'USD')).toBe('Below cost: you lose $12.50');
  });
});

describe('documentMargin', () => {
  it('counts only the lines that have a cost, and says how many do not', () => {
    const margin = documentMargin([
      line({ unitPrice: 600, costCents: 41_250 }),
      line({ description: 'Labor', quantity: 2, unitPrice: 145, explicitCostCents: 6_200 }),
      line({ description: 'Shop supplies', unitPrice: 25 }),
      line({ description: 'Disposal fee', unitPrice: 10 }),
    ]);
    expect(margin.costedLines).toBe(2);
    expect(margin.uncostedLines).toBe(2);
    expect(margin.revenueCents).toBe(89_000);
    expect(margin.costCents).toBe(53_650);
    expect(margin.profitCents).toBe(35_350);
    expect(margin.marginPct).toBe(39.7);
    expect(margin.tone).toBe('success');
  });

  it('has no figures at all when no line has a cost', () => {
    const margin = documentMargin([line({ unitPrice: 25 })]);
    expect(margin.costedLines).toBe(0);
    expect(margin.costCents).toBeNull();
    expect(margin.profitCents).toBeNull();
    expect(margin.marginPct).toBeNull();
  });

  it('leaves out a blank row nobody filled in', () => {
    const margin = documentMargin([
      line({ costCents: 41_250 }),
      line({ description: '', unitPrice: 0 }),
    ]);
    expect(margin.uncostedLines).toBe(0);
  });
});

describe('uncostedSentence', () => {
  it('says how many lines are not counted, in words', () => {
    expect(uncostedSentence(1)).toBe('1 line has no cost, so it is not counted.');
    expect(uncostedSentence(2)).toBe('2 lines have no cost, so they are not counted.');
    expect(uncostedSentence(0)).toBeNull();
  });
});
