// Which of a business's free addresses are in the wrong brand's zone.
//
// Pure, so the rule can be tested without a database. The script that runs it
// (`src/scripts/repair-cross-brand-subdomains.ts`) does the reading and the
// writing; everything that decides anything is here.
//
// ── THE RULE ──────────────────────────────────────────────────────────────────
//
// Every brand on this platform mints its businesses a free address in its own
// zone: a sparx business gets `<slug>.sparx.zone`, a Piggles business
// `<slug>.piggles.site`. Adding a SECOND site once took the DEFAULT zone instead
// of the tenant's, so one business ended up with sites in two brands' zones and
// the extra ones named after a product its owner has never heard of (issue 648).
//
// The intended zone is asked of the BRAND here, not of the rows. Every other
// reader in this codebase does the opposite on purpose — the row is the record of
// what provisioning decided — but this is the one caller that cannot, because it
// exists precisely because some of those rows are wrong. Reading them back would
// be asking the mistake to confirm itself.

import { mintZoneHost, mintedZoneOf, zoneOf } from './domain.js';

/** One `type: 'subdomain'` row, with the site it points at. */
export interface ZoneHost {
  host: string;
  propertyId: string;
  siteSlug: string;
  isPrimary: boolean;
}

export interface ZoneMove {
  propertyId: string;
  siteSlug: string;
  from: string;
  to: string;
}

/** The zone a host was minted in, by the same reading `tenantZone` uses: a
 *  recognised owned zone first, else the host's own last two labels. */
export function hostZone(host: string): string | null {
  return zoneOf(host) ?? mintedZoneOf(host);
}

/**
 * The moves that put a business's addresses back on its own brand's zone.
 *
 * Empty when everything is already right, which is the answer for almost every
 * business and the reason this is safe to re-run.
 *
 * A host already IN the brand's zone is left alone even when its shape looks
 * unusual — this repairs the ZONE, and re-minting a host that is already in the
 * right place would rename addresses for a reason nobody asked for.
 *
 * ── AND A SITE THAT HAS ALREADY BEEN REPAIRED IS DONE ────────────────────────
 *
 * The repair deliberately KEEPS the wrong-zone host, demoted, so the old address
 * goes on answering and redirects. That is the intended end state, not a fault —
 * but the first version of this function did not know it, so a second run
 * reported the same three addresses as still needing moving:
 *
 *   Dry run: 39 businesses, 38 already on their own brand, 3 to move, 0 blocked.
 *   Dry run: 39 businesses, 38 already on their own brand, 3 to move, 0 blocked.
 *
 * with the work done in between. A report you cannot tell "already done" from
 * "still broken" by is not a report — it is a number that never moves, which is
 * the exact thing this repair exists to stop somebody reading past.
 *
 * So the question is asked per SITE, not per row: does this site already have an
 * address in its own brand's zone? If it does, its old one is a redirect and
 * there is nothing to do. [[feedback_never_present_absence_as_measurement]]
 */
export function crossBrandMoves(
  tenantSlug: string,
  brandZone: string,
  hosts: readonly ZoneHost[]
): ZoneMove[] {
  const zone = brandZone.trim().toLowerCase();
  // A brand with no zone cannot be repaired, only guessed at, and guessing is
  // what wrote these rows. The caller reports it; this answers "nothing to do".
  if (zone === '') return [];

  const settled = new Set<string>();
  for (const row of hosts) {
    if (hostZone(row.host) === zone) settled.add(row.propertyId);
  }

  const moves: ZoneMove[] = [];
  for (const row of hosts) {
    if (hostZone(row.host) === zone) continue;
    if (settled.has(row.propertyId)) continue;
    const to = mintZoneHost(tenantSlug, row.siteSlug, row.isPrimary, zone);
    // Defensive: if the minted host is what it already is, there is no move.
    if (to === row.host) continue;
    moves.push({ propertyId: row.propertyId, siteSlug: row.siteSlug, from: row.host, to });
  }
  return moves;
}
