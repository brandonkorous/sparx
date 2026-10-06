// Approving placed the order and took its stock, and the shelves were short:
// the business now owes the customer goods (sparx persona issue 087).
import { describe, expect, it } from 'vitest';
import { approvedStockNotice, type ApprovedStockLine } from './approved-stock';
import { WASATCH } from './fixtures';

const kit = (partial: Partial<ApprovedStockLine> = {}): ApprovedStockLine => ({
  variantId: 'v-kit',
  sku: 'SS-CP4',
  name: 'S&S CP4 kit',
  ordered: 3,
  notFree: 2,
  owed: 2,
  ...partial,
});
const NOTE =
  'S&S CP4 kit: 2 of 3 were not in stock, so they are owed to the customer and will go out when more arrive.';

describe('approvedStockNotice', () => {
  it('warns that the customer is owed goods, and points to the Waiting list', () => {
    const notice = approvedStockNotice(
      { orderNumber: 'O-000014', status: 'placed', stock: { lines: [kit()], note: NOTE } },
      WASATCH
    );
    expect(notice).toEqual({
      orderNumber: 'O-000014',
      title: 'Order O-000014 is placed, but not all of it is in stock',
      detail: `${NOTE} What ${WASATCH} is owed is on the Waiting list, which keeps track of it until more arrives.`,
      owed: true,
    });
  });

  it('names another order as the short one when nothing is owed to this customer', () => {
    const note = 'S&S CP4 kit: 2 were already set aside for another order, which is now short.';
    const notice = approvedStockNotice(
      {
        orderNumber: 'O-000014',
        status: 'placed',
        stock: { lines: [kit({ owed: 0 })], note },
      },
      WASATCH
    );
    expect(notice?.title).toBe('Order O-000014 is placed, and another order is now short');
    expect(notice?.detail).toBe(note);
    expect(notice?.owed).toBe(false);
  });
});

describe('approvedStockNotice', () => {
  it('says nothing extra when every unit came from stock', () => {
    expect(
      approvedStockNotice({ orderNumber: 'O-000014', status: 'placed', stock: null }, WASATCH)
    ).toBeNull();
    expect(approvedStockNotice({ orderNumber: 'O-000014', status: 'placed' }, WASATCH)).toBeNull();
  });

  it('says nothing about stock while the order still waits for somebody', () => {
    expect(
      approvedStockNotice(
        {
          orderNumber: 'O-000014',
          status: 'pending_approval',
          stock: { lines: [kit()], note: NOTE },
        },
        WASATCH
      )
    ).toBeNull();
  });
});
