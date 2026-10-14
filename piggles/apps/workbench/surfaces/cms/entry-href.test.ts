import { describe, expect, it } from 'vitest';
import { entryHref } from './routable';

// P09: the content list printed "/<slug>" under every title, so an article that
// lives at /articles/the-last-mill-on-the-nene read "/the-last-mill-on-the-nene".
describe('entryHref', () => {
  it('puts a piece where its kind’s pattern says', () => {
    expect(
      entryHref(
        { type_key: 'article', slug: 'the-last-mill-on-the-nene' },
        { url_pattern: '/articles/{slug}' }
      )
    ).toBe('/articles/the-last-mill-on-the-nene');
  });

  it('puts a page at the top level', () => {
    expect(entryHref({ type_key: 'page', slug: 'about' }, { url_pattern: '/{slug}' })).toBe(
      '/about'
    );
  });

  it('gives no address to a kind the site shows nowhere, or to no slug', () => {
    expect(entryHref({ type_key: 'note', slug: 'x' }, { url_pattern: null })).toBeNull();
    expect(
      entryHref({ type_key: 'article', slug: null }, { url_pattern: '/articles/{slug}' })
    ).toBeNull();
  });
});
