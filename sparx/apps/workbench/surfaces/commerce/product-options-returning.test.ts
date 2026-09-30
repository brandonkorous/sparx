// A SQUARE HELD BY A RETIRED VERSION IS NOT BLANK.
//
// Removing a choice deletes its values, and every version sitting on one loses
// its place and is retired. The server writes down where each one sat
// (`metadata.latticeCoordinate`, lattice-memory.ts) and, when the choice is added
// back, puts it back. The Options tab could not see that: it fetched only live
// versions and read no metadata, so adding "Large" back to a shirt told the owner
// "3 combinations will have no price, set them on the Variants tab" over three
// squares the server was about to refill with the real codes and all the stock.
// Doing as told meant new versions under made-up codes, since a retired version
// keeps its code reserved.

import { describe, expect, it } from 'vitest';

import { consequenceLines, consequenceOf, planOf } from './product-options-plan';
import { lastCoordinate, type ProductOption, type Variant } from './products-data';

function variant(over: Partial<Variant>): Variant {
  return {
    id: 'v',
    productId: 'p',
    sku: 'SKU',
    barcode: null,
    title: null,
    priceCents: 4200,
    compareAtPriceCents: null,
    costCents: null,
    currency: 'USD',
    weightGrams: null,
    lengthMm: null,
    widthMm: null,
    heightMm: null,
    inventoryPolicy: 'deny',
    requiresShipping: true,
    fulfillmentType: null,
    dropshipSourceId: null,
    markupRuleId: null,
    isDefault: false,
    position: 0,
    optionValueIds: [],
    metadata: {},
    imageCount: 0,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
    deletedAt: null,
    ...over,
  };
}

/** Size is Small and Medium today. Large was removed last week. */
const saved: ProductOption[] = [
  {
    id: 'size',
    productId: 'p',
    name: 'Size',
    displayType: 'dropdown',
    position: 0,
    values: [
      { id: 's', optionId: 'size', value: 'Small', position: 0, swatchHex: null },
      { id: 'm', optionId: 'size', value: 'Medium', position: 1, swatchHex: null },
    ],
  },
] as unknown as ProductOption[];

const small = variant({ id: 'vs', sku: 'TEE-S', optionValueIds: ['s'] });
const medium = variant({ id: 'vm', sku: 'TEE-M', optionValueIds: ['m'] });
/** Retired when Large went. Its assignment cascaded away; its memory did not. */
const large = variant({
  id: 'vl',
  sku: 'TEE-L',
  deletedAt: '2026-09-20T00:00:00Z',
  metadata: { latticeCoordinate: [{ option: 'Size', value: 'Large' }] },
});

/** The draft with Large typed back in: a new value, so a local key. */
const withLarge = [
  {
    key: 'size',
    name: 'Size',
    displayType: 'dropdown' as const,
    values: [
      { key: 's', value: 'Small', swatchHex: null },
      { key: 'm', value: 'Medium', swatchHex: null },
      { key: 'local-1', value: 'large', swatchHex: null },
    ],
  },
];

describe('lastCoordinate', () => {
  it('reads the coordinate the server wrote down', () => {
    expect(lastCoordinate(large)).toEqual([{ option: 'Size', value: 'Large' }]);
  });

  it('answers null for a version with nothing remembered, never a guess', () => {
    expect(lastCoordinate(small)).toBeNull();
    expect(
      lastCoordinate(variant({ metadata: { latticeCoordinate: [{ option: 1 }] } }))
    ).toBeNull();
  });
});

describe('putting a removed choice back', () => {
  it('counts the retired version as coming back, not its square as blank', () => {
    const consequence = consequenceOf(withLarge, saved, [small, medium, large]);
    expect(consequence.combinations).toBe(3);
    expect(consequence.keep.map((entry) => entry.variant.sku)).toEqual(['TEE-S', 'TEE-M']);
    expect(consequence.returning.map((entry) => entry.variant.sku)).toEqual(['TEE-L']);
    expect(consequence.blank).toBe(0);
  });

  it('says so before anything about prices', () => {
    const lines = consequenceLines(consequenceOf(withLarge, saved, [small, medium, large]));
    expect(lines.some((line) => line.includes('TEE-L') && line.includes('come'))).toBe(true);
    expect(lines.some((line) => line.includes('no price'))).toBe(false);
  });

  it('still calls a square blank when nothing remembers it', () => {
    const consequence = consequenceOf(withLarge, saved, [small, medium]);
    expect(consequence.returning).toEqual([]);
    expect(consequence.blank).toBe(1);
  });

  it('does not bring back a version whose remembered place is not on the grid', () => {
    const extraLarge = variant({
      id: 'vxl',
      sku: 'TEE-XL',
      deletedAt: '2026-09-20T00:00:00Z',
      metadata: { latticeCoordinate: [{ option: 'Size', value: 'Extra large' }] },
    });
    const consequence = consequenceOf(withLarge, saved, [small, medium, extraLarge]);
    expect(consequence.returning).toEqual([]);
    expect(consequence.blank).toBe(1);
  });
});

describe('a retired version still on its square', () => {
  /** Retired, but Medium was never removed, so it still sits there. */
  const retiredMedium = variant({
    id: 'vm2',
    sku: 'TEE-M-OLD',
    optionValueIds: ['m'],
    deletedAt: '2026-09-20T00:00:00Z',
  });

  it('holds its square without being announced as coming back', () => {
    const consequence = consequenceOf(withLarge, saved, [small, retiredMedium]);
    expect(consequence.returning).toEqual([]);
    // Small is kept, Medium is held by the retired one, Large is truly blank.
    expect(consequence.blank).toBe(1);
  });

  // The server puts a retired version back only by the words it remembered, so
  // on its own a rename leaves this one on no square at all. Renaming "Clay" to
  // "Clay." on a real product stranded both of its stopped versions while the
  // summary said they came back. The fix is that the SAVE places it, by identity.
  it('follows a rename, and the save puts it on the renamed square', () => {
    const renamed = [
      {
        ...withLarge[0]!,
        values: [
          { key: 's', value: 'Small', swatchHex: null },
          { key: 'm', value: 'Mid', swatchHex: null },
        ],
      },
    ];
    const consequence = consequenceOf(renamed, saved, [small, retiredMedium]);
    expect(consequence.blank).toBe(0);
    expect(consequence.returning).toEqual([]);
    expect(consequence.held.map((entry) => entry.coordinate)).toEqual([
      [{ option: 'Size', value: 'Mid' }],
    ]);
    const plan = planOf(renamed, consequence);
    expect(plan.place).toContainEqual({
      variantId: 'vm2',
      coordinate: [{ option: 'Size', value: 'Mid' }],
    });
    expect(plan.retire).not.toContain('vm2');
  });

  it('is placed by the save when nothing about it changes, too', () => {
    const consequence = consequenceOf(withLarge, saved, [small, retiredMedium]);
    expect(planOf(withLarge, consequence).place.map((entry) => entry.variantId)).toContain('vm2');
  });
});

describe('a version coming back by what the server remembered', () => {
  it('is placed by the save as well, so the summary does not rest on the server alone', () => {
    const consequence = consequenceOf(withLarge, saved, [small, medium, large]);
    expect(planOf(withLarge, consequence).place).toContainEqual({
      variantId: 'vl',
      coordinate: [{ option: 'Size', value: 'large' }],
    });
  });
});

describe('the words agree with the count', () => {
  it('says "keep their" for several and "keeps its" for one', () => {
    const several = consequenceLines(consequenceOf(withLarge, saved, [small, medium]));
    expect(several).toContain('2 versions keep their price and code.');
    const one = consequenceLines(consequenceOf(withLarge, saved, [small]));
    expect(one).toContain('1 version keeps its price and code.');
  });

  it('says "lose their place and stop" for several', () => {
    const onlySmall = [
      { ...withLarge[0]!, values: [{ key: 's', value: 'Small', swatchHex: null }] },
    ];
    const lines = consequenceLines(
      consequenceOf(onlySmall, saved, [
        small,
        medium,
        variant({ id: 'vm3', sku: 'TEE-M2', optionValueIds: ['m'] }),
      ])
    );
    expect(
      lines.some((line) => line.startsWith('2 versions lose their place and stop being sold'))
    ).toBe(true);
  });
});
