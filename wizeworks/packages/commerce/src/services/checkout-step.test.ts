// Revisiting an earlier checkout step. See `furthestStep`'s header for the dead
// end these cover: a bakery's customer got a red box reading
// `Cannot move checkout from "shipping" back to "contact"`.

import { describe, expect, it } from 'vitest';
import { furthestStep } from './checkout-service';

describe('furthestStep', () => {
  it('lets a customer correct their email after choosing how to collect', () => {
    expect(furthestStep('shipping', 'contact')).toBe('shipping');
  });

  it('keeps the progress they had — an email edit must not cost them their choice', () => {
    expect(furthestStep('payment', 'contact')).toBe('payment');
    expect(furthestStep('payment', 'shipping')).toBe('payment');
  });

  it('advances normally on the way forward', () => {
    expect(furthestStep('cart_review', 'contact')).toBe('contact');
    expect(furthestStep('contact', 'shipping')).toBe('shipping');
    expect(furthestStep('shipping', 'payment')).toBe('payment');
  });

  it('is idempotent — re-submitting the step you are on changes nothing', () => {
    expect(furthestStep('shipping', 'shipping')).toBe('shipping');
  });

  it('treats an unknown current step as behind everything, so a write still lands', () => {
    expect(furthestStep('nonsense', 'contact')).toBe('contact');
  });
});
