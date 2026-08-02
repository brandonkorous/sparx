// Guards the first-party blueprint bundles at CI time.
//
// WHY THIS SUITE EARNS ITS RUNTIME. `loadFirstPartyBlueprints` is deliberately
// all-or-nothing: one unreadable bundle aborts the whole publish, because a bundle
// that failed to load is indistinguishable from a bundle sparx withdrew, and a
// tolerant pass would retract a listing for a blueprint that is merely broken.
//
// That safety has a cost — a malformed bundle takes the catalog refresh down with
// it. This suite is what pays it: the bundles are validated in CI, so the failure
// lands on a pull request instead of on a booting pod in production.

import { describe, expect, it } from 'vitest';

import { blueprintContents, loadFirstPartyBlueprints } from './blueprint-bundles.js';

// One load for the whole suite (~700ms for 21 bundles) — the module cache makes a
// per-test reload free, but the parse work is not, and every assertion below reads
// the same objects.
const bundles = await loadFirstPartyBlueprints();

describe('first-party blueprint bundles', () => {
  it('ships a catalog', () => {
    // A zero here means the bundle tree did not resolve — the same silent "published
    // nothing, reported success" that left production's theme catalog empty for a
    // month. It must fail the build, not read as "no blueprints configured".
    expect(bundles.length).toBeGreaterThan(0);
  });

  it('every bundle validates, and its manifest agrees with its payload', () => {
    // loadFirstPartyBlueprints already throws on a schema failure, a slug mismatch,
    // a version disagreement or missing card imagery — reaching here IS the pass.
    // Asserted explicitly so the intent survives a refactor of the loader.
    for (const b of bundles) {
      expect(b.manifest.slug).toBe(b.slug);
      expect(b.blueprint.key).toBe(b.slug);
      expect(b.blueprint.version).toBe(b.manifest.version);
    }
  });

  it('has unique slugs', () => {
    // `slug` is the upsert key AND the storage path segment, so a duplicate would
    // silently overwrite rather than publish two listings.
    expect(new Set(bundles.map((b) => b.slug)).size).toBe(bundles.length);
  });

  it('ships an icon and a preview, preview first', () => {
    for (const b of bundles) {
      const kinds = b.media.map((m) => m.kind);
      expect(kinds).toContain('icon');
      expect(kinds).toContain('preview');
      // The card and the detail hero both read media[0]; an icon in that slot renders
      // a postage stamp where a screenshot belongs.
      expect(kinds[0]).toBe('preview');
      for (const m of b.media) expect(m.bytes.byteLength).toBeGreaterThan(0);
    }
  });

  it('projects contents the catalog card can render', () => {
    for (const b of bundles) {
      const c = blueprintContents(b.blueprint);
      expect(typeof c.theme).toBe('string');
      expect(typeof c.hasFrame).toBe('boolean');
      for (const key of ['products', 'categories', 'collections', 'content', 'pages', 'emails']) {
        expect(Number.isInteger(c[key])).toBe(true);
      }
    }
  });

  it('fits the catalog row columns', () => {
    for (const b of bundles) {
      // `tagline` is VarChar(255) and the publish path slices to it — assert the
      // source is already within range so nothing is silently truncated.
      expect(b.manifest.tagline.length).toBeLessThanOrEqual(255);
      expect(b.manifest.name.length).toBeLessThanOrEqual(160);
      if (b.manifest.accent) expect(b.manifest.accent.length).toBeLessThanOrEqual(9);
    }
  });
});
