import { describe, expect, it } from 'vitest';
import {
  COLLECTION_PROVIDER_SLUG,
  COLLECTION_RATE_REF,
  COLLECTION_SERVICE,
  collectionOption,
  describeRate,
  isCollection,
} from './collection-option';

describe('collectionOption', () => {
  it('costs nothing — a default that invents a price is issue #031', () => {
    expect(collectionOption('GBP').amountCents).toBe(0);
  });

  it('quotes in the cart’s own currency rather than a hardcoded one', () => {
    expect(collectionOption('GBP').currency).toBe('GBP');
    expect(collectionOption('USD').currency).toBe('USD');
  });

  it('promises no delivery date, because nothing is being delivered', () => {
    expect(collectionOption('USD').estimatedDeliveryDays).toBeUndefined();
  });

  it('carries a stable ref, so submitShipping can re-find it in a fresh quote', () => {
    expect(collectionOption('USD').rateRef).toBe(COLLECTION_RATE_REF);
    expect(collectionOption('USD').rateRef).toBe(collectionOption('GBP').rateRef);
  });
});

describe('isCollection', () => {
  it('recognises the option by its provider', () => {
    expect(isCollection(collectionOption('USD'))).toBe(true);
  });

  it('leaves a real carrier alone', () => {
    expect(isCollection({ providerSlug: 'shippo' })).toBe(false);
    expect(isCollection({ providerSlug: 'sparx-manual' })).toBe(false);
  });
});

describe('describeRate', () => {
  it('does not put the carrier in front of a phrase that already reads whole', () => {
    expect(describeRate(collectionOption('USD'))).toBe(COLLECTION_SERVICE);
    expect(describeRate(collectionOption('USD'))).not.toContain(COLLECTION_PROVIDER_SLUG);
  });

  it('still names carrier and service for a real delivery', () => {
    expect(describeRate({ providerSlug: 'shippo', carrier: 'USPS', service: 'Priority' })).toBe(
      'USPS Priority'
    );
  });

  it('tolerates a rate with no carrier name without leaving a stray space', () => {
    expect(describeRate({ providerSlug: 'sparx-manual', carrier: '', service: 'Standard' })).toBe(
      'Standard'
    );
  });
});
