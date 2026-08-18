import { describe, expect, it } from 'vitest';

import { starterPages } from './site';
import { isUtilityPage, UTILITY_PAGE_SLUGS } from './utility-pages';

describe('isUtilityPage', () => {
  it('matches every utility slug the starter actually authors', () => {
    // The list is only correct while it agrees with what `starterPages` builds. If a
    // starter page is renamed or moved, this fails rather than silently un-exempting a
    // cart page from the sitemap.
    const authored = new Set(
      starterPages({ commerceEnabled: true, schedulingEnabled: true, cmsEnabled: true }).map(
        (p) => p.slug
      )
    );
    for (const slug of UTILITY_PAGE_SLUGS) {
      expect(authored, `${slug} is no longer authored by starterPages`).toContain(slug);
      expect(isUtilityPage(slug), slug).toBe(true);
    }
  });

  it('accepts the spellings a slug arrives in', () => {
    expect(isUtilityPage('cart')).toBe(true);
    expect(isUtilityPage('/cart')).toBe(true);
    expect(isUtilityPage('/cart/')).toBe(true);
    expect(isUtilityPage('account/login')).toBe(true);
  });

  it('does NOT match a page an author wrote that merely starts the same', () => {
    // The reason this is an exact match and not a prefix: these are real pages someone
    // may well have written, and a `startsWith` check would quietly stop grading them
    // for search and drop them from the sitemap.
    expect(isUtilityPage('/searchlight')).toBe(false);
    expect(isUtilityPage('/account/login-help')).toBe(false);
    expect(isUtilityPage('/carts')).toBe(false);
    expect(isUtilityPage('/about')).toBe(false);
    expect(isUtilityPage('/')).toBe(false);
    expect(isUtilityPage('')).toBe(false);
    expect(isUtilityPage(null)).toBe(false);
    expect(isUtilityPage(undefined)).toBe(false);
  });

  it('leaves the pages a shop is FOUND by alone', () => {
    // Utility means "needed for the site to work", not "not a marketing page". The shop
    // and its index pages are exactly what a search result should land on.
    for (const slug of ['/shop', '/products', '/collections', '/category', '/blog', '/about']) {
      expect(isUtilityPage(slug), slug).toBe(false);
    }
  });
});
