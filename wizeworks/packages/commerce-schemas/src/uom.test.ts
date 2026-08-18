// The unit arithmetic and the way a quantity is said out loud (docs/146 Phase 6).
//
// Pure, so these run everywhere including CI with no database — which matters
// more than usual here, because every one of these functions sits between what
// a person typed and what the stock ledger stores. A wrong factor is not a
// display bug; it is a stock number that is twelve times wrong.

import { describe, expect, it } from 'vitest';

import {
  buildableFrom,
  describeQuantity,
  describeQuantityShort,
  requiredForRun,
  splitIntoUom,
  toBaseUnits,
  STARTER_UNITS,
  UomCode,
  UnitsPerUom,
} from './index';

describe('unit conversion', () => {
  it('multiplies what was typed into base units', () => {
    expect(toBaseUnits(4, 12)).toBe(48);
    expect(toBaseUnits(1, 1)).toBe(1);
    expect(toBaseUnits(0, 12)).toBe(0);
  });

  it('treats a missing or nonsense factor as one rather than as zero', () => {
    // The failure this guards is silent and total: a factor of 0 would turn
    // every entry into a stock movement of nothing.
    expect(toBaseUnits(5, 0)).toBe(5);
    expect(toBaseUnits(5, Number.NaN)).toBe(5);
    expect(toBaseUnits(5, -3)).toBe(5);
  });

  it('splits base units into whole packs and a remainder, sign preserved', () => {
    expect(splitIntoUom(48, 12)).toEqual({ whole: 4, remainder: 0 });
    expect(splitIntoUom(30, 12)).toEqual({ whole: 2, remainder: 6 });
    expect(splitIntoUom(7, 12)).toEqual({ whole: 0, remainder: 7 });
    // A negative on-hand is a real state (a sale under a continue policy), and
    // it must not read as a positive pile of cases.
    expect(splitIntoUom(-30, 12)).toEqual({ whole: -2, remainder: -6 });
  });
});

describe('saying a quantity out loud', () => {
  it('reads as the base unit when there is no pack', () => {
    expect(describeQuantity({ baseQuantity: 48 })).toBe('48 each');
    expect(describeQuantity({ baseQuantity: 1 })).toBe('1 each');
  });

  it('leads with the pack on an exact multiple, and never drops the base figure', () => {
    const said = describeQuantity({
      baseQuantity: 48,
      uomCode: 'CS',
      unitsPerUom: 12,
      uomName: 'case',
      uomPluralName: 'cases',
    });
    expect(said).toBe('4 cases (48 each)');
    // The base figure being present is the whole point: it is what makes a bad
    // factor obvious the moment it is entered rather than at the next count.
    expect(said).toContain('48');
  });

  it('leads with the base figure on a part pack rather than inventing half a case', () => {
    expect(
      describeQuantity({
        baseQuantity: 30,
        uomCode: 'CS',
        unitsPerUom: 12,
        uomName: 'case',
        uomPluralName: 'cases',
      })
    ).toBe('30 each (2 cases and 6)');
    // Nothing in the output may claim a fractional pack — there is no such
    // object on the shelf.
    expect(describeQuantity({ baseQuantity: 30, uomCode: 'CS', unitsPerUom: 12 })).not.toMatch(
      /2\.5/
    );
  });

  it('drops the pack entirely when there is less than one of it', () => {
    expect(
      describeQuantity({
        baseQuantity: 7,
        uomCode: 'CS',
        unitsPerUom: 12,
        uomName: 'case',
        uomPluralName: 'cases',
      })
    ).toBe('7 each');
  });

  it('gets the singular right for units that do not just take an s', () => {
    expect(
      describeQuantity({
        baseQuantity: 12,
        uomCode: 'BX',
        unitsPerUom: 12,
        uomName: 'box',
        uomPluralName: 'boxes',
      })
    ).toBe('1 box (12 each)');
    expect(
      describeQuantity({
        baseQuantity: 24,
        uomCode: 'BX',
        unitsPerUom: 12,
        uomName: 'box',
        uomPluralName: 'boxes',
      })
    ).toBe('2 boxes (24 each)');
  });

  it('honours a base unit that is not "each"', () => {
    expect(
      describeQuantity({
        baseQuantity: 500,
        baseUomName: 'gram',
        baseUomPluralName: 'grams',
        uomCode: 'KG',
        unitsPerUom: 1000,
        uomName: 'kilogram',
        uomPluralName: 'kilograms',
      })
    ).toBe('500 grams');
  });

  it('shortens to a table cell without lying', () => {
    expect(describeQuantityShort({ baseQuantity: 48, uomCode: 'CS', unitsPerUom: 12 })).toBe(
      '4 CS · 48'
    );
    // A part pack falls back to the base number alone — a cell is too small to
    // qualify it and a rounded pack count would be wrong.
    expect(describeQuantityShort({ baseQuantity: 30, uomCode: 'CS', unitsPerUom: 12 })).toBe('30');
    expect(describeQuantityShort({ baseQuantity: 30 })).toBe('30');
  });
});

describe('unit codes and factors', () => {
  it('upper-cases a code so one unit cannot become two rows', () => {
    expect(UomCode.parse(' cs ')).toBe('CS');
    expect(UomCode.parse('Pal')).toBe('PAL');
  });

  it('refuses a factor that is not a whole number of the base unit', () => {
    // The refusal is the feature: a fractional factor makes on-hand fractional
    // and an inventory that holds 4.999999 of something cannot reconcile.
    expect(UnitsPerUom.safeParse(0.5).success).toBe(false);
    expect(UnitsPerUom.safeParse(0).success).toBe(false);
    expect(UnitsPerUom.safeParse(12).success).toBe(true);
  });

  it('ships a starter set whose codes are unique and whose base unit is first', () => {
    const codes = STARTER_UNITS.map((u) => u.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes[0]).toBe('EA');
  });
});

describe('how much a run needs', () => {
  it('scales a batch recipe to the run', () => {
    // A batch of 10 needing 30 → a run of 25 is 2.5 batches → 75.
    expect(requiredForRun({ quantityPerBatch: 30, outputPerBatch: 10, runQuantity: 25 })).toBe(75);
  });

  it('rounds UP, because half a component cannot be pulled', () => {
    // 3 per batch of 10, run of 25 → 7.5 → 8. Pulling 7 and finding out halfway
    // through is exactly what this is meant to prevent.
    expect(requiredForRun({ quantityPerBatch: 3, outputPerBatch: 10, runQuantity: 25 })).toBe(8);
  });

  it('adds scrap on top of the recipe, not into it', () => {
    // 100 per batch of 1, 2.5% waste → 102.5 → 103.
    expect(
      requiredForRun({
        quantityPerBatch: 100,
        outputPerBatch: 1,
        runQuantity: 1,
        scrapPercent: 2.5,
      })
    ).toBe(103);
  });
});

describe('what can be built from what is on hand', () => {
  it('names the component that runs out first, not just the number', () => {
    const result = buildableFrom(
      [
        { variantId: 'panel', requiredPerBatch: 1, available: 40, supports: 40 },
        { variantId: 'hinge', requiredPerBatch: 4, available: 56, supports: 14 },
        { variantId: 'screw', requiredPerBatch: 8, available: 900, supports: 112 },
      ],
      1
    );
    // "You can make 14" is half a fact. "You can make 14, you run out of hinges"
    // is the one that turns into a purchase order.
    expect(result.quantity).toBe(14);
    expect(result.limitingVariantId).toBe('hinge');
  });

  it('rounds down to whole batches — a part batch is not a thing you can make', () => {
    const result = buildableFrom(
      [{ variantId: 'glue', requiredPerBatch: 1, available: 7, supports: 7 }],
      4
    );
    expect(result.quantity).toBe(4);
  });

  it('answers zero for a recipe with no components rather than infinity', () => {
    expect(buildableFrom([], 1)).toEqual({ quantity: 0, limitingVariantId: null });
  });
});
