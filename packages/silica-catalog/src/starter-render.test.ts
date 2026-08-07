// The starter site, projected to the HTML a real first-time visitor receives.
//
// `site.test.ts` and `starter-binds.test.ts` assert the starter's SHAPE — which pages
// exist, what binds to what — and `vocabulary-check.test.ts` its class vocabulary. None
// of them ran it through `renderSilicaPage`. So the whole first-run surface, the only
// thing every brand-new tenant is guaranteed to have, was never once turned into HTML by
// a test.
//
// That is exactly how the broken images shipped: the starter's product cards resolve
// `image` to nothing on a site with an empty catalog, `toHtml`'s sanitiser drops the
// `data:` placeholder the card authors, and every new tenant's homepage drew two
// broken-image glyphs. Rendering the shape would have caught it; asserting the shape
// could not.
//
// So this renders EVERY starter page under the conditions a new tenant actually has —
// no products, no posts, nothing bound — and asserts the things that must hold for a
// page you would be happy to show someone on day one.

import { describe, expect, it } from 'vitest';

import { renderSilicaPage } from './render';
import { starterSite } from './site';

/** A brand-new tenant: every module on (so the widest starter renders), and nothing in
 *  the database yet. `resolveBinding` returning '' is what an empty catalog looks like
 *  to the renderer — the single most common state a new site is in, and the one the
 *  broken images lived in. */
const EMPTY_TENANT = {
  host: {
    // `{ value: '' }`, not `''` and not `undefined`, and the three are different
    // states the walk treats differently: `undefined` means the ref is UNKNOWN (keep
    // the authored content, fire a diagnostic), while a known ref holding nothing is
    // the legitimate empty-catalog answer this file is about. A bare `''` is neither —
    // the walk reads `.value` off it and gets `undefined`, so it silently tests the
    // unknown-ref path instead of the empty one.
    resolveBinding: () => ({ value: '' }),
    resolveCollection: () => [],
  },
} as unknown as Parameters<typeof renderSilicaPage>[2];

const SITE = starterSite(undefined, {
  commerceEnabled: true,
  schedulingEnabled: true,
  cmsEnabled: true,
});

const PAGES = SITE.pages.map((p) => [p.name || p.slug || p.id, p.id] as const);

describe('the starter site renders for a brand-new tenant', () => {
  it('ships pages worth rendering', () => {
    // Guard on the guard: if the starter ever collapses to a single page, every
    // assertion below would pass by vacuity.
    expect(PAGES.length).toBeGreaterThanOrEqual(5);
  });

  it.each(PAGES)('%s', (name, id) => {
    const html = renderSilicaPage(SITE, id, EMPTY_TENANT);
    expect(html, name).toBeTypeOf('string');
    const out = html ?? '';
    expect(out.length, name).toBeGreaterThan(100);

    // THE regression this file exists for. An `<img>` with no usable `src` is the
    // browser's broken-image glyph, and on the starter it is the first thing a new
    // tenant sees. Every image must carry a real source — the placeholder counts,
    // a missing or empty attribute does not.
    for (const tag of out.match(/<img[^>]*>/g) ?? []) {
      const src = /\ssrc="([^"]*)"/.exec(tag)?.[1];
      expect(src, `${name}: <img> with no src — ${tag.slice(0, 90)}`).toBeTruthy();
      expect(src?.startsWith('data:'), `${name}: data: src is dropped by toHtml`).toBe(false);
    }

    // NOT asserted: the absence of `data-sui-bind`. On an empty catalog the product
    // grid still renders one template card and its markers survive, which is the
    // deliberate "here is what your shop will look like" scaffolding — and the card
    // correctly loses its `href` rather than becoming a link to nowhere. Both are
    // intended, so pinning them would only make this file fight the design.

    // Half-rendered values, in the two shapes they take once inside markup.
    expect(out, name).not.toContain('[object Object]');
    expect(out, name).not.toContain('{{');

    // `href=""` is an anchor that silently reloads the page — worse than no link,
    // because it looks clickable. `dropEmptyUrlAttrs` exists to remove these.
    expect(out, name).not.toContain('href=""');
  });
});
