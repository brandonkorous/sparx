// When a checkout needs an address, and when asking for one is the bug.
//
// Issue 064: a customer collecting a bun over a counter filled in seven
// delivery fields, pressed the button, and was shown one option — "Collect in
// person". The address was never used, and it went onto the order as though
// somebody had meant it.
//
// The rule is one sentence: an address is required by a DELIVERY, not by an
// order. These are the pieces that have to agree on it.

import { describe, expect, it } from 'vitest';

import { SubmitContactInput, SubmitShippingInput } from '@wizeworks/commerce-schemas';

import { COLLECTION_PROVIDER_SLUG, isCollection } from './collection-option';

const SESSION = '11111111-1111-4111-8111-111111111111';

const DELIVERY = {
  sessionId: SESSION,
  shippingRateRef: 'manual:abc',
  shippingProviderSlug: 'sparx-manual',
};

const COLLECTION = {
  sessionId: SESSION,
  shippingRateRef: 'collection:in-person',
  shippingProviderSlug: COLLECTION_PROVIDER_SLUG,
};

const ADDRESS = {
  recipientName: 'Rowan Ellery',
  line1: '14 Mercer Lane',
  city: 'Ashfield',
  region: 'OR',
  postalCode: '97401',
  country: 'US',
};

describe('isCollection', () => {
  it('recognises the option a shop with no delivery set up offers', () => {
    expect(isCollection({ providerSlug: COLLECTION_PROVIDER_SLUG })).toBe(true);
  });

  it('is false for a real carrier', () => {
    expect(isCollection({ providerSlug: 'sparx-manual' })).toBe(false);
    expect(isCollection({ providerSlug: 'shippo' })).toBe(false);
  });

  it('is false when no method has been chosen yet, which is not the same as collecting', () => {
    // A stored session carries `null` here until the shipping step. Reading
    // that as "collection" would let an order complete with no address AND no
    // way of leaving.
    expect(isCollection({ providerSlug: null })).toBe(false);
  });
});

describe('SubmitShippingInput', () => {
  it('accepts a collection with no address at all', () => {
    const parsed = SubmitShippingInput.parse(COLLECTION);
    expect(parsed.shippingAddress).toBeUndefined();
    expect(parsed.billingAddress).toBeUndefined();
  });

  it('still accepts a delivery with one', () => {
    const parsed = SubmitShippingInput.parse({ ...DELIVERY, shippingAddress: ADDRESS });
    expect(parsed.shippingAddress?.line1).toBe('14 Mercer Lane');
  });

  it('does not accept half an address — optional means absent, not blank', () => {
    // The failure this guards against is a client sending `line1: ''` to get
    // past a required field, which would write an empty street onto the order
    // and read downstream exactly like one somebody gave.
    expect(() =>
      SubmitShippingInput.parse({
        ...DELIVERY,
        shippingAddress: { ...ADDRESS, line1: '' },
      })
    ).toThrow();
  });
});

describe('SubmitContactInput', () => {
  it('carries the buyer’s name, so it no longer has to arrive inside an address', () => {
    expect(
      SubmitContactInput.parse({ sessionId: SESSION, email: 'a@b.test', name: 'Rowan Ellery' })
    ).toMatchObject({ name: 'Rowan Ellery' });
  });

  it('does not require one — a shopper who gives only an email still buys', () => {
    const parsed = SubmitContactInput.parse({ sessionId: SESSION, email: 'a@b.test' });
    expect(parsed.name).toBeUndefined();
  });
});
