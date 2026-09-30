// THE COUNTS ON "STOCK VERSUS YOUR BOOKS" HAVE TO AGREE WITH THEMSELVES.
//
// Juniper Row's screen read, under "Invoiced, not yet on your shelves":
//
//     1 order lines        −$658.80
//
// One line. Every count on that screen hard-coded its plural, so every one of
// them said this the day a business had exactly one of something.
//
// Two of them had the wrong noun as well: the consignment and
// priced-not-purchased counts are `COUNT(*)` over `inventory_levels`, which is
// an item at a location, and the screen called them "lines".

import { describe, expect, it } from 'vitest';
import {
  count,
  reconciliationWords,
  type ReconciliationLineKind,
  type ReconciliationMeasurement,
} from './gl-reconciliation-lines';

/** Everything at zero, so each test can move ONE number and be sure the
 *  sentence it reads changed because of that number. */
const NOTHING: ReconciliationMeasurement = {
  totalUnits: 0,
  totalValueCents: 0,
  grniCents: 0,
  grniLines: 0,
  inrCents: 0,
  inrLines: 0,
  nonOwnedCents: 0,
  nonOwnedItems: 0,
  pricedOnlyCents: 0,
  pricedOnlyItems: 0,
  uncostedUnits: 0,
  inTransitCents: 0,
  inTransitLines: 0,
  ledger: null,
};

const ref = (m: Partial<ReconciliationMeasurement>, kind: ReconciliationLineKind): string | null =>
  reconciliationWords({ ...NOTHING, ...m }).lines.find((line) => line.kind === kind)?.reference ??
  null;

/** Every count on the screen, and the measurement that drives it. One entry per
 *  `reference` that is built from a number, so a new line without a plural rule
 *  fails the sweep below rather than shipping. */
const COUNTED: { kind: ReconciliationLineKind; field: keyof ReconciliationMeasurement }[] = [
  { kind: 'sparx_value', field: 'totalUnits' },
  { kind: 'goods_received_not_invoiced', field: 'grniLines' },
  { kind: 'invoiced_not_received', field: 'inrLines' },
  { kind: 'non_owned_stock', field: 'nonOwnedItems' },
  { kind: 'priced_not_purchased', field: 'pricedOnlyItems' },
  { kind: 'uncosted_units', field: 'uncostedUnits' },
  { kind: 'in_transit', field: 'inTransitLines' },
];

const at = (field: keyof ReconciliationMeasurement, n: number, kind: ReconciliationLineKind) =>
  ref({ [field]: n }, kind);

/** The words after the number, which is the part the plural lives in. */
const noun = (text: string | null, n: number): string | null =>
  text === null ? null : text.replace(new RegExp(`^${String(n)} `), '');

describe('count', () => {
  it('uses the singular for exactly one', () => {
    expect(count(1, 'order line', 'order lines')).toBe('1 order line');
  });

  it('uses the plural for none, and for more than one', () => {
    // Zero takes the plural in English: "0 order lines", never "0 order line".
    expect(count(0, 'order line', 'order lines')).toBe('0 order lines');
    expect(count(2, 'order line', 'order lines')).toBe('2 order lines');
  });
});

describe('every count on the screen agrees in number', () => {
  it.each(COUNTED)('$kind reads differently at one than at two', ({ kind, field }) => {
    const one = noun(at(field, 1, kind), 1);
    const two = noun(at(field, 2, kind), 2);
    expect(one, kind).not.toBeNull();
    // The property, stated so it fails on the bug rather than on a noun: a
    // hard-coded plural reads IDENTICALLY at one and at two, whatever the word
    // happens to be. A new line added without a plural rule fails here.
    expect(one, kind).not.toBe(two);
  });

  it.each(COUNTED)('$kind reads the same at none as at two', ({ kind, field }) => {
    // Zero takes the plural in English, so these must be the same words.
    const zero = noun(at(field, 0, kind), 0);
    const two = noun(at(field, 2, kind), 2);
    // `uncosted_units` has no count at zero on purpose: there is nothing to
    // report, and the line says the opposite in words instead.
    if (zero === null) {
      expect(kind, 'only the uncosted line may drop its count').toBe('uncosted_units');
      return;
    }
    expect(zero, kind).toBe(two);
  });
});

describe('the nouns name what was actually counted', () => {
  it('calls consigned stock items, because it counted stock levels', () => {
    // `COUNT(*)` over `inventory_levels`: an item at a location. The screen
    // said "3 lines", which is a word for something else entirely.
    expect(ref({ nonOwnedItems: 3 }, 'non_owned_stock')).toBe('3 items');
    expect(ref({ pricedOnlyItems: 3, pricedOnlyCents: 87_000 }, 'priced_not_purchased')).toBe(
      '3 items'
    );
  });

  it('calls purchase-order rows order lines, because it counted those', () => {
    expect(ref({ grniLines: 3 }, 'goods_received_not_invoiced')).toBe('3 order lines');
    expect(ref({ inrLines: 3 }, 'invoiced_not_received')).toBe('3 order lines');
  });
});

describe('the sentence about uncosted units finishes', () => {
  const said = (units: number): string =>
    reconciliationWords({ ...NOTHING, uncostedUnits: units }).lines.find(
      (line) => line.kind === 'uncosted_units'
    )?.description ?? '';

  it('says what the units are worth here, and why', () => {
    const text = said(375);
    expect(text).toContain('375 units');
    expect(text).toContain('nothing was ever paid for them that we can see');
  });

  it('never ends on a dangling verb', () => {
    // It read "...an opening balance in your books may not have", eliding the
    // verb phrase from the clause before it. Grammatical, and it reads to the
    // person it is written for as a sentence that got cut off.
    expect(said(375)).not.toMatch(/\bmay not have$/);
    // Whatever the wording, the last clause has to carry its own object.
    expect(said(375).trimEnd()).not.toMatch(/\b(have|has|had|is|are|was|were|do|does)$/);
  });

  it('says the opposite plainly when every unit has a cost', () => {
    expect(said(0)).toBe('Every unit on hand has a cost behind it');
    expect(ref({ uncostedUnits: 0 }, 'uncosted_units')).toBeNull();
  });

  it('never prices what nobody costed', () => {
    // The units exist and their value is genuinely unknown. $0.00 would assert
    // they are worthless.
    const line = reconciliationWords({ ...NOTHING, uncostedUnits: 375 }).lines.find(
      (l) => l.kind === 'uncosted_units'
    );
    expect(line?.amountCents).toBeNull();
  });
});

describe('the difference is null until the books are entered', () => {
  it('refuses to report a difference of nothing', () => {
    // The most dangerous number this screen could produce.
    expect(reconciliationWords(NOTHING).unexplainedCents).toBeNull();
  });

  it('works it out once a balance is given', () => {
    const words = reconciliationWords({
      ...NOTHING,
      totalValueCents: 96_792,
      grniCents: 1_000,
      ledger: { accountName: '1200 Stock', balanceCents: 100_000, source: 'accountant' },
    });
    expect(words.explainedCents).toBe(1_000);
    expect(words.unexplainedCents).toBe(100_000 - (96_792 + 1_000));
  });
});

/**
 * "498 UNITS ON HAND — $1,064.49", BUILT FROM 123 OF THEM.
 *
 * The top row is where a reader forms the impression of what her stock is
 * worth, and its Covering cell named every unit she holds beside a figure that
 * only covers the ones with a cost behind them. Juniper Row: 375 of 498 units
 * have nothing recorded about what they cost.
 *
 * The screen does say so, in the uncosted line, five rows further down and
 * after the total has already been read.
 */
describe('what the top figure covers', () => {
  it('names the units actually behind it when some have no cost', () => {
    const { lines } = reconciliationWords({
      ...NOTHING,
      totalUnits: 498,
      totalValueCents: 106449,
      uncostedUnits: 375,
    });
    const ours = lines.find((line) => line.kind === 'sparx_value');
    expect(ours?.reference).toBe('123 of 498 units on hand');
  });

  it('names them all when every one of them has a cost', () => {
    const { lines } = reconciliationWords({
      ...NOTHING,
      totalUnits: 498,
      totalValueCents: 106449,
      uncostedUnits: 0,
    });
    expect(lines.find((line) => line.kind === 'sparx_value')?.reference).toBe('498 units on hand');
  });

  it('still counts one unit as one unit', () => {
    const { lines } = reconciliationWords({ ...NOTHING, totalUnits: 1, uncostedUnits: 0 });
    expect(lines.find((line) => line.kind === 'sparx_value')?.reference).toBe('1 unit on hand');
  });
});
