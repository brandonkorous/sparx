// A year filter also matches parts that fit every year (sparx persona issue 125).

import { describe, expect, it } from 'vitest';
import { buildProductSearchParams } from './search';
import { EVERY_FITMENT_YEAR } from './schemas/products';

describe('the year filter', () => {
  it('matches the chosen year or "every year"', () => {
    const p = buildProductSearchParams({ tenantId: 'tenant-1', fitmentYear: 2019 });
    expect(p.filter_by).toContain(`fitment_years:=[${EVERY_FITMENT_YEAR},2019]`);
  });
});
