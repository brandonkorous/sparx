// Finding what you sell, by whatever you happen to know about it. Issue 749.
//
// The box searched the PRODUCT NAME alone, and 2,030 of the 2,384 sellable
// versions on this machine share theirs — so for 85% of what a maker sells, the
// part that identifies it was the part the box refused to read.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { matchingSellables, sellableMatches } from './sale-sellable-search';

const MARLOW = { name: 'Marlow Knit', detail: 'XL · Moss', sku: 'MARLOW-KNIT-XL-MOSS' };
const MARLOW_L = { name: 'Marlow Knit', detail: 'L · Oat', sku: 'MARLOW-KNIT-L-OAT' };
const FITTING = { name: 'Fitting', detail: '45 minutes', sku: null };

describe('sellableMatches', () => {
  it('finds a version by the part that tells it from its siblings', () => {
    // The whole issue: eight Marlow Knits on screen and "Marlow Knit XL" found
    // nothing, because only the product name was searched.
    expect(sellableMatches(MARLOW, 'Marlow Knit XL')).toBe(true);
    expect(sellableMatches(MARLOW_L, 'Marlow Knit XL')).toBe(false);
  });

  it('finds one by the code on the box', () => {
    expect(sellableMatches(MARLOW, 'MARLOW-KNIT-XL-MOSS')).toBe(true);
  });

  it('does not care what order the words come in', () => {
    // Nobody at a counter types a catalog string in catalog order.
    expect(sellableMatches(MARLOW, 'moss marlow')).toBe(true);
  });

  it('ignores case, both ways', () => {
    expect(sellableMatches(MARLOW, 'marlow-knit-xl-moss')).toBe(true);
    expect(sellableMatches({ ...MARLOW, name: 'marlow knit' }, 'MARLOW')).toBe(true);
  });

  it('still matches the plain product name', () => {
    expect(sellableMatches(MARLOW, 'Marlow')).toBe(true);
    expect(sellableMatches(MARLOW_L, 'Marlow')).toBe(true);
  });

  it('shows everything before anybody types', () => {
    expect(sellableMatches(MARLOW, '')).toBe(true);
    expect(sellableMatches(MARLOW, '   ')).toBe(true);
  });

  it('survives a row with no version and no code', () => {
    expect(sellableMatches({ name: 'Repair' }, 'repair')).toBe(true);
    expect(sellableMatches({ name: 'Repair' }, 'XL')).toBe(false);
  });

  it('matches an appointment by how long it takes', () => {
    expect(sellableMatches(FITTING, 'fitting 45')).toBe(true);
  });

  it('refuses a word that lands nowhere', () => {
    // Every word has to land. Otherwise "Marlow cushion" returns the jumper.
    expect(sellableMatches(MARLOW, 'Marlow cushion')).toBe(false);
  });

  it('keeps a row the server found by a name the row does not draw', () => {
    // The server searches a version's own name too (issue 069). A row it found
    // for "winter" must not then be dropped here because only the options show.
    const named = { ...MARLOW, keywords: 'Winter edition' };
    expect(sellableMatches(named, 'marlow winter')).toBe(true);
    expect(sellableMatches(MARLOW, 'marlow winter')).toBe(false);
  });
});

describe('matchingSellables', () => {
  const many = Array.from({ length: 40 }, (_, i) => ({
    name: 'Marlow Knit',
    detail: `size ${String(i)}`,
    sku: null,
  }));

  it('keeps the box a box rather than a catalog', () => {
    expect(matchingSellables(many, 'Marlow')).toHaveLength(12);
  });

  it('honours a smaller cap', () => {
    expect(matchingSellables(many, 'Marlow', 3)).toHaveLength(3);
  });

  it('returns the rows in the order it was given them', () => {
    const rows = matchingSellables([MARLOW_L, MARLOW], 'marlow');
    expect(rows.map((r) => r.detail)).toEqual(['L · Oat', 'XL · Moss']);
  });
});

/* ── The picker actually uses it ─────────────────────────────────────────── */

function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 12; i += 1) {
    try {
      readFileSync(join(dir, 'pnpm-workspace.yaml'));
      return dir;
    } catch {
      dir = dirname(dir);
    }
  }
  throw new Error('pnpm-workspace.yaml not found above this test');
}

describe('the item picker', () => {
  const pane = () =>
    readFileSync(
      join(repoRoot(), 'piggles/apps/workbench/surfaces/commerce/sale-lines.tsx'),
      'utf8'
    );

  it('searches through this file rather than the name alone', () => {
    const body = pane();
    expect(body).toContain('matchingSellables(items, term)');
    expect(body).not.toContain('item.name.toLowerCase().includes(term)');
  });

  it('stops inviting her to retype something she already sells', () => {
    // "Nothing you sell is called X. Add it by hand below." is how a jumper with
    // an agreed price becomes a one-off at whatever gets typed — issue 737
    // walking back in through the search box.
    expect(pane()).not.toContain('is called “');
  });
});
