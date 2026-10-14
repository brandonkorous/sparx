// What "Give the money back" starts from (sparx persona issue 231).
//
// Brynn O'Hara-Løvdal sent back one of two injectors from O-000033. She paid
// $600.00 and $43.50 of Utah tax for it, and the refund was filled in as $600.00.

import { describe, expect, it } from 'vitest';

import { refundFigures } from './return-refund-figures';
import { paidBackNote } from './return-refund-words';
import type { Order } from './data';
import type { ReturnDetail } from './returns-data';

const injectorLine = {
  id: 'oi-injectors',
  quantity: 2,
  unitPrice: 600,
  coreCharge: 150,
  coresReturned: 0,
  coresKept: 0,
  quantityRefunded: 0,
} as unknown as NonNullable<Order['items']>[number];

const order = { items: [injectorLine] } as unknown as Order;

function detailWith(item: Record<string, unknown>): ReturnDetail {
  return {
    items: [{ orderItemId: 'oi-injectors', quantity: 1, approvedQuantity: 1, ...item }],
  } as unknown as ReturnDetail;
}

describe('refundFigures', () => {
  it('starts from what they paid, the sales tax included', () => {
    const figures = refundFigures(
      detailWith({ paidGoodsCents: 60_000, paidTaxCents: 4_350 }),
      order
    );
    expect(figures).toEqual({ suggestedCents: 64_350, taxCents: 4_350, coreBackCents: 15_000 });
  });

  it('falls back to the price each when the server sent no figures', () => {
    expect(refundFigures(detailWith({}), order).suggestedCents).toBe(60_000);
  });

  it('is nothing when the order is not known', () => {
    expect(refundFigures(detailWith({}), undefined)).toEqual({
      suggestedCents: 0,
      taxCents: 0,
      coreBackCents: 0,
    });
  });
});

describe('paidBackNote', () => {
  it('says the tax is in the figure', () => {
    expect(paidBackNote(4_350, 'USD')).toBe(
      'That is what they paid for it, with $43.50 of sales tax.'
    );
  });

  it('says nothing when no tax was paid', () => {
    expect(paidBackNote(0, 'USD')).toBeNull();
  });
});
