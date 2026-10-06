import { describe, expect, it } from 'vitest';

import { shippingState } from './data';
import type { Order } from './data';

function order(status: string, collected: boolean, fulfilledAt: string | null = null): Order {
  return {
    status,
    fulfilledAt,
    metadata: collected ? { shippingRateRef: 'collection:in-person' } : {},
  } as unknown as Order;
}

/**
 * "REFUNDED" IN THE DELIVERY COLUMN, BESIDE "REFUNDED" IN THE PAYMENT COLUMN.
 *
 * Sell -> Orders, 2026-09-17. O-000004 carried the same word twice, so one of
 * the two columns answered nothing. The Delivery column's question is whether
 * the goods have gone, and the two answers need opposite things from an owner:
 * goods that went are with a customer who has had their money back; goods that
 * never went are still on her shelf.
 *
 * Measured the same day: 9 refunded orders on the platform, 8 of which never
 * shipped — and `fulfilledAt` agreed with the shipment records on all 9.
 */
describe('a refunded order says whether the goods went', () => {
  it('says never sent when nothing ever left', () => {
    const state = shippingState(order('refunded', false, null));
    expect(state.label).toBe('Never sent');
    expect(state.detail).toMatch(/still on your shelf/i);
  });

  it('says it went when it went', () => {
    const state = shippingState(order('refunded', false, '2026-09-01T10:00:00Z'));
    expect(state.label).toBe('Sent, then refunded');
    expect(state.detail).toMatch(/with the customer/i);
  });

  it('uses the collection words for a collection', () => {
    expect(shippingState(order('refunded', true, null)).label).toBe('Never collected');
    expect(shippingState(order('refunded', true, '2026-09-01T10:00:00Z')).label).toBe(
      'Collected, then refunded'
    );
  });

  it('never repeats the payment column word', () => {
    // The whole defect in one line: both columns said "Refunded".
    for (const collected of [true, false]) {
      for (const went of [null, '2026-09-01T10:00:00Z']) {
        expect(shippingState(order('refunded', collected, went)).label).not.toBe('Refunded');
      }
    }
  });

  it('warns only about the half that is out in the world', () => {
    // Goods on her own shelf need no color; goods with a customer who has been
    // refunded are the ones to chase.
    expect(shippingState(order('refunded', false, null)).tone).toBe('neutral');
    expect(shippingState(order('refunded', false, '2026-09-01T10:00:00Z')).tone).toBe('warning');
  });

  it('never says a collection travelled', () => {
    for (const went of [null, '2026-09-01T10:00:00Z']) {
      expect(shippingState(order('refunded', true, went)).detail).not.toMatch(
        /carrier|sent to|in transit/i
      );
    }
  });
});

// Sparx persona issue 085: an order held for sign-off read "To send", asking
// somebody to pack an order nobody had approved.
describe('an order waiting for sign-off', () => {
  it('is not to be sent yet, and says why', () => {
    const state = shippingState(order('pending_approval', false));
    expect(state.label).toBe('Not to send yet');
    expect(state.detail).toMatch(/Approvals shows who it waits on/);
  });
});
