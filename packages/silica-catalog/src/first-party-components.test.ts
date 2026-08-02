// The bar for the shipped component catalog. Components are CODE now, so the
// failure mode is no longer "the ingest didn't run against that cluster" — it is a
// section reaching the public marketplace with no preview, no tagline, or a Purpose
// facet nobody authored. That is what this file catches, at build time, on every
// section, which is what nothing did while 25 of production's 96 listings were junk.

import { describe, expect, it } from 'vitest';
import { SPARX_CATALOG } from './catalog';
import {
  FIRST_PARTY_COMPONENTS,
  GROUP_FACET,
  componentSlug,
  firstPartyComponent,
  isFirstPartyComponentSlug,
} from './first-party-components';

const catalogItems = SPARX_CATALOG.flatMap((g) => g.items);

describe('first-party component catalog', () => {
  it('lists every section in the Insert palette, and nothing else', () => {
    expect(FIRST_PARTY_COMPONENTS).toHaveLength(catalogItems.length);
    expect(FIRST_PARTY_COMPONENTS.map((c) => c.key).sort()).toEqual(
      catalogItems.map((i) => i.key).sort()
    );
  });

  // The reason this exists: a group with no facet label used to THROW inside the
  // generator, which is only reached by a person running a script. A new catalog
  // group now fails the build instead.
  it('has a Purpose facet for every catalog group', () => {
    const missing = SPARX_CATALOG.filter((g) => !GROUP_FACET[g.key]).map((g) => g.key);
    expect(missing).toEqual([]);
  });

  it('keeps slugs unique, kebab-case, and derived from the palette key', () => {
    const slugs = FIRST_PARTY_COMPONENTS.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const c of FIRST_PARTY_COMPONENTS) {
      expect(c.slug, c.key).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(c.slug).toBe(componentSlug(c.key));
    }
  });

  // 15 of production's 96 listings were PascalCase `BuilderNode` palette pointers.
  // A slug that is not kebab-case is that shape leaking back in.
  it('ships no PascalCase BuilderNode pointers', () => {
    expect(FIRST_PARTY_COMPONENTS.filter((c) => /^[A-Z]/.test(c.slug))).toEqual([]);
  });

  // 25 of 96 listings rendered a grey placeholder because their row carried no tree.
  // Deriving from `make()` means a listing cannot exist without one — asserted so it
  // stays that way.
  it('carries a real node tree for every section, so every card previews live', () => {
    for (const c of FIRST_PARTY_COMPONENTS) {
      expect(c.tree, c.slug).toBeTruthy();
      expect(typeof c.tree, c.slug).toBe('object');
      expect((c.tree as { kind?: string }).kind, c.slug).toBeTruthy();
    }
  });

  it('writes a name and a tagline for every section', () => {
    for (const c of FIRST_PARTY_COMPONENTS) {
      expect(c.name, c.slug).toMatch(/\S/);
      expect(c.tagline, c.slug).toMatch(/\S/);
      expect(c.tagline, c.slug).not.toMatch(/lorem|TODO|TBD/i);
      expect(c.group, c.slug).toMatch(/\S/);
    }
  });

  // The `group` column is varchar(20) — the facet labels exist precisely because the
  // catalog's own group labels overflow it.
  it('keeps every Purpose facet inside the column width', () => {
    for (const label of Object.values(GROUP_FACET)) {
      expect(label.length, label).toBeLessThanOrEqual(20);
    }
  });

  it('orders browse the way the palette orders insert', () => {
    const weights = FIRST_PARTY_COMPONENTS.map((c) => c.sortWeight);
    expect(weights).toEqual([...weights].sort((a, b) => b - a));
  });

  it('looks a section up by slug, and reports first-party ownership', () => {
    const first = FIRST_PARTY_COMPONENTS[0]!;
    expect(firstPartyComponent(first.slug)?.key).toBe(first.key);
    expect(isFirstPartyComponentSlug(first.slug)).toBe(true);
    // The guard that stops an uploaded row shadowing a shipped section.
    expect(isFirstPartyComponentSlug('a-component-a-tenant-uploaded')).toBe(false);
    expect(firstPartyComponent('a-component-a-tenant-uploaded')).toBeUndefined();
  });
});
