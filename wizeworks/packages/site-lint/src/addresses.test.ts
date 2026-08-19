import { describe, expect, it } from 'vitest';
import { checkAddresses } from './addresses';
import type { PageAddress } from './types';

// Addresses are metadata. No tree here on purpose — that is the whole point of the
// rule reading `PageAddress`: it can cover a page nobody has ever opened.
function page(over: Partial<PageAddress> & { id: string; name: string }): PageAddress {
  return { slug: null, kind: 'singleton', recordType: null, ...over };
}

describe('two pages that answer to one address', () => {
  it('reports every page in the clash, not just one of them', () => {
    // Three singletons with no slug all resolve to "/". One wins by whatever order
    // the router read them in and the other two cannot be opened at all — the site
    // looks entirely correct from the outside. This is the real state of a
    // development site that reported "Nothing to fix. It reads well."
    const findings = checkAddresses([
      page({ id: 'a', name: 'Home' }),
      page({ id: 'b', name: 'Home — Landing' }),
      page({ id: 'c', name: 'About', slug: 'about' }),
      page({ id: 'd', name: 'Welcome' }),
    ]);

    expect(findings.map((f) => f.origin.ownerId).sort()).toEqual(['a', 'b', 'd']);
    expect(findings.every((f) => f.rule === 'page-address-duplicate')).toBe(true);
    // An unreachable page is not a suggestion.
    expect(findings.every((f) => f.severity === 'error')).toBe(true);
    expect(findings[0]?.title).toContain('home page');
  });

  it('says nothing when every page has its own address', () => {
    const findings = checkAddresses([
      page({ id: 'a', name: 'Home' }),
      page({ id: 'b', name: 'About', slug: 'about' }),
      page({ id: 'c', name: 'Shop', slug: '/shop' }),
    ]);
    expect(findings).toEqual([]);
  });

  it('treats "shop" and "/shop" as the same address', () => {
    const findings = checkAddresses([
      page({ id: 'a', name: 'Shop', slug: 'shop' }),
      page({ id: 'b', name: 'Store', slug: '/shop' }),
    ]);
    expect(findings).toHaveLength(2);
  });

  it('exempts record templates, which are meant to share no slug', () => {
    // Ten templates carrying no slug is the correct shape of a site, not ten
    // duplicate home pages. Reporting them would put a permanent error on every
    // site, which is how an advisory list teaches people to ignore it.
    const findings = checkAddresses([
      page({ id: 'a', name: 'Home' }),
      page({ id: 'b', name: 'Product page', kind: 'collection', recordType: 'commerce.product' }),
      page({ id: 'c', name: 'Blog post', kind: 'collection', recordType: 'cms.article' }),
    ]);
    expect(findings).toEqual([]);
  });
});
