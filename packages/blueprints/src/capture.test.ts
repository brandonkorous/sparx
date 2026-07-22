import { describe, expect, it } from 'vitest';

import { captureSite, type CapturedSiteInput } from './capture';

// A silica node is opaque to sparx — validated structurally as an object carrying a
// string `kind` (site-sync.ts `SilicaTreeInput`). These stand in for real trees.
const node = (kind: string) => ({ kind }) as never;

/** A live site with the two page shapes a capture must handle: a home singleton
 *  (stored slug `'/'`) and a collection template bound to a recordType. */
function baseSite(): CapturedSiteInput {
  return {
    pages: [
      { id: 'row_home', name: 'Home', slug: '/', root: node('page'), kind: 'singleton' },
      {
        id: 'row_product',
        name: 'Product',
        slug: 'product',
        root: node('page'),
        kind: 'collection',
        recordType: 'commerce.product',
        isDefault: true,
        seoTitle: 'Buy it',
      },
    ],
    frame: { root: node('frame') },
    theme: { name: 'Ember', tokens: { '--color-primary': '#e04631' } },
    symbols: { sym_1: { kind: 'symbol' } },
  };
}

describe('captureSite', () => {
  it('drops runtime row ids (the handle-not-id rule)', () => {
    const decl = captureSite(baseSite());
    for (const p of decl.pages) {
      expect(p).not.toHaveProperty('id');
    }
  });

  it("normalizes the home slug '/' to an omitted slug", () => {
    const decl = captureSite(baseSite());
    const home = decl.pages[0]!;
    expect(home.slug).toBeUndefined();
  });

  it.each([['/'], [''], [null]])('treats stored slug %j as the home page', (slug) => {
    const decl = captureSite({ pages: [{ name: 'Home', slug, root: node('page') }] });
    expect(decl.pages[0]!.slug).toBeUndefined();
  });

  it('strips a leading slash from a non-home slug', () => {
    const decl = captureSite({ pages: [{ name: 'About', slug: '/about', root: node('page') }] });
    expect(decl.pages[0]!.slug).toBe('about');
  });

  it('carries the collection domain columns through (recordType, isDefault, SEO)', () => {
    const decl = captureSite(baseSite());
    const product = decl.pages[1]!;
    expect(product.kind).toBe('collection');
    expect(product.recordType).toBe('commerce.product');
    expect(product.isDefault).toBe(true);
    expect(product.seoTitle).toBe('Buy it');
  });

  it('defaults kind to singleton and never marks a singleton default', () => {
    const decl = captureSite({
      pages: [{ name: 'Home', slug: '/', root: node('page'), isDefault: true }],
    });
    const home = decl.pages[0]!;
    expect(home.kind).toBe('singleton');
    // isDefault is meaningful only for a collection — a singleton must not carry it.
    expect(home.isDefault).toBe(false);
  });

  it('captures frame, theme, and symbols verbatim', () => {
    const decl = captureSite(baseSite());
    expect(decl.frame?.root).toEqual({ kind: 'frame' });
    expect(decl.theme?.name).toBe('Ember');
    expect(decl.symbols).toEqual({ sym_1: { kind: 'symbol' } });
  });

  it('omits the theme when asked, so the blueprint re-skins per tenant', () => {
    const decl = captureSite(baseSite(), { omitTheme: true });
    expect(decl.theme).toBeUndefined();
    // Structure is untouched — only the theme is dropped.
    expect(decl.pages).toHaveLength(2);
  });

  it('omits an empty symbols map rather than capturing {}', () => {
    const decl = captureSite({
      pages: [{ name: 'Home', slug: '/', root: node('page') }],
      symbols: {},
    });
    expect(decl.symbols).toBeUndefined();
  });

  it('throws on a site with no pages (SiteDecl requires at least one)', () => {
    expect(() => captureSite({ pages: [] })).toThrow();
  });
});
