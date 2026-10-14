// Where a published entry lives — the address the sitemap, the RSS feed and site search
// all link to. These pin the defect it replaced: each of the three substituted the slug
// into the kind's pattern whatever the pattern said, so an Event, a Job posting or a
// journal's Article was listed at an address nothing served.

import { describe, expect, it } from 'vitest';

import { entryPublicPath } from './content-paths.js';

describe('entryPublicPath', () => {
  it('puts a page at the top level, where the catch-all reads pages', () => {
    expect(entryPublicPath('page', '/{slug}', 'returns-policy')).toBe('/returns-policy');
  });

  it('puts a blog post under /blog whatever its pattern says', () => {
    expect(entryPublicPath('blog_post', '/blog/{slug}', 'caring-for-knitwear')).toBe(
      '/blog/caring-for-knitwear'
    );
    expect(entryPublicPath('blog_post', null, 'a')).toBe('/blog/a');
  });

  it('puts any other kind where its own pattern says, which the website now serves', () => {
    expect(entryPublicPath('article', '/articles/{slug}', 'the-last-mill')).toBe(
      '/articles/the-last-mill'
    );
    expect(entryPublicPath('case_study', '/case-studies/{slug}', 'a-b')).toBe('/case-studies/a-b');
    expect(entryPublicPath('job_posting', '/careers/{slug}', 'cutter')).toBe('/careers/cutter');
  });

  it('gives no address for a pattern the website cannot serve', () => {
    // A landing page at `/{slug}` is not read by anything.
    expect(entryPublicPath('landing_page', '/{slug}', 'spring')).toBeNull();
    // No slug in it: every piece would claim one address.
    expect(entryPublicPath('announcement', '/press', 'anything')).toBeNull();
    // A word the website already routes.
    expect(entryPublicPath('article', '/products/{slug}', 'x')).toBeNull();
    // What a shell made of `/articles/{slug}` on one test machine.
    expect(entryPublicPath('article', 'C:/Program Files/Git/articles/{slug}', 'x')).toBeNull();
    expect(entryPublicPath('article', null, 'x')).toBeNull();
  });

  it('gives no address to an entry with no slug', () => {
    expect(entryPublicPath('page', '/{slug}', null)).toBeNull();
    expect(entryPublicPath('article', '/articles/{slug}', '')).toBeNull();
  });
});
