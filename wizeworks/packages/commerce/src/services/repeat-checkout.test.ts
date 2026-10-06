import { describe, expect, it } from 'vitest';

import type { TxClient } from '@wizeworks/db';

import { lineRepeat } from './cart-service';
import { repeatOwner } from './checkout-service';
import { readLineRepeat } from './repeat-start-service';

// A shopper's repeat delivery, from basket to repeat order (issue 739).
//
// The three rules a refactor could quietly undo: a repeat needs a signed-in
// shopper who owns the basket, it needs somewhere to deliver, and an order line
// that has already started its repeat order must never start a second one.

function fakeTx(opts: {
  repeating: number;
  cartCustomerId?: string | null;
  earlierCustomerRef?: string | null;
}): TxClient {
  return {
    cartItem: { count: () => Promise.resolve(opts.repeating) },
    cart: { findFirst: () => Promise.resolve({ customerId: opts.cartCustomerId ?? null }) },
    customerPaymentMethod: {
      findFirst: () =>
        Promise.resolve(opts.earlierCustomerRef ? { customerRef: opts.earlierCustomerRef } : null),
    },
  } as unknown as TxClient;
}

const DELIVERED = {
  cartId: 'cart-1',
  customerId: null,
  customerEmail: 'devi@juniperrow.example',
  shippingAddress: { line1: '14 Larch Street' },
};

describe('repeatOwner', () => {
  it('asks nothing of a basket with no repeat in it, signed in or not', async () => {
    await expect(repeatOwner(fakeTx({ repeating: 0 }), DELIVERED, null)).resolves.toBeNull();
  });

  it('refuses a repeat without a signed-in shopper, and says why', async () => {
    await expect(repeatOwner(fakeTx({ repeating: 1 }), DELIVERED, null)).rejects.toThrow(
      /Sign in to set up a repeat delivery/
    );
  });

  it('refuses a repeat that would be collected, because it has nowhere to go', async () => {
    await expect(
      repeatOwner(fakeTx({ repeating: 1 }), { ...DELIVERED, shippingAddress: null }, 'cust-1')
    ).rejects.toThrow(/needs a delivery address/);
  });

  it('refuses when the signed-in shopper is not the one who owns the basket', async () => {
    await expect(
      repeatOwner(fakeTx({ repeating: 1, cartCustomerId: 'someone-else' }), DELIVERED, 'cust-1')
    ).rejects.toThrow(/belongs to a different account/);
  });

  it('keeps the card for the signed-in shopper, on the gateway customer they already have', async () => {
    await expect(
      repeatOwner(
        fakeTx({ repeating: 2, cartCustomerId: 'cust-1', earlierCustomerRef: 'cus_123' }),
        DELIVERED,
        'cust-1'
      )
    ).resolves.toEqual({
      customerId: 'cust-1',
      customerRef: 'cus_123',
      email: 'devi@juniperrow.example',
    });
  });
});

describe('lineRepeat', () => {
  it('reads a whole cadence, and nothing from half of one', () => {
    expect(lineRepeat({ repeatIntervalUnit: 'month', repeatIntervalCount: 1 })).toEqual({
      intervalUnit: 'month',
      intervalCount: 1,
    });
    expect(lineRepeat({ repeatIntervalUnit: null, repeatIntervalCount: null })).toBeNull();
    expect(lineRepeat({ repeatIntervalUnit: 'month', repeatIntervalCount: null })).toBeNull();
  });
});

describe('readLineRepeat', () => {
  it('reads what checkout wrote on the order line', () => {
    expect(readLineRepeat({ repeat: { intervalUnit: 'week', intervalCount: 2 } })).toEqual({
      intervalUnit: 'week',
      intervalCount: 2,
    });
  });

  // The guard against a second repeat order: the starter skips any line whose
  // repeat already names one. Dropping `subscriptionId` here would start a
  // duplicate on every pass.
  it('carries the repeat order a line already started', () => {
    expect(
      readLineRepeat({
        repeat: { intervalUnit: 'month', intervalCount: 1, subscriptionId: 'sub-1' },
      })
    ).toEqual({ intervalUnit: 'month', intervalCount: 1, subscriptionId: 'sub-1' });
  });

  it('ignores a line that was given up on, and anything that is not a repeat', () => {
    expect(
      readLineRepeat({
        repeat: { intervalUnit: 'month', intervalCount: 1, skipped: 'no_delivery_address' },
      })
    ).toBeNull();
    expect(readLineRepeat({})).toBeNull();
    expect(readLineRepeat(null)).toBeNull();
    expect(readLineRepeat({ repeat: { intervalUnit: 'day', intervalCount: 1 } })).toBeNull();
  });
});
