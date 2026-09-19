// A SHOP'S OWN WEB ADDRESS WITH ANOTHER COMPANY'S NAME IN IT.
//
// Every brand mints its businesses a free address in its own zone. Adding a
// SECOND site took the DEFAULT zone rather than the tenant's, so a Piggles shop
// with seven sites had its first on `juniper-row.piggles.site` and three others
// on `<site>.juniper-row.sparx.zone` — the address printed on a card, typed by a
// customer, shown in a browser bar, naming a product she has never heard of and
// cannot find anywhere in her console.
//
// Measured 2026-09-18 against the platform database:
//
//   Piggles businesses' addresses on piggles.site          11
//   Piggles businesses' addresses on sparx.zone             3
//   sparx businesses' addresses on sparx.zone              44
//   sparx businesses' addresses on piggles.site             0
//
// The code that mints them was fixed and the rows it had already written were
// not. This is the rule that finds them. [[feedback_data_is_a_deploy_stage]]

import { describe, expect, it } from 'vitest';
import { crossBrandMoves, hostZone, type ZoneHost } from './brand-zone-repair';

const site = (slug: string, host: string, isPrimary = false): ZoneHost => ({
  host,
  propertyId: `prop-${slug}`,
  siteSlug: slug,
  isPrimary,
});

/** Juniper Row exactly as the database holds her, primary first. */
const juniperRow: ZoneHost[] = [
  site('primary', 'juniper-row.piggles.site', true),
  site('archive', 'archive.juniper-row.sparx.zone'),
  site('journal', 'journal.juniper-row.piggles.site'),
  site('juniper-row-lookbook', 'juniper-row-lookbook.juniper-row.piggles.site'),
  site('press', 'press.juniper-row.sparx.zone'),
  site('sample-sale', 'sample-sale.juniper-row.piggles.site'),
  site('trade', 'trade.juniper-row.sparx.zone'),
];

describe('reading which zone an address is in', () => {
  it('reads a zone this deployment has never been told about', () => {
    // The local stack sets no zone list at all, so `piggles.site` is unrecognised
    // — and an unrecognised zone reading as "the default" is how every one of
    // these rows was written.
    expect(hostZone('journal.juniper-row.piggles.site')).toBe('piggles.site');
    expect(hostZone('archive.juniper-row.sparx.zone')).toBe('sparx.zone');
  });
});

describe('finding the addresses in the wrong brand', () => {
  it('finds exactly the three that are wrong, and names where each one goes', () => {
    const moves = crossBrandMoves('juniper-row', 'piggles.site', juniperRow);
    expect(moves.map((m) => `${m.from} → ${m.to}`)).toEqual([
      'archive.juniper-row.sparx.zone → archive.juniper-row.piggles.site',
      'press.juniper-row.sparx.zone → press.juniper-row.piggles.site',
      'trade.juniper-row.sparx.zone → trade.juniper-row.piggles.site',
    ]);
  });

  it('leaves a business that is already right completely alone', () => {
    const ok = juniperRow.filter((h) => h.host.endsWith('.piggles.site'));
    expect(crossBrandMoves('juniper-row', 'piggles.site', ok)).toEqual([]);
  });

  it('is safe to run twice: the second run has nothing to do', () => {
    // The repair KEEPS the old address, demoted, so it goes on answering and
    // redirects. The second run therefore sees both, and has to read that as
    // done — this is the state the repair actually leaves behind, not a
    // hypothetical one where the old row disappeared.
    const first = crossBrandMoves('juniper-row', 'piggles.site', juniperRow);
    const after: ZoneHost[] = [
      ...juniperRow,
      ...first.map((m) => ({
        host: m.to,
        propertyId: m.propertyId,
        siteSlug: m.siteSlug,
        isPrimary: false,
      })),
    ];
    expect(crossBrandMoves('juniper-row', 'piggles.site', after)).toEqual([]);
  });

  it('reads a site that already has its own address as finished', () => {
    // One site, two rows: the right one and the old one kept as a redirect.
    const repaired: ZoneHost[] = [
      site('press', 'press.juniper-row.piggles.site'),
      site('press', 'press.juniper-row.sparx.zone'),
    ];
    expect(crossBrandMoves('juniper-row', 'piggles.site', repaired)).toEqual([]);
  });

  it('still moves a DIFFERENT site that has not been repaired', () => {
    // Half-done is the state a stopped run leaves, and it has to be legible.
    const halfDone: ZoneHost[] = [
      site('press', 'press.juniper-row.piggles.site'),
      site('press', 'press.juniper-row.sparx.zone'),
      site('trade', 'trade.juniper-row.sparx.zone'),
    ];
    expect(crossBrandMoves('juniper-row', 'piggles.site', halfDone).map((m) => m.siteSlug)).toEqual(
      ['trade']
    );
  });

  it('keeps the primary site on the bare address and the rest one label deeper', () => {
    const moves = crossBrandMoves('acme', 'piggles.site', [
      site('primary', 'acme.sparx.zone', true),
      site('shop', 'shop.acme.sparx.zone'),
    ]);
    expect(moves.map((m) => m.to)).toEqual(['acme.piggles.site', 'shop.acme.piggles.site']);
  });

  it('does the same for a sparx business sitting on the other brand', () => {
    // The fault is cross-BRAND, not "anything that is not sparx". A repair that
    // only knew one direction would leave the mirror case on the floor.
    const moves = crossBrandMoves('acme', 'sparx.zone', [
      site('primary', 'acme.piggles.site', true),
    ]);
    expect(moves.map((m) => m.to)).toEqual(['acme.sparx.zone']);
  });

  it('refuses to move anything for a brand whose zone is not configured', () => {
    // Guessing a zone is what wrote these rows. An unset one means "no answer",
    // never "use the default".
    expect(crossBrandMoves('juniper-row', '', juniperRow)).toEqual([]);
    expect(crossBrandMoves('juniper-row', '   ', juniperRow)).toEqual([]);
  });

  it('does not care how the zone was capitalised', () => {
    expect(crossBrandMoves('juniper-row', 'Piggles.Site', juniperRow)).toHaveLength(3);
  });
});
