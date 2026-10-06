// How a place is written, once.
//
// Six copies joined city, region and postal code with commas, so a card read
// "Salt Lake City, UT, 84119": the comma before a ZIP is not how anyone writes
// an envelope, and it made a business's own billing address look mistyped on its
// customer card (sparx persona issue 079). The postal code rides with the region
// ("UT 84119"); where there is no region it follows the town ("Bristol, BS1 4TR").

export interface PlaceParts {
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
}

export interface StreetParts extends PlaceParts {
  line1?: string | null;
  line2?: string | null;
}

function clean(part: string | null | undefined): string {
  return (part ?? '').trim();
}

/** "Salt Lake City, UT 84119" · "Bristol, BS1 4TR" · "" when nothing is known. */
export function localityLine(place: PlaceParts): string {
  const tail = [clean(place.region), clean(place.postalCode)].filter(Boolean).join(' ');
  return [clean(place.city), tail].filter(Boolean).join(', ');
}

/** The whole address on one line: "2275 S 900 W, Suite 200, Salt Lake City, UT 84119". */
export function oneLineAddress(address: StreetParts): string {
  return [clean(address.line1), clean(address.line2), localityLine(address)]
    .filter(Boolean)
    .join(', ');
}
