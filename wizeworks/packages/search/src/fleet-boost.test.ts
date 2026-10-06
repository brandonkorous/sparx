// Putting the parts that fit a buyer's fleet first, and "parts that fit Unit 12"
// (sparx persona issue 086).
//
// The boost must ORDER, never hide: a buyer browsing for something that fits none
// of their vehicles still has to find it. The restriction is the opposite and must
// never widen: "parts that fit Unit 12" with nothing fitting is an empty page, not
// the whole shop under a heading that says it is Unit 12's parts.

import { describe, expect, it } from 'vitest';

import { buildProductSearchParams } from './search';

const T = 'tenant-1';
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

describe('the fleet boost', () => {
  it('ranks the fitting parts first without filtering anything out', () => {
    const p = buildProductSearchParams({ tenantId: T, boostProductIds: [A, B] });
    expect(p.sort_by).toBe(
      `_eval(product_id:[\`${A}\`,\`${B}\`]):desc,_text_match:desc,best_seller_rank:asc`
    );
    expect(p.filter_by).not.toContain('product_id');
  });

  it('keeps the chosen sort behind it, within the three fields Typesense allows', () => {
    const p = buildProductSearchParams({
      tenantId: T,
      sortBy: 'price_min_cents:asc',
      boostProductIds: [A],
    });
    expect(p.sort_by).toBe(`_eval(product_id:[\`${A}\`]):desc,price_min_cents:asc`);
    expect(String(p.sort_by).split(/,(?![^[]*\])/).length).toBeLessThanOrEqual(3);
  });

  it('leaves the sort alone when nothing fits', () => {
    const p = buildProductSearchParams({ tenantId: T, boostProductIds: [] });
    expect(p.sort_by).toBe('_text_match:desc,best_seller_rank:asc,updated_at:desc');
  });
});

describe('parts that fit one vehicle', () => {
  it('restricts to exactly those parts', () => {
    const p = buildProductSearchParams({ tenantId: T, onlyProductIds: [A] });
    expect(p.filter_by).toContain(`product_id:=[\`${A}\`]`);
  });

  it('matches nothing, rather than everything, when nothing fits', () => {
    const p = buildProductSearchParams({ tenantId: T, onlyProductIds: [] });
    expect(p.filter_by).toContain('product_id:=[`00000000-0000-0000-0000-000000000000`]');
  });
});
