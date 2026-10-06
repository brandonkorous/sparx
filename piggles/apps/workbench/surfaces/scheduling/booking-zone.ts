'use client';

// WHOSE CLOCK a new booking's time is typed on (sparx persona issue 086).
//
// A booking that exists already carries its zone (`booking.timezone`), and every
// box that moves it reads that. A booking, series or waiting-list entry that does
// NOT exist yet has no zone of its own, so the box has to work out the one the
// server will give it, by the same rule the server uses
// (`findBookingPlaceTx` in @wizeworks/scheduling):
//
//   1. the service's own place, when it has one, and that place's zone;
//   2. otherwise the business's only active place, when it has exactly one;
//   3. otherwise the business's own zone (Business details);
//   4. otherwise this computer's, which is the honest answer when nobody has
//      said, and the hint under the box names it.
//
// A place with no zone of its own follows the business's, as it does on the
// server. Disagreeing with the server here would bring back exactly the defect
// this file exists for, one step removed: a box that says 9:00 and a booking
// that says 8:00.

import { thisComputersTimezone, useBusinessZone } from '../../lib/business-timezone';
import { wallClockHint, zoneWords } from '../../lib/wall-clock';
import { useSchedulingServices } from './bookings-data';
import { useLocations } from './setup-data';

interface PlaceLite {
  id: string;
  timezone: string | null;
  isActive: boolean;
}

/** Where a new booking's zone came from. `guessed` is true only when nobody has
 *  said: no place zone and no business zone, so this computer's is used. */
export interface PlaceClock {
  zone: string;
  guessed: boolean;
}

/**
 * The zone the server will book in, or `undefined` while that cannot be known
 * yet (the business or its places are still loading). Pure, so it can be tested
 * against the server's rule.
 */
export function placeZone(input: {
  locationId: string | null | undefined;
  places: readonly PlaceLite[] | undefined;
  business: string | null | undefined;
  device: string;
}): PlaceClock | undefined {
  const { locationId, places, business, device } = input;
  if (business === undefined || places === undefined) return undefined;
  const own = locationId ? places.find((place) => place.id === locationId) : undefined;
  const active = places.filter((place) => place.isActive);
  const place = own ?? (!locationId && active.length === 1 ? active[0] : undefined);
  if (place?.timezone) return { zone: place.timezone, guessed: false };
  if (business) return { zone: business, guessed: false };
  return { zone: device, guessed: true };
}

/** The zone a new booking at this place is typed in, and the sentence that says so. */
export function useBookingZone(locationId: string | null | undefined): {
  zone: string | undefined;
  hint: string;
} {
  const business = useBusinessZone();
  const places = useLocations();
  const device = thisComputersTimezone();
  // A places read that FAILED is not one still loading: without this a console
  // whose places cannot be read would hold every booking box shut forever.
  const list = places.isError ? [] : places.data?.items;
  const clock = placeZone({ locationId, places: list, business, device });
  if (clock === undefined) return { zone: undefined, hint: 'Checking which clock this is on…' };
  return {
    zone: clock.zone,
    hint: clock.guessed
      ? `In ${zoneWords(clock.zone)}, this computer’s clock, because no time zone is set for the business. Set one in Business details and this follows it.`
      : wallClockHint(clock.zone, device),
  };
}

/**
 * The same, for something that names its SERVICE rather than its place: a
 * waiting-list entry, a series. The service's place comes from the services list
 * (cached for every booking form), and the box holds still until it has loaded.
 */
export function useServiceZone(serviceId: string | null | undefined): {
  zone: string | undefined;
  hint: string;
} {
  const services = useSchedulingServices('');
  const service = serviceId ? services.data?.items.find((s) => s.id === serviceId) : undefined;
  const clock = useBookingZone(service?.locationId);
  if (serviceId && services.isPending) {
    return { zone: undefined, hint: 'Checking which clock this is on…' };
  }
  return clock;
}
