// P09: no page on The Marrow Review named its own address, so a search engine met each
// piece on the subdomain, the dev host and every query a link carried.
import { describe, expect, it } from 'vitest';

import { canonicalUrl } from './canonical';

const SITE = 'https://the-marrow-review.piggles.site';

describe('canonicalUrl', () => {
  it('names the page on the site’s own host', () => {
    expect(canonicalUrl(SITE, '/articles/the-last-mill-on-the-nene')).toBe(
      `${SITE}/articles/the-last-mill-on-the-nene`
    );
    expect(canonicalUrl(SITE, '/')).toBe(`${SITE}/`);
  });

  it('gives one address with or without a trailing slash', () => {
    expect(canonicalUrl(`${SITE}/`, '/ledger/')).toBe(`${SITE}/ledger`);
  });

  it('keeps the page number past the first, and only that', () => {
    expect(canonicalUrl(SITE, '/archive', '2')).toBe(`${SITE}/archive?page=2`);
    expect(canonicalUrl(SITE, '/archive', '1')).toBe(`${SITE}/archive`);
    expect(canonicalUrl(SITE, '/archive', 'two')).toBe(`${SITE}/archive`);
    expect(canonicalUrl(SITE, '/archive', null)).toBe(`${SITE}/archive`);
  });
});
