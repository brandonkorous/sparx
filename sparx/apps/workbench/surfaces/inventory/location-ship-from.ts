// What a courier needs from the place online orders ship from, and whether the
// business's own address can fill the gap (issue 929). Pure, so the rules can be
// tested without a screen.

import type { BusinessAddress } from '../../lib/business-address';

/** The parts of the location form these rules read. The form's own draft lives
 *  in location-detail and has more; anything with these fields will do. */
export interface Draft {
  type: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

/** The kinds of place a parcel can leave from. A supplier's place and a place
 *  on paper only cannot hand anything to a courier, so neither is offered. */
export function canShipFrom(type: string): boolean {
  return type === 'owned' || type === '3pl';
}

/** The parts a courier prices postage from, in the form's words. The same four
 *  the server checks before it will price a parcel or print a label
 *  (`resolveShipFromAddress`), so the screen never asks for less than that. */
export function courierGaps(draft: Draft): string[] {
  const gaps: string[] = [];
  if (!draft.line1.trim()) gaps.push('a street address');
  if (!draft.city.trim()) gaps.push('a town or city');
  if (!draft.postalCode.trim()) gaps.push('a postal code');
  if (!/^[A-Z]{2}$/.test(draft.country.trim())) gaps.push('a country');
  return gaps;
}

/** Whether a SAVED location has every part a courier needs. The list reads this
 *  to flag the place parcels leave from before anyone opens it. */
export function readyForCouriers(location: {
  line1: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
}): boolean {
  return Boolean(
    location.line1?.trim() &&
    location.city?.trim() &&
    location.postalCode?.trim() &&
    /^[A-Z]{2}$/.test(location.country?.trim() ?? '')
  );
}

/** "a, b and c". */
export function listOf(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** The address fields Business details can fill, or null when it cannot help:
 *  it has no street and town of its own, this location already has every part a
 *  courier needs, or it is plainly somewhere else (it names another town, like
 *  the sample pack's place in Columbus). Never offered to a place a parcel cannot
 *  leave from. */
export function businessAddressOffer(
  business: BusinessAddress | undefined,
  draft: Draft
): Pick<Draft, 'line1' | 'line2' | 'city' | 'region' | 'postalCode' | 'country'> | null {
  if (!business || !canShipFrom(draft.type)) return null;
  const line1 = business.addressLine1?.trim() ?? '';
  const city = business.city?.trim() ?? '';
  if (!line1 || !city) return null;
  if (courierGaps(draft).length === 0) return null;
  const town = draft.city.trim();
  if (town && town.toLowerCase() !== city.toLowerCase()) return null;
  const country = business.country?.trim().toUpperCase() ?? '';
  return {
    line1,
    line2: business.addressLine2?.trim() ?? '',
    city,
    region: business.region?.trim() ?? '',
    postalCode: business.postalCode?.trim() ?? '',
    country: country === '' ? draft.country : country,
  };
}

/** One line for an envelope: "1200 SE Belmont St, Portland, OR 97214, US". */
export function addressLine(
  parts: Pick<Draft, 'line1' | 'line2' | 'city' | 'region' | 'postalCode' | 'country'>
): string {
  const town = [parts.region, parts.postalCode].filter(Boolean).join(' ');
  return [parts.line1, parts.line2, parts.city, town, parts.country].filter(Boolean).join(', ');
}
