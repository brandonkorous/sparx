// WHO TO CHASE, AND WHETHER THEY ARE STILL GONE.
//
// A walked-away basket is only worth listing if it says who walked away. Most
// shoppers are not signed in, so the `customer` join is empty on most rows, and
// every one of them read "Guest shopper" while checkout held the name and the
// email they had typed. And a basket won back once and then left again carries
// BOTH stamps; asking `recoveredAt` first filed it as a success in the very tab
// that exists to find the ones still to chase.

import { describe, expect, it } from 'vitest';

import { cartShopperName, cartStateFrom, type CartContact } from './carts-data';

const typed: CartContact = {
  name: 'Mara Quint',
  email: 'mara@example.com',
  phone: null,
  reached: 'shipping',
};

describe('cartShopperName', () => {
  it('names a guest by what they typed into checkout', () => {
    expect(cartShopperName(null, typed)).toBe('Mara Quint');
  });

  it('falls back to their email when they left no name', () => {
    expect(cartShopperName(null, { ...typed, name: null })).toBe('mara@example.com');
  });

  it('prefers the signed-in account when there is one', () => {
    expect(
      cartShopperName(
        { id: 'c', firstName: 'Ada', lastName: 'Byrne', email: null, company: null },
        typed
      )
    ).toBe('Ada Byrne');
  });

  it('says plainly when nobody left anything', () => {
    expect(cartShopperName(null, null)).toBe('Nobody left a name');
  });
});

describe('cartStateFrom', () => {
  it('reads a basket that came back and left again as walked away', () => {
    const state = cartStateFrom({
      abandonedAt: '2026-09-20T10:00:00Z',
      recoveredAt: '2026-09-10T10:00:00Z',
      expiresAt: null,
    });
    expect(state.label).toBe('Walked away');
    expect(state.detail).toContain('came back to this cart once');
  });

  it('reads a basket that came back and stayed as came back', () => {
    const state = cartStateFrom({
      abandonedAt: null,
      recoveredAt: '2026-09-10T10:00:00Z',
      expiresAt: null,
    });
    expect(state.label).toBe('Came back');
  });
});
