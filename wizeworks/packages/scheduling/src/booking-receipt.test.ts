import { describe, expect, it } from 'vitest';

import { customerFacingPlace, formatAddressLine, joinNames } from './booking-receipt';

describe('formatAddressLine', () => {
  it('writes the parts in envelope order', () => {
    expect(
      formatAddressLine({
        line1: '214 Bower Street',
        line2: 'Suite B',
        city: 'Sacramento',
        region: 'CA',
        postalCode: '95811',
        country: 'United States',
      })
    ).toBe('214 Bower Street, Suite B, Sacramento, CA 95811, United States');
  });

  it('keeps the town and postcode together on one part', () => {
    expect(formatAddressLine({ city: 'Leeds', postalCode: 'LS1 4AP' })).toBe('Leeds LS1 4AP');
  });

  it('skips whatever the business did not fill in', () => {
    expect(formatAddressLine({ line1: '12 Mill Lane', city: 'Bath' })).toBe('12 Mill Lane, Bath');
  });

  it('is empty for a business with no address at all', () => {
    expect(formatAddressLine({})).toBe('');
    expect(formatAddressLine(null)).toBe('');
    expect(formatAddressLine('214 Bower Street')).toBe('');
    expect(formatAddressLine({ line1: '   ', city: 42 })).toBe('');
  });
});

describe('customerFacingPlace', () => {
  const place = {
    name: 'Halo & Hem',
    address: '214 Bower Street, Sacramento, CA',
    line: 'Halo & Hem, 214 Bower Street, Sacramento, CA',
    timezone: 'America/Los_Angeles',
  };

  it('gives the customer the name and the address', () => {
    expect(customerFacingPlace(place)).toBe('Halo & Hem, 214 Bower Street, Sacramento, CA');
  });

  // A name is not a "where". Telling somebody who has never been to Halo & Hem
  // that their appointment is at "Halo & Hem" is the absence dressed as an answer.
  it('says nothing when all it knows is the name', () => {
    expect(
      customerFacingPlace({ name: 'Halo & Hem', address: '', line: 'Halo & Hem', timezone: 'UTC' })
    ).toBeNull();
    expect(customerFacingPlace(null)).toBeNull();
  });
});

describe('joinNames', () => {
  it('reads like a sentence, not a list', () => {
    expect(joinNames([])).toBe('');
    expect(joinNames(['Nia'])).toBe('Nia');
    expect(joinNames(['Nia', 'Dara'])).toBe('Nia and Dara');
    expect(joinNames(['Nia', 'Dara', 'Sam'])).toBe('Nia, Dara and Sam');
  });
});
