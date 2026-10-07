// Every row in the editor's Insert list has its own key.
//
// MEASURED 2026-10-06 (sparx persona P01, Gillett Diesel): searching Insert for
// "location" listed silica's built-in Timeline and sparx's "How it works ›
// Timeline" section, both keyed `timeline`. React warned "two children with the
// same key", and a drag carries only the key, so dropping the section looked up
// the first row with that key and placed the built-in one instead. The sections
// sparx adds merge into silica's own list, so a key has to be free in BOTH.

import { describe, expect, it } from 'vitest';
import { mergeCatalog, paletteGroups, type PaletteGroup } from '@wizeworks/silicaui-builder/react';
import { SITE_CATALOG, SPARX_CATALOG } from '@wizeworks/silica-catalog';

describe('the Insert list', () => {
  it('gives every row a key no other row has', () => {
    const groups = mergeCatalog(paletteGroups(), {
      extend: [...SPARX_CATALOG, ...SITE_CATALOG] as unknown as PaletteGroup[],
    });
    const owners = new Map<string, string[]>();
    for (const group of groups) {
      for (const item of group.items) {
        owners.set(item.key, [...(owners.get(item.key) ?? []), `${group.label} › ${item.label}`]);
      }
    }
    const shared = [...owners].filter(([, rows]) => rows.length > 1);
    expect(shared).toEqual([]);
    // The denominator, so an empty catalog cannot pass.
    expect(owners.size).toBeGreaterThan(150);
  });
});
