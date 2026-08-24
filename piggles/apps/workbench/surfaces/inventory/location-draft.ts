// The shape a location form holds while it is being edited, and the small
// conversions between that shape and what the API wants.

import type { Location, LocationAddressInput } from './locations-data';

export const COLUMN = 'mx-auto flex w-full max-w-2xl flex-col gap-4';

/** The editable state of the form. Everything a string so an empty field is
 *  empty rather than a stray zero or null. */
export interface Draft {
  name: string;
  code: string;
  type: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone: string;
  isActive: boolean;
}

export const BLANK: Draft = {
  name: '',
  code: '',
  type: 'owned',
  line1: '',
  line2: '',
  city: '',
  region: '',
  postalCode: '',
  country: '',
  phone: '',
  isActive: true,
};

/** A code is uppercase letters, digits, dash and underscore — matching what the
 *  server accepts — so we shape it as it is typed rather than rejecting it after. */
export function cleanCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 15);
}

/** A country is a two-letter code (US, GB, DE). Upper-cased and clamped as typed. */
export function cleanCountry(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 2);
}

export function draftFrom(location: Location): Draft {
  return {
    name: location.name,
    code: location.code,
    type: location.type,
    line1: location.line1 ?? '',
    line2: location.line2 ?? '',
    city: location.city ?? '',
    region: location.region ?? '',
    postalCode: location.postalCode ?? '',
    country: location.country ?? '',
    phone: location.phone ?? '',
    isActive: location.isActive,
  };
}

/** The optional address parts, omitting the blanks so the server stores a null
 *  rather than an empty string. */
export function addressInput(draft: Draft): LocationAddressInput {
  return {
    line1: draft.line1.trim(),
    city: draft.city.trim(),
    country: draft.country.trim(),
    ...(draft.line2.trim() ? { line2: draft.line2.trim() } : {}),
    ...(draft.region.trim() ? { region: draft.region.trim() } : {}),
    ...(draft.postalCode.trim() ? { postalCode: draft.postalCode.trim() } : {}),
    ...(draft.phone.trim() ? { phone: draft.phone.trim() } : {}),
  };
}

/** Which address fields differ from what was loaded — an update sends the whole
 *  address or none of it, so it only sends it when one of these actually moved. */
export function addressChanged(draft: Draft, initial: Draft): boolean {
  return (
    draft.line1 !== initial.line1 ||
    draft.line2 !== initial.line2 ||
    draft.city !== initial.city ||
    draft.region !== initial.region ||
    draft.postalCode !== initial.postalCode ||
    draft.country !== initial.country ||
    draft.phone !== initial.phone
  );
}

/* ── The shared form ────────────────────────────────────────────────────── */
