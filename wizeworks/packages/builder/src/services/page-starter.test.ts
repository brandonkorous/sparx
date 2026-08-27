// Pages the SITE serves that the page list never showed.
//
// The storefront falls back to the code starter per slug, so an address in the
// starter set is live whether or not the property has a row there. `listOrSeed` wrote
// the starter set only when the table was EMPTY, so any path that created pages first
// left the difference serving and unreachable — live to every visitor, absent from the
// one screen its owner would go to to change it.
//
// Found by driving it: a clothing label's Journal at `/blog` listed her three articles
// under the platform's own standfirst, "News, notes, and what we have been working
// on", and naming a new page "Journal" built a second, blank one at `/journal`.

import { describe, expect, it } from 'vitest';

import { missingStarterPages } from './page-service';
import { isLive } from './page-liveness';

const EVERY_MODULE = { commerceEnabled: true, schedulingEnabled: true, cmsEnabled: true };

describe('missingStarterPages', () => {
  it('names the journal a CMS business has no page for', () => {
    const held = [{ slug: '/' }, { slug: 'about' }, { slug: 'contact' }, { slug: 'shop' }];
    const missing = missingStarterPages(held, EVERY_MODULE).map((p) => p.slug);
    expect(missing).toContain('/blog');
  });

  it('counts a row as holding its address in either spelling', () => {
    // A blueprint writes `about`; the starter writes `/about`. Matching on the raw
    // string would mint a second About page beside the real one on the next list read
    // — and then again, and again, because the new row spells it the other way.
    const bare = missingStarterPages([{ slug: 'about' }], EVERY_MODULE).map((p) => p.slug);
    const slashed = missingStarterPages([{ slug: '/about' }], EVERY_MODULE).map((p) => p.slug);
    expect(bare).not.toContain('/about');
    expect(slashed).not.toContain('/about');
  });

  it('is a no-op once every address is held', () => {
    const all = missingStarterPages([], EVERY_MODULE);
    expect(all.length).toBeGreaterThan(5);
    expect(missingStarterPages(all, EVERY_MODULE)).toEqual([]);
  });

  it('gives a business only the pages its modules call for', () => {
    const contentOnly = missingStarterPages([], {
      commerceEnabled: false,
      schedulingEnabled: false,
      cmsEnabled: true,
    }).map((p) => p.slug);
    expect(contentOnly).toContain('/blog');
    expect(contentOnly).not.toContain('/shop');
    expect(contentOnly).not.toContain('/book');
  });

  it('carries a body, so the page opens on what visitors already see', () => {
    // A blank page would be worse than the gap: the owner would rebuild from nothing
    // a design her site is serving this second.
    for (const page of missingStarterPages([], EVERY_MODULE)) {
      expect(page.root, `${page.slug} has no body`).toBeTruthy();
      expect(page.name.trim().length, `${page.slug} has no name`).toBeGreaterThan(0);
    }
  });
});

describe('isLive', () => {
  const at = (slug: string | null, over: Partial<Parameters<typeof isLive>[0]> = {}) => ({
    kind: 'singleton',
    slug,
    recordType: null,
    publishedAt: null,
    ...over,
  });

  it('is true for a published page', () => {
    expect(isLive(at('made-in-the-studio', { publishedAt: new Date() }), EVERY_MODULE)).toBe(true);
  });

  it('is true for a starter address nobody published', () => {
    // The whole point: `/blog` answers 200 while `published` is false.
    expect(isLive(at('/blog'), EVERY_MODULE)).toBe(true);
    expect(isLive(at('blog'), EVERY_MODULE)).toBe(true);
  });

  it('is true for a record template, saved or not', () => {
    expect(isLive(at(null, { kind: 'collection', recordType: 'cms.blog_post' }), {})).toBe(true);
  });

  it('is false for a page the author made and has not published', () => {
    // Nothing serves `/made-in-the-studio` but her own publish, so the warning is
    // real and has to stay real — a badge that says Live about everything says nothing.
    expect(isLive(at('made-in-the-studio'), EVERY_MODULE)).toBe(false);
    expect(isLive(at('size-guide'), EVERY_MODULE)).toBe(false);
  });

  it('does not call a journal live for a business with no CMS module', () => {
    expect(isLive(at('/blog'), { commerceEnabled: true, cmsEnabled: false })).toBe(false);
  });
});
