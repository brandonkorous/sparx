// Every version the Options summary gives a square, the save must PLACE.
//
// The server rebuilds the whole grid on a save and puts a stopped version back
// only by the WORDS it remembered (lattice-memory.ts). So renaming a value that
// held stopped versions left them on no square at all, while this summary told
// the owner they "come back" (issue 305, re-driven on sparx by renaming "Clay").
// The save now places them itself, by identity, through assign-options, which
// accepts a stopped version. The sparx twin is product-options-returning.test.ts.

import { describe, expect, it } from 'vitest';

import type { OptionDraft } from './product-options-draft';
import { consequenceOf, planOf } from './product-options-plan';
import { consequenceLines } from './product-options-words';
import type { ProductOption, Variant } from './products-data';

const variant = (over: Partial<Variant>): Variant =>
  ({
    id: 'v',
    sku: 'SKU',
    priceCents: 4200,
    currency: 'USD',
    isDefault: false,
    optionValueIds: [],
    metadata: {},
    deletedAt: null,
    ...over,
  }) as unknown as Variant;

/** Size is Small and Medium today. */
const saved = [
  {
    id: 'size',
    name: 'Size',
    displayType: 'dropdown',
    position: 0,
    values: [
      { id: 's', value: 'Small', position: 0, swatchHex: null },
      { id: 'm', value: 'Medium', position: 1, swatchHex: null },
    ],
  },
] as unknown as ProductOption[];

const draftOf = (values: { key: string; value: string }[]): OptionDraft[] => [
  {
    key: 'size',
    name: 'Size',
    displayType: 'dropdown',
    values: values.map((value) => ({ ...value, swatchHex: null })),
  },
];

const small = variant({ id: 'vs', sku: 'TEE-S', optionValueIds: ['s'] });
const medium = variant({ id: 'vm', sku: 'TEE-M', optionValueIds: ['m'] });
const stoppedMedium = variant({
  id: 'vm-old',
  sku: 'TEE-M-OLD',
  optionValueIds: ['m'],
  deletedAt: '2026-09-20T00:00:00Z',
});

describe('a stopped version on a renamed value', () => {
  const renamed = draftOf([
    { key: 's', value: 'Small' },
    { key: 'm', value: 'Mid' },
  ]);

  it('follows the rename, is not announced, and holds its square', () => {
    const consequence = consequenceOf(renamed, saved, [small, stoppedMedium]);
    expect(consequence.returning).toEqual([]);
    expect(consequence.held.map((entry) => entry.coordinate)).toEqual([
      [{ option: 'Size', value: 'Mid' }],
    ]);
    expect(consequence.blank).toBe(0);
  });

  it('is placed by the save on the renamed square', () => {
    const consequence = consequenceOf(renamed, saved, [small, stoppedMedium]);
    expect(planOf(renamed, consequence).place).toContainEqual({
      variantId: 'vm-old',
      coordinate: [{ option: 'Size', value: 'Mid' }],
    });
  });
});

describe('a stopped version coming back by what the server remembered', () => {
  const large = variant({
    id: 'vl',
    sku: 'TEE-L',
    deletedAt: '2026-09-20T00:00:00Z',
    metadata: { latticeCoordinate: [{ option: 'Size', value: 'Large' }] },
  });
  const withLarge = draftOf([
    { key: 's', value: 'Small' },
    { key: 'm', value: 'Medium' },
    { key: 'local-1', value: 'large' },
  ]);

  it('is announced as coming back, and placed by the save as well', () => {
    const consequence = consequenceOf(withLarge, saved, [small, medium, large]);
    expect(consequence.returning.map((entry) => entry.variant.sku)).toEqual(['TEE-L']);
    expect(planOf(withLarge, consequence).place.map((entry) => entry.variantId)).toContain('vl');
  });
});

describe('the words agree with the count', () => {
  const same = draftOf([
    { key: 's', value: 'Small' },
    { key: 'm', value: 'Medium' },
  ]);

  it('says "keep their" for several and "keeps its" for one', () => {
    expect(consequenceLines(consequenceOf(same, saved, [small, medium]))).toContain(
      '2 versions keep their price and code.'
    );
    expect(consequenceLines(consequenceOf(same, saved, [small]))).toContain(
      '1 version keeps its price and code.'
    );
  });
});
