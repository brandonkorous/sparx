// Every page of every SHIPPED blueprint, projected to the HTML a visitor receives.
//
// WHY A SECOND BLUEPRINT SWEEP. `blueprint-sweep.test.ts` next door grades the same
// bundles with `lintSite`, which walks the authored TREE. That is the right shape for
// the rules it owns — contrast, headings, link targets, weight — and it is structurally
// unable to see the class of defect that only exists after resolution and projection:
// an `<img>` whose source came from a binding that resolved to nothing, a merge token
// the projection did not substitute, an object stringified into markup. Those are
// properties of the RENDER, and the tree does not have them.
//
// The starter site already has this sweep (`silica-catalog/src/starter-render.test.ts`),
// and it exists because exactly that class of bug shipped: `toHtml`'s URL sanitiser drops
// `data:` on `src`, the catalog's placeholder was a data URI, and every new tenant's
// homepage drew broken-image glyphs. Asserting the shape could not have caught it;
// rendering it did.
//
// The blueprints are the same surface for everyone who does NOT take the starter — 21
// bundles, ~150 pages, and the first thing a business owner sees after choosing a look.
// They deserve the same proof, under the same conditions: nothing in the catalog yet.
// A blueprint installs before its owner has added a single product, and on a tenant
// without the commerce module it stays that way permanently.
//
// READS THE REPO, like its neighbour. The bundles are data files about to be published,
// not a package export, and a fixture would drift from what actually ships.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderSilicaSite } from '@wizeworks/silica-catalog';
import type { Node as SilicaNode, Site } from '@wizeworks/silicaui-html';

import { BLUEPRINTS, blueprintSlugs } from './blueprints-dir';

interface BundlePage {
  name: string;
  slug?: string;
  root: SilicaNode;
}

interface BundleSite {
  frame?: { root: SilicaNode } | null;
  pages: BundlePage[];
}

/** The tenant a blueprint lands on: the bundle is installed, nothing has been added yet.
 *
 *  `{ value: '' }` is the empty-catalog answer, and it is NOT interchangeable with `''`
 *  or `undefined` — `undefined` means the ref is unknown (keep the authored content),
 *  while a known ref holding nothing is the state this file is about. A bare `''` is
 *  neither: the walk reads `.value` off it, gets `undefined`, and silently tests the
 *  unknown-ref path instead. */
const EMPTY_TENANT = {
  host: { resolveBinding: () => ({ value: '' }), resolveCollection: () => [] },
} as unknown as Parameters<typeof renderSilicaSite>[1];

const bundles = blueprintSlugs;

/** One bundle's pages as a `Site` the renderer accepts. The bundles carry no page ids —
 *  ids are minted at install — so the slug stands in, which also makes a failure name
 *  the page rather than a hash. */
function siteFor(slug: string): Site {
  const bundle = JSON.parse(
    readFileSync(join(BLUEPRINTS, slug, 'site.json'), 'utf8')
  ) as BundleSite;
  return {
    // The home page carries no slug — it IS the root, which the bundles spell as an
    // absent field and the linter spells `''`. Naming it here keeps a failure readable.
    pages: bundle.pages.map((p) => {
      const slug = p.slug ?? '';
      return { id: slug === '' ? 'home' : slug, name: p.name, slug, root: p.root };
    }),
    frame: bundle.frame ?? undefined,
  } as unknown as Site;
}

/** Every way a page can be broken in its FINAL form, as a list of complaints. Returned
 *  rather than asserted one at a time so a failure prints every defect in the bundle at
 *  once — fixing these is a sweep through content, and finding them one run at a time
 *  is how a content sweep takes a day. */
function defectsIn(name: string, html: string): string[] {
  const out: string[] = [];
  const at = (what: string) => `${name}: ${what}`;

  if (html.length < 100) out.push(at(`rendered ${html.length} bytes — effectively nothing`));

  for (const tag of html.match(/<img[^>]*>/g) ?? []) {
    const src = /\ssrc="([^"]*)"/.exec(tag)?.[1];
    const snippet = tag.slice(0, 90);
    // An `<img>` with no usable src is the browser's broken-image glyph. The placeholder
    // counts as a real source; a missing or empty attribute does not.
    if (!src) out.push(at(`<img> with no src — ${snippet}`));
    else if (src.startsWith('data:')) out.push(at(`data: src, which toHtml drops — ${snippet}`));
  }

  // Half-rendered values, in the two shapes they take once inside markup.
  if (html.includes('[object Object]')) out.push(at('an object stringified into the markup'));
  if (html.includes('{{')) out.push(at('an unsubstituted {{token}}'));
  // `href=""` is an anchor that silently reloads the page — worse than no link, because
  // it still looks clickable. `dropEmptyUrlAttrs` exists to remove these.
  if (html.includes('href=""')) out.push(at('href="" — a link that reloads the page'));

  return out;
}

describe('every shipped blueprint renders clean for a tenant who has added nothing', () => {
  it('finds bundles and pages to render at all', () => {
    // Guard on the guard: a glob that stops matching would make every case below pass
    // by vacuity.
    const all = bundles();
    expect(all.length).toBeGreaterThanOrEqual(10);
    expect(siteFor(all[0] ?? '').pages.length).toBeGreaterThanOrEqual(3);
  });

  it.each(bundles())('%s', (slug) => {
    const rendered = renderSilicaSite(siteFor(slug), EMPTY_TENANT);
    expect(rendered.length, `${slug} rendered no pages`).toBeGreaterThan(0);
    const defects = rendered.flatMap((p) =>
      defectsIn(`${slug}/${p.slug === '' ? 'home' : p.slug}`, p.html)
    );
    // Joined so a failure prints the defects themselves rather than a count.
    expect(defects.join('\n')).toBe('');
  });
});
