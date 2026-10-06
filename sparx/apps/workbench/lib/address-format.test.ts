import { describe, expect, it } from 'vitest';

import { localityLine, oneLineAddress } from './address-format';

// An address written the way an envelope is (sparx persona issue 079).
describe('writing a place', () => {
  it('keeps the ZIP with the state, not after a comma', () => {
    expect(localityLine({ city: 'Salt Lake City', region: 'UT', postalCode: '84119' })).toBe(
      'Salt Lake City, UT 84119'
    );
  });

  it('puts a postcode after the town when there is no region', () => {
    expect(localityLine({ city: 'Bristol', postalCode: 'BS1 4TR' })).toBe('Bristol, BS1 4TR');
  });

  it('drops what is missing without leaving stray commas', () => {
    expect(localityLine({ city: 'Post Falls', region: 'ID', postalCode: ' ' })).toBe(
      'Post Falls, ID'
    );
    expect(localityLine({})).toBe('');
  });

  it('writes a whole address on one line', () => {
    expect(
      oneLineAddress({
        line1: '2275 S 900 W',
        line2: 'Suite 200',
        city: 'Salt Lake City',
        region: 'UT',
        postalCode: '84119',
      })
    ).toBe('2275 S 900 W, Suite 200, Salt Lake City, UT 84119');
  });
});
