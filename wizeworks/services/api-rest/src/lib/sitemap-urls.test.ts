import { describe, expect, it } from 'vitest';
import { pageAddress, starterAddresses, type SiteContent } from './sitemap-urls';

const NONE = new Set<string>();
const FULL: SiteContent = { products: 4, collections: 2, categories: 3, posts: 6, bookable: 1 };
const EMPTY: SiteContent = { products: 0, collections: 0, categories: 0, posts: 0, bookable: 0 };
const EVERY_MODULE = { commerceEnabled: true, schedulingEnabled: true, cmsEnabled: true };

describe('pageAddress', () => {
  it('reads both spellings the store holds as the same URL', () => {
    // A blueprint writes `about`; the code starter writes `/about`. Eight tenants in
    // one database carry the second, and every one of them advertised `//about`.
    expect(pageAddress('about')).toBe('/about');
    expect(pageAddress('/about')).toBe('/about');
    expect(pageAddress('account/login')).toBe('/account/login');
    expect(pageAddress('/account/login')).toBe('/account/login');
  });

  it('never produces a doubled slash', () => {
    for (const slug of ['/', '//', '/shop', 'shop', '///deep/path', '']) {
      expect(pageAddress(slug), `pageAddress(${JSON.stringify(slug)})`).not.toMatch(/^\/\//);
    }
    expect(pageAddress('/')).toBe('/');
    expect(pageAddress('')).toBe('/');
  });
});

describe('starterAddresses', () => {
  it('offers the journal a business with posts is already serving', () => {
    // Juniper Row: `/blog` live, listing three articles, in no sitemap (issue 274).
    expect(starterAddresses(EVERY_MODULE, FULL, NONE, NONE)).toContain('/blog');
  });

  it('never offers the home page, a record template, or a utility page', () => {
    const out = starterAddresses(EVERY_MODULE, FULL, NONE, NONE);
    expect(out).not.toContain('/');
    for (const path of out) {
      expect(path, `${path} is a record address`).not.toMatch(/:/);
    }
    for (const utility of [
      '/cart',
      '/search',
      '/account/login',
      '/account/register',
      '/account/forgot',
      '/account/reset',
    ]) {
      expect(out, `${utility} must stay out of every index`).not.toContain(utility);
    }
  });

  it('says nothing about an index with nothing behind it', () => {
    // Every module on and no content — which is exactly a persona tenant, and how
    // "No services are bookable yet" came to be offered to Google on a clothing label.
    const out = starterAddresses(EVERY_MODULE, EMPTY, NONE, NONE);
    for (const index of ['/shop', '/products', '/collections', '/category', '/blog', '/book']) {
      expect(out, `${index} has nothing behind it`).not.toContain(index);
    }
    // The pages that are not indexes still stand: they carry the owner's own words.
    expect(out).toContain('/about');
    expect(out).toContain('/contact');
  });

  it('leaves out an address a published page already covers', () => {
    const published = new Set(['/about', '/blog']);
    const out = starterAddresses(EVERY_MODULE, FULL, published, NONE);
    expect(out).not.toContain('/about');
    expect(out).not.toContain('/blog');
    expect(out).toContain('/contact');
  });

  it('honours "keep this out of search" on a page that was never published', () => {
    // The tick is about the ADDRESS. The starter answers there whether or not the
    // page behind it ever went live, so reading noindex off published rows alone
    // would advertise the one address its author asked us not to.
    const out = starterAddresses(EVERY_MODULE, FULL, NONE, new Set(['/blog']));
    expect(out).not.toContain('/blog');
  });

  it('offers a business only what its modules give it', () => {
    const contentOnly = starterAddresses(
      { commerceEnabled: false, schedulingEnabled: false, cmsEnabled: true },
      FULL,
      NONE,
      NONE
    );
    expect(contentOnly).toContain('/blog');
    expect(contentOnly).not.toContain('/shop');
    expect(contentOnly).not.toContain('/book');

    const noCms = starterAddresses(
      { commerceEnabled: true, schedulingEnabled: false, cmsEnabled: false },
      FULL,
      NONE,
      NONE
    );
    expect(noCms).not.toContain('/blog');
    expect(noCms).toContain('/shop');
  });
});
