// A free address that opens nothing (persona issue 927).
//
// Before issue 316 was fixed, adding a second site handed a Piggles business an
// address in sparx's zone. Issue 648's repair minted each of those sites an address
// in its own brand's zone and made it the main one, and KEPT the old row, on the
// reasoning that it still answered and redirected. It does neither in production:
// the site app refuses a tenant on another brand's zone (`site-context.ts`, "the
// mismatch is what is actionable"), and nothing anywhere redirects one host to
// another. The row's only remaining effect was the Domains list calling an address
// with another company's name in it "Always on".
//
// So it is not shown. The row is left alone: a repair that deletes rows cannot be
// undone, and hiding is enough to stop the screen saying something false.
//
// Only when the site ALREADY HAS a free address in its own zone. A site whose only
// free address is in the wrong zone has not been repaired, and hiding its one
// address would make it look as if it had none.

import { mintedZoneOf } from '@wizeworks/db/site-origin';

interface AddressRow {
  id: string;
  propertyId: string;
  host: string;
  type: string;
}

function inZone(row: AddressRow, zone: string): boolean {
  return mintedZoneOf(row.host) === zone;
}

/** The ids of free addresses in another brand's zone on a site that has one in
 *  `zone`, the tenant's own. Custom and bought domains are never in it. */
export function strandedZoneAddressIds(rows: readonly AddressRow[], zone: string): Set<string> {
  const sitesWithOwn = new Set(
    rows.filter((row) => row.type === 'subdomain' && inZone(row, zone)).map((row) => row.propertyId)
  );
  return new Set(
    rows
      .filter(
        (row) => row.type === 'subdomain' && !inZone(row, zone) && sitesWithOwn.has(row.propertyId)
      )
      .map((row) => row.id)
  );
}
