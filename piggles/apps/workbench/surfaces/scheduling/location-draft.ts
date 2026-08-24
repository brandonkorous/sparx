// The place editor's draft — the shape being typed, and everything that turns it
// into an answer.
//
// Separated from the pane because it is all pure: no JSX, no hooks, no
// mutations. That is what makes the two questions this file answers testable in
// isolation — "has anything changed" and "what gets sent".

import type { BusinessLocation, LocationInput } from './setup-data';
import { zoneCity } from '../../lib/timezones';

export interface Draft {
  name: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  /** `''` means "follow the business" — the draft's word for a null column. */
  timezone: string;
  /** Strings so an empty coordinate field is empty, not a zero on the equator. */
  lat: string;
  lng: string;
  isActive: boolean;
  /** The sites served from here. EMPTY = all of them. */
  propertyIds: string[];
}

export const BLANK: Draft = {
  name: '',
  line1: '',
  line2: '',
  city: '',
  region: '',
  postalCode: '',
  country: '',
  // Empty means "follow the business", which is both the honest default for a
  // place nobody has told us about and the right one for the single-premises
  // shop that is most businesses. Never a literal: a field that already reads
  // `UTC` looks answered and gets skipped (issue 081), and a stored `UTC`
  // nobody chose set the hour of every booking (issue 178).
  timezone: '',
  lat: '',
  lng: '',
  isActive: true,
  propertyIds: [],
};

export function draftFrom(location: BusinessLocation): Draft {
  return {
    name: location.name,
    line1: location.address.line1 ?? '',
    line2: location.address.line2 ?? '',
    city: location.address.city ?? '',
    region: location.address.region ?? '',
    postalCode: location.address.postalCode ?? '',
    country: location.address.country ?? '',
    // Kept as absence rather than resolved here, so the field can say WHERE the
    // zone came from (issue 178).
    timezone: location.timezone ?? '',
    lat: location.lat == null ? '' : String(location.lat),
    lng: location.lng == null ? '' : String(location.lng),
    isActive: location.isActive,
    // Sorted so the dirty check (a JSON compare) can't fire on ordering alone.
    propertyIds: [...location.propertyIds].sort(),
  };
}

export function draftsEqual(a: Draft, b: Draft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** A coordinate field: whether it PARSES, and what it parsed to. Reported
 *  separately from the value so the form can explain WHICH half is wrong. */
function coordinate(value: string, bound: number): { ok: boolean; value: number | null } {
  const trimmed = value.trim();
  if (trimmed === '') return { ok: true, value: null };
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < -bound || parsed > bound)
    return { ok: false, value: null };
  return { ok: true, value: parsed };
}

export interface Coordinates {
  lat: number | null;
  lng: number | null;
  /** The one sentence to show, or null when the pair is fine. */
  error: string | null;
}

/** Both halves or neither — the server refuses half a coordinate, so say it here. */
export function coordinatesOf(draft: Draft): Coordinates {
  const lat = coordinate(draft.lat, 90);
  const lng = coordinate(draft.lng, 180);
  const paired = (lat.value === null) === (lng.value === null);
  const error = !lat.ok
    ? 'A latitude is a number between -90 and 90.'
    : !lng.ok
      ? 'A longitude is a number between -180 and 180.'
      : paired
        ? null
        : 'Fill in both the latitude and the longitude, or leave both empty.';
  return { lat: lat.value, lng: lng.value, error };
}

export function toPayload(draft: Draft, coordinates: Coordinates): LocationInput {
  return {
    name: draft.name.trim(),
    address: {
      ...(draft.line1.trim() ? { line1: draft.line1.trim() } : {}),
      ...(draft.line2.trim() ? { line2: draft.line2.trim() } : {}),
      ...(draft.city.trim() ? { city: draft.city.trim() } : {}),
      ...(draft.region.trim() ? { region: draft.region.trim() } : {}),
      ...(draft.postalCode.trim() ? { postalCode: draft.postalCode.trim() } : {}),
      ...(draft.country.trim() ? { country: draft.country.trim() } : {}),
    },
    timezone: draft.timezone === '' ? null : draft.timezone,
    lat: coordinates.lat,
    lng: coordinates.lng,
    isActive: draft.isActive,
    propertyIds: draft.propertyIds,
  };
}

/** What the "no zone of my own" option is called, which depends on whether the
 *  business has one to follow. Naming the city makes it a statement a person can
 *  check rather than a promise they have to trust. */
export function followLabel(businessZone: string | null | undefined): string {
  if (businessZone === undefined) return 'Same as your business';
  if (businessZone === null) return 'Same as your business (not set yet)';
  return `Same as your business (${zoneCity(businessZone)})`;
}
