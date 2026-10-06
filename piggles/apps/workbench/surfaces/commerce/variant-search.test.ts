// The browser's half of the variant search (sparx persona P01, issue 069).
//
// The server answers the search now; this rule narrows the rows already in hand
// while that answer is on its way, and floats the product a pick is about. It
// must agree with the server word for word, or the list would say one thing
// while typing and another a quarter second later.

import { describe, expect, it } from 'vitest';
import { pickerRows, variantMatches } from './variant-search';

function v(input: {
  id: string;
  productId: string;
  productTitle: string;
  sku: string;
  title?: string | null;
  options?: string[];
}) {
  return {
    id: input.id,
    productId: input.productId,
    productTitle: input.productTitle,
    sku: input.sku,
    title: input.title ?? null,
    options: (input.options ?? []).map((value) => ({ name: 'Option', value })),
  };
}

const S1 = v({
  id: 's1',
  productId: 'inj',
  productTitle: 'Rebuilt fuel injector',
  sku: 'INJ-67-S1',
  options: ['6.7L', 'Stage 1'],
});
const S2 = v({
  id: 's2',
  productId: 'inj',
  productTitle: 'Rebuilt fuel injector',
  sku: 'INJ-67-S2',
  options: ['6.7L', 'Stage 2'],
});
const FILTER = v({
  id: 'f',
  productId: 'flt',
  productTitle: 'Oil filter',
  sku: 'FLT-0042',
  title: 'Heavy duty',
});
const WIPER = v({ id: 'w', productId: 'wip', productTitle: 'Wiper blade', sku: 'WB-22' });

describe('variantMatches', () => {
  it('finds a version by an option value, the way a person says which one', () => {
    expect(variantMatches(S2, 'stage 2')).toBe(true);
    expect(variantMatches(S1, 'stage 2')).toBe(false);
  });

  it('lets each word land somewhere different, in any order and any case', () => {
    expect(variantMatches(S1, 'injector 6.7')).toBe(true);
    expect(variantMatches(S1, '6.7 INJECTOR')).toBe(true);
  });

  it("finds by the code on the box and by the version's own name", () => {
    expect(variantMatches(FILTER, 'flt-0042')).toBe(true);
    expect(variantMatches(FILTER, 'heavy')).toBe(true);
  });

  it('needs every word to land, so typing more narrows', () => {
    expect(variantMatches(S1, 'injector filter')).toBe(false);
  });

  it('matches everything before anybody types', () => {
    expect(variantMatches(WIPER, '')).toBe(true);
    expect(variantMatches(WIPER, '   ')).toBe(true);
  });
});

describe('pickerRows', () => {
  const none = new Set<string>();

  it('narrows the rows in hand by what is typed now', () => {
    const rows = pickerRows({ found: [S1, S2, FILTER, WIPER], query: 'stage', excluded: none });
    expect(rows.map((r) => r.id)).toEqual(['s1', 's2']);
  });

  it('hides versions already chosen', () => {
    const rows = pickerRows({ found: [S1, S2, FILTER], query: '', excluded: new Set(['s1']) });
    expect(rows.map((r) => r.id)).toEqual(['s2', 'f']);
  });

  it('floats the product a pick is about, even when the window never reached it', () => {
    // The found window is the alphabetical first page: a wiper blade is not in
    // it. Its versions are fetched on their own and still lead the list.
    const rows = pickerRows({
      found: [S1, S2, FILTER],
      preferred: [WIPER],
      preferProductId: 'wip',
      query: '',
      excluded: none,
    });
    expect(rows.map((r) => r.id)).toEqual(['w', 's1', 's2', 'f']);
  });

  it('draws a version once when both lists hold it, and keeps option order', () => {
    const rows = pickerRows({
      found: [FILTER, S1, S2],
      preferred: [S1, S2],
      preferProductId: 'inj',
      query: '',
      excluded: none,
    });
    expect(rows.map((r) => r.id)).toEqual(['s1', 's2', 'f']);
  });

  it("applies the search to the preferred product's versions too", () => {
    const rows = pickerRows({
      found: [FILTER],
      preferred: [S1, S2],
      preferProductId: 'inj',
      query: 'stage 2',
      excluded: none,
    });
    expect(rows.map((r) => r.id)).toEqual(['s2']);
  });

  it('ignores the preferred list when no product is preferred', () => {
    const rows = pickerRows({ found: [FILTER], preferred: [WIPER], query: '', excluded: none });
    expect(rows.map((r) => r.id)).toEqual(['f']);
  });

  it('keeps the box a box', () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      v({ id: String(i), productId: 'p', productTitle: 'Bolt', sku: `B-${String(i)}` })
    );
    expect(pickerRows({ found: many, query: 'bolt', excluded: none })).toHaveLength(40);
    expect(pickerRows({ found: many, query: 'bolt', excluded: none }, 12)).toHaveLength(12);
  });
});
