// A new booking's box is typed on the clock the server will book it on (sparx
// persona issue 086). The rule mirrors `findBookingPlaceTx`: the service's own
// place, else the only active place, else the business, else this computer.

import { describe, expect, it } from 'vitest';

import { placeZone } from './booking-zone';

const SLC = { id: 'slc', timezone: 'America/Denver', isActive: true };
const BOISE = { id: 'boise', timezone: 'America/Boise', isActive: true };
const NO_ZONE = { id: 'annex', timezone: null, isActive: true };
const DEVICE = 'America/Los_Angeles';

describe('which clock a new booking is typed on', () => {
  it('waits while the business or its places are still loading', () => {
    expect(placeZone({ locationId: null, places: undefined, business: null, device: DEVICE })).toBe(
      undefined
    );
    expect(
      placeZone({ locationId: null, places: [SLC], business: undefined, device: DEVICE })
    ).toBe(undefined);
  });

  it("uses the service's own place", () => {
    expect(
      placeZone({ locationId: 'boise', places: [SLC, BOISE], business: 'UTC', device: DEVICE })
    ).toEqual({ zone: 'America/Boise', guessed: false });
  });

  it('uses the only active place when the service names none', () => {
    expect(placeZone({ locationId: null, places: [SLC], business: 'UTC', device: DEVICE })).toEqual(
      { zone: 'America/Denver', guessed: false }
    );
  });

  it('uses the business when there are several places and the service names none', () => {
    expect(
      placeZone({
        locationId: null,
        places: [SLC, BOISE],
        business: 'America/Denver',
        device: DEVICE,
      })
    ).toEqual({ zone: 'America/Denver', guessed: false });
  });

  it('lets a place with no zone of its own follow the business', () => {
    expect(
      placeZone({
        locationId: 'annex',
        places: [NO_ZONE],
        business: 'America/Denver',
        device: DEVICE,
      })
    ).toEqual({ zone: 'America/Denver', guessed: false });
  });

  it('falls back to this computer only when nobody has said, and says it guessed', () => {
    expect(placeZone({ locationId: null, places: [], business: null, device: DEVICE })).toEqual({
      zone: DEVICE,
      guessed: true,
    });
  });
});
