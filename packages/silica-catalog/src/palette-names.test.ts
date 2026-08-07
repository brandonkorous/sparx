// The Add palette is ONE flat, searchable list, and nothing in it de-duplicates.
//
// Three separate sources feed it — silicaui's own primitive groups, sparx's
// `SPARX_CATALOG` section blocks, and the `HOST_COMPONENTS` cores — and the engine
// appends all three without ever comparing a label. So a name chosen in one file
// collides silently with a name chosen in another, and the only symptom is an author
// searching "map", getting two identical rows, and picking the wrong one half the time.
//
// That is not hypothetical: `site.map` and `map_embed` both shipped as "Map", and
// `site.embed` and `other_embed` both shipped as "Embed from another site" — found by
// opening the palette in production, not by any test. These assertions are the test that
// would have caught it.
//
// `0.51.0` fixed the ENGINE side of this (host rows now carry their icon and hint, the
// category resolves against the built-in groups instead of shadowing one, and `hide`
// finally reaches a `host:*` key). None of that dedupes LABELS — the engine still has no
// reason to care that two hosts named two different things the same — so these stay.

import { describe, expect, it } from 'vitest';

import { SPARX_CATALOG } from './catalog';
import { HOST_COMPONENTS } from './host-nodes';

/** silicaui's built-in palette group headings (`paletteGroups()` in the builder engine).
 *  A host `category` equal to one of these draws a SECOND section under the same
 *  heading rather than merging — the engine only merges groups by KEY, and a host
 *  group's key is always `hostcat:<slug>`. */
const ENGINE_GROUP_LABELS = [
  'Layout',
  'Content',
  'Form',
  'Navigation',
  'Overlay',
  'Feedback',
  'Data',
  'Media',
  'Interactive',
  'Sections',
];

const catalogItems = SPARX_CATALOG.flatMap((g) =>
  g.items.map((i) => ({ label: i.label, where: `${g.key}/${i.key}` }))
);
const hostItems = HOST_COMPONENTS.map((c) => ({ label: c.label, where: `host/${c.key}` }));

describe('Add palette names', () => {
  it('gives every host core a label no catalog block already uses', () => {
    const catalogLabels = new Map(catalogItems.map((i) => [i.label, i.where]));
    const collisions = hostItems
      .filter((h) => catalogLabels.has(h.label))
      .map((h) => `"${h.label}" — ${h.where} vs ${catalogLabels.get(h.label)}`);
    expect(collisions).toEqual([]);
  });

  it('uses each label exactly once across everything sparx contributes', () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const { label, where } of [...catalogItems, ...hostItems]) {
      const prior = seen.get(label);
      if (prior) dupes.push(`"${label}" — ${where} vs ${prior}`);
      else seen.set(label, where);
    }
    expect(dupes).toEqual([]);
  });

  it('keeps host group headings clear of silicaui’s own group names', () => {
    const clashing = [...new Set(HOST_COMPONENTS.map((c) => c.category))].filter((c) =>
      ENGINE_GROUP_LABELS.some((g) => g.toLowerCase() === c.toLowerCase())
    );
    expect(clashing).toEqual([]);
  });

  it('writes host group headings as display copy, not slugs', () => {
    // `category` is rendered VERBATIM as the group heading (the engine does
    // `def.category ?? "Host"` and uses it as the label), so a lowercase slug ships as a
    // lowercase heading sitting beside properly-cased ones.
    const notTitleCase = [...new Set(HOST_COMPONENTS.map((c) => c.category))].filter(
      (c) => !/^[A-Z]/.test(c)
    );
    expect(notTitleCase).toEqual([]);
  });
});
