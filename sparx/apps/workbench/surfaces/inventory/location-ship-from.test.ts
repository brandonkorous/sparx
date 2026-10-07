// What the place parcels leave from still needs, and when the business address
// is offered to fill it (issue 929).

import { describe, expect, it } from 'vitest';
import {
  addressLine,
  businessAddressOffer,
  courierGaps,
  listOf,
  readyForCouriers,
  type ShipFromAddress,
} from './location-ship-from';

const BLANK: ShipFromAddress = {
  type: 'owned',
  line1: '',
  line2: '',
  city: '',
  region: '',
  postalCode: '',
  country: '',
};

// Devi's Main Warehouse as it was: made before she typed her business address.
const mainWarehouse: ShipFromAddress = { ...BLANK, country: 'US' };

const business = {
  addressLine1: '1200 SE Belmont St',
  addressLine2: null,
  city: 'Portland',
  region: 'OR',
  postalCode: '97214',
  country: 'US',
  phone: null,
};

describe('what a courier still needs', () => {
  it('names every missing part of a location with only a country', () => {
    expect(listOf(courierGaps(mainWarehouse))).toBe(
      'a street address, a town or city and a postal code'
    );
  });

  it('asks for the postal code the form calls optional', () => {
    const noZip = { ...mainWarehouse, line1: '1 Main St', city: 'Portland' };
    expect(courierGaps(noZip)).toEqual(['a postal code']);
  });

  it('asks for nothing once the address is whole', () => {
    expect(courierGaps({ ...mainWarehouse, line1: 'x', city: 'y', postalCode: 'z' })).toEqual([]);
  });
});

describe('the list’s flag on the place parcels leave from', () => {
  it('flags a saved place with only a country, and not a whole one', () => {
    const saved = { line1: null, city: null, postalCode: null, country: 'US' };
    expect(readyForCouriers(saved)).toBe(false);
    const whole = { line1: '1184 SE Ash St', city: 'Portland', postalCode: '97214', country: 'US' };
    expect(readyForCouriers(whole)).toBe(true);
    expect(readyForCouriers({ ...whole, postalCode: null })).toBe(false);
  });
});

describe('the business address offer', () => {
  it('offers Business details to a place that lacks it', () => {
    const offer = businessAddressOffer(business, mainWarehouse);
    expect(offer && addressLine(offer)).toBe('1200 SE Belmont St, Portland, OR 97214, US');
  });

  it('is not offered once the place has what a courier needs', () => {
    const whole = { ...mainWarehouse, line1: '9 Dock Rd', city: 'Salem', postalCode: '97301' };
    expect(businessAddressOffer(business, whole)).toBeNull();
  });

  it('is not offered to a supplier’s place or a place on paper only', () => {
    expect(businessAddressOffer(business, { ...mainWarehouse, type: 'dropship' })).toBeNull();
    expect(businessAddressOffer(business, { ...mainWarehouse, type: 'virtual' })).toBeNull();
  });

  it('is not offered to a place in another town', () => {
    const columbus = { ...mainWarehouse, city: 'Columbus' };
    expect(businessAddressOffer(business, columbus)).toBeNull();
    expect(businessAddressOffer(business, { ...columbus, city: 'portland' })).not.toBeNull();
  });

  it('is not offered when Business details has no street of its own', () => {
    expect(businessAddressOffer({ ...business, addressLine1: null }, mainWarehouse)).toBeNull();
  });
});
