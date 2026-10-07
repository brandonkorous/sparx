// A company page asks for its company's orders.
//
// MEASURED 2026-10-06 on Gillett: Wasatch Front's company page showed its people,
// deals and invoices, and no orders at all; the wholesale page showed orders and
// no deals, and neither linked to the other. The company page now lists every
// order placed by anyone who works there (sparx persona issue 112).

import { describe, expect, it } from 'vitest';

import { orderListParams } from './order-queries';

const base = { sortBy: 'placedAt' as const, order: 'desc' as const, take: 20, skip: 0 };

describe('orderListParams', () => {
  it('sends a company as the trade account the server filters on', () => {
    expect(orderListParams({ ...base, companyId: '8aa59a36-acc9-455f-b0ba-41c0b66292b9' })).toEqual(
      {
        b2b_account_id: '8aa59a36-acc9-455f-b0ba-41c0b66292b9',
        sort_by: 'placedAt',
        order: 'desc',
        take: 20,
        skip: 0,
      }
    );
  });

  it('sends nothing extra when no company is asked for', () => {
    expect(orderListParams(base)).toEqual({
      sort_by: 'placedAt',
      order: 'desc',
      take: 20,
      skip: 0,
    });
  });
});
