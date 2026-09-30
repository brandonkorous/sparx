// Where a generated product code comes from.
//
// The sparx twin of the Piggles console's product-variants/slots.test.ts. It is
// here because a rule fixed in one console and left in the other is how four
// already-fixed defects came to still be live in the second one (act 88).
//
// This file exists because it came from the wrong place. The generator read the
// product's WEB ADDRESS, so an owner who typed `ASH-OVERSHIRT` into "Product
// code" and then pressed "Give them all the same price" got fourteen codes
// reading `THE-ASH-OVER-…` beside the one she wrote. One shirt, two naming
// schemes, and the odd one out was the only one she chose (issue 172).
//
// The address was also cut to twelve characters, which is the only thing that
// let two different products generate the same code. A shop with twelve
// products all named "Brushed Terry <something>" had every one of them fall to
// the stem `SAMPLE-BRUSH`, so filling in the second one would ask the server for
// a code the first already held and stop partway.

import { describe, expect, it } from 'vitest';

import { claimantOf, gridOf, skuStem, slotsOf, suggestSlotSku } from './product-variant-slots';
import type { Product, ProductOption, Variant } from './products-data';

const size: ProductOption = {
  id: 'opt-size',
  name: 'Size',
  position: 0,
  values: [
    { id: 'xs', value: 'XS', position: 0 },
    { id: 's', value: 'S', position: 1 },
  ],
} as unknown as ProductOption;

const color: ProductOption = {
  id: 'opt-color',
  name: 'Color',
  position: 1,
  values: [
    { id: 'clay', value: 'Clay', position: 0 },
    { id: 'slate', value: 'Slate', position: 1 },
  ],
} as unknown as ProductOption;

const product = (over: Partial<Product> = {}): Product =>
  ({ id: 'p1', title: 'The Ash Overshirt', handle: 'the-ash-overshirt', ...over }) as Product;

const variant = (over: Partial<Variant> = {}): Variant =>
  ({
    id: 'v1',
    productId: 'p1',
    sku: 'ASH-OVERSHIRT',
    isDefault: true,
    optionValueIds: [],
    deletedAt: null,
    ...over,
  }) as unknown as Variant;

describe('skuStem', () => {
  it('takes the code the owner typed, not the name she never put on a label', () => {
    const live = [variant({ optionValueIds: ['xs', 'clay'] })];
    const slots = slotsOf([size, color], live);
    expect(skuStem(product(), slots, live)).toBe('ASH-OVERSHIRT');
  });

  it('falls back to the web address when the product has no version yet', () => {
    expect(skuStem(product(), [], [])).toBe('THE-ASH-OVERSHIRT');
  });

  it('does not cut the stem short, so two near-named products stay apart', () => {
    const dress = product({ title: 'The Linen Shirtdress', handle: 'the-linen-shirtdress' });
    const shirt = product({ title: 'The Linen Shirt', handle: 'the-linen-shirt' });
    expect(skuStem(dress, [], [])).not.toBe(skuStem(shirt, [], []));
  });

  it('takes the anchor version’s own choices back off, so codes cannot compound', () => {
    // Anyone may make a generated version the one shown first. Hanging the next
    // code off it whole would give ASH-OVERSHIRT-XS-CLAY-S-SLATE.
    const live = [variant({ sku: 'ASH-OVERSHIRT-XS-CLAY', optionValueIds: ['xs', 'clay'] })];
    const slots = slotsOf([size, color], live);
    expect(skuStem(product(), slots, live)).toBe('ASH-OVERSHIRT');
  });
});

describe('suggestSlotSku', () => {
  it('hangs the choices off the stem in the order they are shown', () => {
    const slots = slotsOf([size, color], []);
    const slate = slots.find((slot) => slot.key === 's|slate');
    expect(slate).toBeDefined();
    expect(suggestSlotSku('ASH-OVERSHIRT', slate!, new Set())).toBe('ASH-OVERSHIRT-S-SLATE');
  });

  it('steps past a code that is already held rather than offering it again', () => {
    const slots = slotsOf([size, color], []);
    const slate = slots.find((slot) => slot.key === 's|slate');
    expect(suggestSlotSku('ASH-OVERSHIRT', slate!, new Set(['ash-overshirt-s-slate']))).toBe(
      'ASH-OVERSHIRT-S-SLATE-2'
    );
  });
});

// A square whose version was STOPPED is not an empty square (issue 305). Read as
// empty, the grid offered "Set a price" on it and the bulk fill minted "-2"
// codes with no stock beside the real, stopped versions holding every garment.
describe('slotsOf, with stopped versions', () => {
  const stopped = (over: Partial<Variant>) =>
    variant({ isDefault: false, deletedAt: '2026-08-28T00:00:00.000Z', ...over });

  it('puts a stopped version in its square instead of calling the square empty', () => {
    const clay = stopped({
      id: 'xs-clay',
      sku: 'ASH-OVERSHIRT-XS-CLAY',
      optionValueIds: ['xs', 'clay'],
    });
    const slots = slotsOf([size, color], [], [clay]);
    const square = slots.find((slot) => slot.key === 'xs|clay');
    expect(square?.variant).toBeNull();
    expect(square?.retired.map((v) => v.id)).toEqual(['xs-clay']);
    // And only there.
    expect(slots.filter((slot) => slot.retired.length > 0)).toHaveLength(1);
  });

  it('lists EVERY stopped version on a shared square, not whichever came first', () => {
    // What repairing a damaged shop produces: the real version back beside the
    // "-2" that displaced it. Showing one let array order pick her stock count.
    const real = stopped({
      id: 'real',
      sku: 'ASH-OVERSHIRT-XS-CLAY',
      optionValueIds: ['clay', 'xs'],
    });
    const copy = stopped({
      id: 'copy',
      sku: 'ASH-OVERSHIRT-XS-CLAY-2',
      optionValueIds: ['xs', 'clay'],
    });
    const square = slotsOf([size, color], [], [real, copy]).find((slot) => slot.key === 'xs|clay');
    expect(square?.retired.map((v) => v.id)).toEqual(['real', 'copy']);
  });

  it('keeps a stopped version in its square when something else is on sale there', () => {
    // Replacing a line is ordinary. The old one still sits on its combination,
    // and calling it placeless sent people to fix a version nothing was wrong with.
    const now = variant({ id: 'now', sku: 'NEW', optionValueIds: ['s', 'slate'] });
    const then = stopped({ id: 'then', sku: 'OLD', optionValueIds: ['s', 'slate'] });
    const square = slotsOf([size, color], [now], [then]).find((slot) => slot.key === 's|slate');
    expect(square?.variant?.id).toBe('now');
    expect(square?.retired.map((v) => v.id)).toEqual(['then']);
  });
});

describe('claimantOf', () => {
  it('names the placeless version that already carries the code of a square', () => {
    // Without this the square is offered ASH-OVERSHIRT-XS-CLAY-2, a new version
    // with no stock, beside the real one nothing could reach.
    const lost = variant({ id: 'lost', sku: 'ash-overshirt-xs-clay', optionValueIds: [] });
    const square = slotsOf([size, color], []).find((slot) => slot.key === 'xs|clay');
    expect(claimantOf('ASH-OVERSHIRT', square!, [lost])?.id).toBe('lost');
    expect(suggestSlotSku('ASH-OVERSHIRT', square!, new Set(['ash-overshirt-xs-clay']))).toBe(
      'ASH-OVERSHIRT-XS-CLAY-2'
    );
  });

  it('names nobody when no placeless version carries the code', () => {
    const other = variant({ id: 'other', sku: 'ASH-OVERSHIRT-S-SLATE', optionValueIds: [] });
    const square = slotsOf([size, color], []).find((slot) => slot.key === 'xs|clay');
    expect(claimantOf('ASH-OVERSHIRT', square!, [other])).toBeNull();
    expect(claimantOf('ASH-OVERSHIRT', square!, [])).toBeNull();
  });
});

// What the bulk fill is handed. Handing it a square whose version was only
// stopped is the exact path that put five stockless "-2" codes on sale.
describe('gridOf', () => {
  const stopped = (over: Partial<Variant>) =>
    variant({ isDefault: false, deletedAt: '2026-08-28T00:00:00.000Z', ...over });
  const keys = (slots: { key: string }[]) => slots.map((slot) => slot.key).sort();

  it('never offers a square holding a stopped version to the bulk fill', () => {
    const live = [variant({ id: 'on', sku: 'ASH-OVERSHIRT', optionValueIds: ['xs', 'slate'] })];
    const retired = [
      stopped({ id: 'off', sku: 'ASH-OVERSHIRT-XS-CLAY', optionValueIds: ['xs', 'clay'] }),
    ];
    const slots = slotsOf([size, color], live, retired);
    const grid = gridOf(slots, true, live, retired, 'ASH-OVERSHIRT');
    expect(keys(grid.empty)).toEqual(['s|clay', 's|slate']);
    expect(keys(grid.fillable)).toEqual(['s|clay', 's|slate']);
    // It is still somewhere a lost version may be put, and says so in the picker.
    expect(keys(grid.free)).toEqual(['s|clay', 's|slate', 'xs|clay']);
    expect(grid.homeless).toEqual([]);
  });

  it('holds back a square whose code a lost version carries, and names that version', () => {
    const live = [variant({ id: 'on', sku: 'ASH-OVERSHIRT', optionValueIds: ['xs', 'slate'] })];
    const lost = stopped({ id: 'lost', sku: 'ASH-OVERSHIRT-S-CLAY', optionValueIds: [] });
    const slots = slotsOf([size, color], live, [lost]);
    const grid = gridOf(slots, true, live, [lost], 'ASH-OVERSHIRT');
    expect(grid.homeless.map((v) => v.id)).toEqual(['lost']);
    expect(grid.claimants.get('s|clay')?.id).toBe('lost');
    expect(keys(grid.fillable)).toEqual(['s|slate', 'xs|clay']);
  });

  it('files a replaced version as resting, not as lost', () => {
    const live = [variant({ id: 'now', sku: 'NEW', optionValueIds: ['s', 'slate'] })];
    const retired = [stopped({ id: 'then', sku: 'OLD', optionValueIds: ['s', 'slate'] })];
    const grid = gridOf(slotsOf([size, color], live, retired), true, live, retired, 'NEW');
    expect(grid.resting.map((v) => v.id)).toEqual(['then']);
    expect(grid.homeless).toEqual([]);
  });
});
