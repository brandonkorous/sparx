// Insert offers what a business owner came for BEFORE what a developer came for.
//
// The order was measured on a real shop before this existed: 118 rows and about six
// screens of scrolling stood between opening Insert and the first group written in
// her own language. These tests pin the order, and the last one pins the reason the
// hoist is keyed rather than positional.

import { describe, expect, it } from 'vitest';
import { paletteGroups, type PaletteGroup } from '@wizeworks/silicaui-builder/react';
import { hostFirst } from './palette';

const group = (key: string, label = key): PaletteGroup => ({ key, label, items: [] });

const labels = (groups: readonly PaletteGroup[]): string[] => groups.map((g) => g.key);

describe('Insert leads with the groups a shop owner can read', () => {
  it('puts a host group ahead of every framework group', () => {
    const base = paletteGroups();
    const extend = [group('sparx_place'), group('sparx_convert')];
    const merged = [...base, ...extend];

    const out = labels(hostFirst(merged, { extend }));

    expect(out.slice(0, 2)).toEqual(['sparx_place', 'sparx_convert']);
    expect(out.indexOf('sparx_place')).toBeLessThan(out.indexOf(base[0]!.key));
  });

  it('keeps the host list in the order the host chose', () => {
    const extend = [group('a_first'), group('b_second'), group('c_third')];
    const out = labels(hostFirst([...paletteGroups(), ...extend], { extend }));
    expect(out.slice(0, 3)).toEqual(['a_first', 'b_second', 'c_third']);
  });

  it('loses nothing — every group survives the reorder', () => {
    const extend = [group('sparx_place')];
    const merged = [...paletteGroups(), ...extend];
    const out = hostFirst(merged, { extend });
    expect(out).toHaveLength(merged.length);
    expect([...labels(out)].sort()).toEqual([...labels(merged)].sort());
  });

  it('leaves the order alone when a host contributes nothing', () => {
    const merged = paletteGroups();
    expect(labels(hostFirst(merged, undefined))).toEqual(labels(merged));
    expect(labels(hostFirst(merged, { extend: [] }))).toEqual(labels(merged));
  });

  it('does NOT hoist a group the framework already owns', () => {
    // `mergeCatalog` folds a same-key contribution INTO the framework's group, so
    // hoisting that key would drag the framework's own rows to the top with it.
    const first = paletteGroups()[0]!;
    const extend = [group(first.key, 'A host addition to an existing group')];
    const out = labels(hostFirst(paletteGroups(), { extend }));
    expect(out).toEqual(labels(paletteGroups()));
  });
});
