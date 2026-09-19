// A WHERE-USED LIST THAT CANNOT SAY WHICH SITE.
//
// The component library is TENANT-scoped by design (docs/53) — one library, every
// site the tenant runs. Pages are the opposite: each belongs to exactly one site.
// So the where-used scan legitimately crosses sites, and it returned page NAMES.
//
// Measured 2026-09-17: one tenant with six sites had six pages called "Contact".
// Its console showed the list under the words "Click one to open it", and opening
// a page id from another site resolves to nothing — the editor answers "This page
// isn't here any more. It may have been deleted." It has not been deleted.

import { describe, expect, it } from 'vitest';

import { withSites } from './component-service';

const CONTACT_HERE = { id: 'p1', name: 'Contact', propertyId: 'site-shop' };
const CONTACT_THERE = { id: 'p2', name: 'Contact', propertyId: 'site-archive' };

const names = new Map([
  ['site-shop', 'Juniper Row'],
  ['site-archive', 'Juniper Row Archive'],
]);

describe('two placements with one name', () => {
  it('carries the site that tells them apart', () => {
    const [here, there] = withSites([CONTACT_HERE, CONTACT_THERE], names);
    expect(here?.siteName).toBe('Juniper Row');
    expect(there?.siteName).toBe('Juniper Row Archive');
  });

  it('gives them different sites, which is the entire job', () => {
    const rows = withSites([CONTACT_HERE, CONTACT_THERE], names);
    expect(rows[0]?.siteName).not.toBe(rows[1]?.siteName);
    expect(rows[0]?.siteId).not.toBe(rows[1]?.siteId);
  });

  it('carries the id as well as the name, because the console opens by id', () => {
    // The name is for reading; the id is what a site switch is aimed at. A row
    // with one and not the other is a row that can be understood or followed,
    // never both.
    const [here] = withSites([CONTACT_HERE], names);
    expect(here?.siteId).toBe('site-shop');
  });
});

describe('a placement whose site has gone', () => {
  it('still says which one, by id', () => {
    // Never a blank: "no site" is not a state a page can be in, and a row that
    // renders as though it had none hides a broken record instead of showing it.
    const [orphan] = withSites([{ id: 'p3', name: 'Contact', propertyId: 'site-vanished' }], names);
    expect(orphan?.siteName).toBe('site-vanished');
    expect(orphan?.siteId).toBe('site-vanished');
  });
});

describe('nothing to place', () => {
  it('is an empty list, not a row', () => {
    expect(withSites([], names)).toEqual([]);
  });
});
