import { describe, expect, it } from 'vitest';

import type { CheckoutSession } from './checkout-client';
import { contactDone, resumedAddress, resumedContact } from './checkout-resume';

// Sparx persona issue 334: a reload opened checkout empty, while the session the
// server handed back still held her name, email and address.
const session = (patch: Partial<CheckoutSession>): CheckoutSession =>
  ({ sessionId: 's', cartId: 'c', step: 'shipping', currency: 'USD', ...patch }) as CheckoutSession;

describe('putting a checkout back after a reload', () => {
  it('gives back the contact she typed', () => {
    expect(
      resumedContact(session({ customerName: 'Marisol Vega', customerEmail: 'm@example.com' }))
    ).toEqual({ name: 'Marisol Vega', email: 'm@example.com', phone: '' });
  });

  it('gives back the address she typed, as the form’s fields', () => {
    expect(
      resumedAddress(
        session({
          customerName: 'Marisol Vega',
          shippingAddress: {
            recipientName: 'Marisol Vega',
            line1: '455 W 1300 S',
            city: 'Orem',
            region: 'UT',
            postalCode: '84058',
            country: 'US',
          },
        })
      )
    ).toEqual({
      name: 'Marisol Vega',
      line1: '455 W 1300 S',
      city: 'Orem',
      region: 'UT',
      postalCode: '84058',
      country: 'US',
    });
  });

  it('gives back no address before one was given', () => {
    expect(resumedAddress(session({}))).toBeNull();
  });
});

describe('where a reload opens checkout', () => {
  it('opens past the contact step she finished', () => {
    expect(
      contactDone(session({ customerName: 'Rory Banks', customerEmail: 'r@example.com' }))
    ).toBe(true);
  });

  it('keeps a signed-in shopper on the contact step she has not seen', () => {
    // A signed-in session opens with her email alone.
    expect(contactDone(session({ customerEmail: 'r@example.com' }))).toBe(false);
  });
});
