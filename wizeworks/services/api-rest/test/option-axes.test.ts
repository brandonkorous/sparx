// The shop-wide option order the storefront's facet panel sorts by.
//
// The defect this exists for: a Size filter that read Small, Medium, Large, Extra
// Small on a shop whose owner had typed XS, S, M, L, XL and whose option rows still
// said so (piggles/docs/personas/issues/342). The order was never missing, it was
// dropped between the database and the panel.

import { describe, expect, it } from 'vitest';

import { mergeOptionAxes } from '../src/lib/option-axes';

let nextProduct = 0;

/** One product's options, terse — the shape the route selects. Each call is a
 *  different product, which is what makes the axis merge meaningful. */
function product(...axes: [string, number, string[]][]) {
  const productId = `p${(nextProduct += 1)}`;
  return axes.map(([name, position, values]) => ({
    productId,
    name,
    position,
    values: values.map((value, i) => ({ value, position: i })),
  }));
}

describe('mergeOptionAxes', () => {
  it('keeps the ladder the shop typed', () => {
    const axes = mergeOptionAxes(product(['Size', 0, ['XS', 'S', 'M', 'L', 'XL']]));
    expect(axes).toEqual([{ name: 'Size', values: ['XS', 'S', 'M', 'L', 'XL'] }]);
  });

  it('orders the axes themselves, not just the values inside them', () => {
    // A shop that put Size first should get Size first, rather than whichever axis the
    // query happened to return — the group order was arbitrary for the same reason the
    // value order was.
    const axes = mergeOptionAxes(product(['Color', 1, ['Ecru']], ['Size', 0, ['S', 'M']]));
    expect(axes.map((a) => a.name)).toEqual(['Size', 'Color']);
  });

  it('merges two products that agree, without duplicating a value', () => {
    const axes = mergeOptionAxes([
      ...product(['Size', 0, ['XS', 'S', 'M']]),
      ...product(['Size', 0, ['XS', 'S', 'M', 'L']]),
    ]);
    expect(axes).toEqual([{ name: 'Size', values: ['XS', 'S', 'M', 'L'] }]);
  });

  it('interleaves two products whose ladders overlap', () => {
    const axes = mergeOptionAxes([
      ...product(['Size', 0, ['XS', 'S', 'M']]),
      ...product(['Size', 0, ['S', 'M', 'L']]),
    ]);
    expect(axes[0]?.values).toEqual(['XS', 'S', 'M', 'L']);
  });

  // THE CASE THAT RULES OUT SCORING A VALUE AND SORTING BY THE SCORE, and the reason
  // this is a topological merge. One item that only comes in the big sizes, beside one
  // that comes in all of them — a shape any real shop has.
  //
  //   lowest declared position → L, XS, XL, S, M
  //   mean declared position   → XS, S, L, M, XL
  //
  // Both wrong, because `L(0)` on the trouser means "this item's smallest", never "the
  // shop's smallest" — a position only has meaning inside the product that set it.
  it('does not let a big-sizes-only product reorder the whole ladder', () => {
    const axes = mergeOptionAxes([
      ...product(['Size', 0, ['L', 'XL']]),
      ...product(['Size', 0, ['XS', 'S', 'M', 'L', 'XL']]),
    ]);
    expect(axes[0]?.values).toEqual(['XS', 'S', 'M', 'L', 'XL']);
  });

  it('emits everything when two products contradict each other', () => {
    // No correct answer exists, and the wrong response is to drop a value: a filter
    // row that vanishes is worse than one in a surprising place.
    const axes = mergeOptionAxes([
      ...product(['Size', 0, ['S', 'M']]),
      ...product(['Size', 0, ['M', 'S']]),
    ]);
    expect([...(axes[0]?.values ?? [])].sort()).toEqual(['M', 'S']);
  });

  it('reads the same however the products come back', () => {
    // The route states no `orderBy`, so this must not depend on row order — otherwise
    // the ladder could change between two identical requests.
    const forward = mergeOptionAxes([
      ...product(['Size', 0, ['XS', 'S', 'M']]),
      ...product(['Size', 0, ['S', 'M', 'L']]),
    ]);
    const backward = mergeOptionAxes([
      ...product(['Size', 0, ['S', 'M', 'L']]),
      ...product(['Size', 0, ['XS', 'S', 'M']]),
    ]);
    expect(backward).toEqual(forward);
  });

  it('never folds two values the search index treats as different', () => {
    // `XS` and `xs` are two tokens in the index, so the panel renders two rows. An
    // order that folded them would name a row that does not exist and leave a real one
    // unordered.
    const axes = mergeOptionAxes(product(['Size', 0, ['XS', 'xs']]));
    expect(axes[0]?.values).toEqual(['XS', 'xs']);
  });

  it('drops what the facet tokens cannot contain', () => {
    // The search projection trims the same way, so a blank name or value is a row the
    // panel can never render — carrying it would order a ghost.
    const axes = mergeOptionAxes([
      { productId: 'x', name: '  ', position: 0, values: [{ value: 'M', position: 0 }] },
      { productId: 'x', name: 'Size', position: 1, values: [{ value: '  ', position: 0 }] },
      ...product(['Color', 2, ['Ecru']]),
    ]);
    expect(axes).toEqual([{ name: 'Color', values: ['Ecru'] }]);
  });

  it('answers nothing for a catalog with no options', () => {
    expect(mergeOptionAxes([])).toEqual([]);
  });
});
