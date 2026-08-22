// What counts as the home page — and why getting it narrow costs an EXTRA page.
//
// A slugless singleton is the site root, and the store spells "slugless" three
// ways: NULL (a sparx-seeded home), '' (a blueprint-installed one) and '/' (an
// import). `listOrSeed` heals a home-less property by injecting the starter
// landing page, so a rule that recognises only NULL reads a blueprint-installed
// home as absent and injects a SECOND home beside it.
//
// Found by driving it: a bakery installed the Café look, got two pages both
// claiming `/`, the pre-publish check said so, and deleting the injected one
// reported success and then re-created it — with a new id — on the very next list
// read. A delete that undoes itself.

import { describe, expect, it } from 'vitest';

import { homeWhere, isHomeRow } from './page-service';

describe('isHomeRow', () => {
  it.each([[null], [''], ['/']])('treats a singleton with slug %j as the home page', (slug) => {
    expect(isHomeRow({ kind: 'singleton', slug })).toBe(true);
  });

  it('does not treat a page with a real address as the home page', () => {
    expect(isHomeRow({ kind: 'singleton', slug: 'menu' })).toBe(false);
    expect(isHomeRow({ kind: 'singleton', slug: '/menu' })).toBe(false);
  });

  it('does not treat a record template as the home page', () => {
    // A collection carries no slug of its own and there can be many of them —
    // counting one as the home is how ten product templates become ten homes.
    expect(isHomeRow({ kind: 'collection', slug: null })).toBe(false);
  });
});

describe('homeWhere', () => {
  it('asks for every spelling the store uses, not just NULL', () => {
    // The assertion is on the SHAPE rather than on a database, because the failure
    // this guards is a narrowing edit — someone writing `slug: null` back in.
    const where = homeWhere('property-1');
    expect(where.kind).toBe('singleton');
    expect(where.propertyId).toBe('property-1');
    expect(where.OR).toEqual([{ slug: null }, { slug: { in: ['', '/'] } }]);
  });
});
