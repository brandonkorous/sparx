import { describe, expect, it } from 'vitest';

import { captureSite, type CapturedSiteInput } from './capture';

// A silica node is opaque to sparx — validated structurally as an object carrying a
// string `kind` (site-sync.ts `SilicaTreeInput`). These stand in for real trees.
const node = (kind: string) => ({ kind }) as never;

/** A live site with the two page shapes a capture must handle: a home singleton
 *  (stored slug `'/'`) and a collection template bound to a recordType.
 *
 *  The collection here is deliberately a type the STOREFRONT DOES NOT ROUTE. A routed
 *  type (`commerce.product`, `cms.blog_post`, …) is a record page with a platform
 *  address now, and capture skips those on purpose — see the dedicated test. A custom
 *  content type with no storefront route of its own still has no address, so it captures
 *  exactly as it always did. */
function baseSite(): CapturedSiteInput {
  return {
    pages: [
      { id: 'row_home', name: 'Home', slug: '/', root: node('page'), kind: 'singleton' },
      {
        id: 'row_recipe',
        name: 'Recipe',
        slug: 'recipe',
        root: node('page'),
        kind: 'collection',
        recordType: 'cms.recipe',
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
    const recipe = decl.pages[1]!;
    expect(recipe.kind).toBe('collection');
    expect(recipe.recordType).toBe('cms.recipe');
    expect(recipe.isDefault).toBe(true);
    expect(recipe.seoTitle).toBe('Buy it');
  });

  it('never captures a RECORD page, however it is spelled', () => {
    // A blueprint carrying `/products/:handle` would install one tenant's product design
    // as a permanent frozen copy on everyone who used that blueprint — and because it
    // arrives as a row, the platform template would never be seeded for them again. The
    // improving-template guarantee is exactly what these pages exist for.
    //
    // Both spellings are dropped: the address, and a legacy row that carries the routed
    // recordType with no slug yet.
    const decl = captureSite({
      pages: [
        { id: 'row_home', name: 'Home', slug: '/', root: node('page') },
        { id: 'row_pdp', name: 'Product detail', slug: '/products/:handle', root: node('page') },
        {
          id: 'row_legacy',
          name: 'Blog post',
          slug: null,
          root: node('page'),
          kind: 'collection',
          recordType: 'cms.blog_post',
        },
      ],
    });
    expect(decl.pages.map((p) => p.name)).toEqual(['Home']);
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
