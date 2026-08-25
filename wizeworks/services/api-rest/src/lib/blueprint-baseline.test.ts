// A design can be installed WITHOUT its examples (issue 098), and this pins the
// one seam that decides what "an example" is.
//
// WHY THE BASELINE AND NOT THE INSTALLER. The slices are what skip the rows, but
// the baseline is what a later UPDATE reads to decide which artifacts the design
// declares. Miss it there and the examples come back through the side door: the
// updater sees "an artifact this version adds", creates it, and hands the owner
// the furniture she turned down months earlier. So the filter has to hold on both
// sides of the merge, and this asserts the side that is easy to forget.
//
// Run against the REAL shipped bundles rather than a fixture, so a new pack that
// invents a new kind of example row cannot quietly pass.

import { describe, expect, it } from 'vitest';

import { loadFirstPartyBlueprints } from './marketplace/blueprint-bundles.js';
import {
  EXAMPLE_ARTIFACT_KINDS,
  resolveBlueprintArtifacts,
  type ArtifactKind,
} from './blueprint-baseline.js';
import type { InstallResult } from './blueprint-installer.js';

const bundles = await loadFirstPartyBlueprints();

/** An id-map standing in for what an install with the examples ON would produce:
 *  every declared handle mapped to some id, so every artifact resolves. */
function fullResult(bp: (typeof bundles)[number]['blueprint']): InstallResult {
  const commerce = bp.commerce;
  return {
    assets: {},
    categories: Object.fromEntries((commerce?.categories ?? []).map((c) => [c.handle, c.handle])),
    collections: Object.fromEntries((commerce?.collections ?? []).map((c) => [c.handle, c.handle])),
    products: (commerce?.products ?? []).map((p) => ({ handle: p.handle, id: p.handle })),
    theme: { id: 'theme', name: bp.theme.name },
    pages: (bp.site?.pages ?? []).map((pg) => ({
      name: pg.name,
      id: pg.name,
      recordType: pg.recordType ?? null,
      recordSubtype: pg.recordSubtype ?? null,
      slug: pg.slug ?? null,
    })),
    emails: bp.emails.map((e) => ({ name: e.name, id: e.name })),
    sequences: [],
    content: bp.content.map((c) => ({ typeKey: c.typeKey, slug: c.slug ?? null, id: c.typeKey })),
    scheduling: null,
    counts: {},
  };
}

const kindsOf = (bp: (typeof bundles)[number]['blueprint'], sampleData: boolean): ArtifactKind[] =>
  resolveBlueprintArtifacts(bp, fullResult(bp), new Map(), { sampleData }).map((a) => a.kind);

describe('resolveBlueprintArtifacts and the examples choice', () => {
  it('has bundles that actually declare examples, so the checks below are not vacuous', () => {
    const withExamples = bundles.filter(
      (b) => (b.blueprint.commerce?.products.length ?? 0) > 0 || b.blueprint.content.length > 0
    );
    expect(withExamples.length).toBeGreaterThan(0);
  });

  it('declines nothing by default — the examples come unless someone says otherwise', () => {
    for (const b of bundles) {
      expect(resolveBlueprintArtifacts(b.blueprint, fullResult(b.blueprint), new Map())).toEqual(
        resolveBlueprintArtifacts(b.blueprint, fullResult(b.blueprint), new Map(), {
          sampleData: true,
        })
      );
    }
  });

  it('drops the example kinds and keeps every other one', () => {
    for (const b of bundles) {
      const withExamples = kindsOf(b.blueprint, true);
      const without = kindsOf(b.blueprint, false);

      // Nothing structural is lost: the theme, the brand, the frame, the pages,
      // the emails, the categories and the collections all survive intact. This is
      // the half that matters — "structure without furniture" is worthless if the
      // structure goes with it.
      const structural = (k: ArtifactKind) => !EXAMPLE_ARTIFACT_KINDS.has(k);
      expect(without).toEqual(withExamples.filter(structural));

      // And the examples really are gone, not merely reordered.
      expect(without.filter((k) => EXAMPLE_ARTIFACT_KINDS.has(k))).toEqual([]);
    }
  });

  it('leaves a design that ships no examples completely unchanged', () => {
    const bare = bundles.filter(
      (b) => (b.blueprint.commerce?.products.length ?? 0) === 0 && b.blueprint.content.length === 0
    );
    for (const b of bare) {
      expect(kindsOf(b.blueprint, false)).toEqual(kindsOf(b.blueprint, true));
    }
  });
});
