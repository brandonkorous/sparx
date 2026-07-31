// The root page's slug has two spellings and only one of them is storable.
//
// `apps/site/lib/page-slug.ts` maps the URL `/` to `null`, and `PageSlug` forbids
// both the empty string and a leading slash — so `null` is the stored form of home.
// Nothing normalized on the way IN, though, so a writer that sent the URL form
// persisted `slug: '/'`: a value the very same schema then refuses on the next
// edit, leaving the page uneditable and duplicating the slugless page that is the
// real root. Found on a live site 2026-07-31 (page f3ef690c…).

import { describe, it, expect } from 'vitest';
import { CreatePageInput, UpdatePageInput } from './page';

describe('PageSlugInput — the root page normalizes to null', () => {
  const slugOf = (input: unknown): unknown =>
    (CreatePageInput.parse({ name: 'Home', ...(input as object) }) as { slug?: unknown }).slug;

  it('stores the root as null however it is spelled', () => {
    expect(slugOf({ slug: '/' })).toBeNull();
    expect(slugOf({ slug: '' })).toBeNull();
    expect(slugOf({ slug: '   ' })).toBeNull();
    expect(slugOf({ slug: '///' })).toBeNull();
  });

  it('strips the URL form of a real slug rather than rejecting it', () => {
    expect(slugOf({ slug: '/about' })).toBe('about');
    expect(slugOf({ slug: 'about/' })).toBe('about');
    expect(slugOf({ slug: '/legal/privacy/' })).toBe('legal/privacy');
  });

  it('leaves an already-canonical slug alone', () => {
    expect(slugOf({ slug: 'about' })).toBe('about');
    expect(slugOf({ slug: 'legal/privacy' })).toBe('legal/privacy');
  });

  it('keeps null and absent distinguishable — null clears, absent leaves as-is', () => {
    expect(slugOf({ slug: null })).toBeNull();
    expect(slugOf({})).toBeUndefined();
    // The same on the patch path, where the distinction decides whether the field
    // is written at all.
    expect(UpdatePageInput.parse({ slug: '/' }).slug).toBeNull();
    expect(UpdatePageInput.parse({ name: 'Home' }).slug).toBeUndefined();
  });

  it('still rejects a slug that is genuinely malformed', () => {
    expect(() => CreatePageInput.parse({ name: 'X', slug: 'Not A Slug' })).toThrow();
    expect(() => CreatePageInput.parse({ name: 'X', slug: 'UPPER' })).toThrow();
    expect(() => CreatePageInput.parse({ name: 'X', slug: 'a..b' })).toThrow();
  });
});
