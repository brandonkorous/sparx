// Every SHIPPED blueprint's bands on the house page measure (piggles persona issue 950).
//
// WHY THIS EXISTS. The house measure puts the gutter inside the 6xl box
// (`mx-auto max-w-6xl px-6`), so every band, the header and the footer start their content
// on one left edge. When that was decided, 88 of the 191 bundles shipped bands the other
// way: 651 with the gutter on the band, 152 picture bands that widened it on a desktop,
// and 22 copies of a captured full-width header. Each installed into a tenant's site, so
// each was a page whose heading started 24px off its own header on a wide screen.
//
// WHAT IT ASSERTS. The bundle AS SHIPPED, not after a heal: a tenant installing a design
// gets these bytes, and the studio-load heal only runs on pages she later opens. The
// generators run `insideMeasure` on every page they emit, so a regenerated bundle stays
// clean; this is what goes red if a bundle is ever written some other way (the captured
// golden `sparx`, a hand edit, a new emit path that skips the harness).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  isCapturedHeader,
  isOutsideMeasureBand,
  isWidenedMeasure,
} from '@wizeworks/silica-catalog';
import type { Node } from '@wizeworks/silicaui-html';
import { describe, expect, it } from 'vitest';

import { BLUEPRINTS, blueprintSlugs } from './blueprints-dir';

interface SiteDecl {
  frame?: { root: Node } | null;
  pages?: { name?: string; root: Node }[];
}

/** Every node in a tree that is in one of the old measure shapes, named for the report,
 *  plus how many house-measure boxes the walk saw (so a walk that sees nothing cannot
 *  pass). */
function stale(root: Node, where: string, out: string[], seen: { measures: number }): void {
  if (!root || typeof root !== 'object' || root.kind !== 'element') return;
  const cls = ` ${root.class ?? ''} `;
  if (cls.includes(' max-w-6xl ') && cls.includes(' px-6 ')) seen.measures += 1;
  if (isOutsideMeasureBand(root)) out.push(`${where} · gutter outside the box: "${root.class}"`);
  if (isWidenedMeasure(root)) out.push(`${where} · wider gutter on a desktop: "${root.class}"`);
  if (isCapturedHeader(root)) out.push(`${where} · full-width header: "${root.class}"`);
  for (const child of root.children ?? []) {
    if (typeof child !== 'string') stale(child, where, out, seen);
  }
}

describe('every shipped design starts its content on one left edge', () => {
  it('has no band drawn the old way, in any frame or page', () => {
    const found: string[] = [];
    const seen = { measures: 0 };
    for (const slug of blueprintSlugs()) {
      const site = JSON.parse(
        readFileSync(join(BLUEPRINTS, slug, 'site.json'), 'utf8')
      ) as SiteDecl;
      if (site.frame?.root) stale(site.frame.root, `${slug} frame`, found, seen);
      for (const page of site.pages ?? []) {
        stale(page.root, `${slug} ${page.name ?? 'page'}`, found, seen);
      }
    }
    // A guard on the guard: every design's header and footer alone are hundreds of house
    // measures, so a walk that saw none read nothing.
    expect(seen.measures).toBeGreaterThan(500);
    expect(found).toEqual([]);
  });
});
