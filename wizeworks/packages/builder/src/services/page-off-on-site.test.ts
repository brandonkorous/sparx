// Which pages a site has switched off for itself (issue 944's switches, seen from the
// page list). A journal that turned Selling and Bookings off has no shop, cart, product
// page or booking page; the list called every one of them "Live".

import { describe, expect, it } from 'vitest';

import { offOnSite } from './page-liveness';

const account = { commerceEnabled: true, schedulingEnabled: true, cmsEnabled: true };
const journal = { commerceEnabled: false, schedulingEnabled: false, cmsEnabled: true };

const row = (slug: string | null, kind = 'singleton', recordType: string | null = null) => ({
  slug,
  kind,
  recordType,
});

describe('offOnSite', () => {
  it('names the module that takes a starter address off the site', () => {
    // `/shop` is no address of Selling's; the product grid on it is what makes it a shop.
    expect(offOnSite(row('/shop'), account, journal, ['commerce.plp'])).toBe('commerce');
    expect(offOnSite(row('/shop'), account, journal)).toBeNull();
    expect(offOnSite(row('cart'), account, journal)).toBe('commerce');
    expect(offOnSite(row('/book'), account, journal)).toBe('scheduling');
  });

  it('names it for the record pages too', () => {
    expect(
      offOnSite(row('/products/:handle', 'collection', 'commerce.product'), account, journal)
    ).toBe('commerce');
    expect(
      offOnSite(row('/book/:serviceId', 'collection', 'scheduling.service'), account, journal)
    ).toBe('scheduling');
  });

  it('leaves sign-in and search on, which the site still serves', () => {
    expect(offOnSite(row('/account/login'), account, journal, ['commerce.auth'])).toBeNull();
    expect(offOnSite(row('/search'), account, journal, ['commerce.search'])).toBeNull();
  });

  it('leaves the journal’s own pages on', () => {
    expect(offOnSite(row('/about'), account, journal)).toBeNull();
    expect(offOnSite(row('/blog'), account, journal)).toBeNull();
    expect(
      offOnSite(row('/articles/:slug', 'collection', 'cms.article'), account, journal)
    ).toBeNull();
    // A page she made herself is hers, whatever is on it.
    expect(offOnSite(row('/our-story'), account, journal)).toBeNull();
  });

  it('takes a kind page off with Content', () => {
    const shop = { ...account, cmsEnabled: false };
    expect(offOnSite(row('/articles/:slug', 'collection', 'cms.article'), account, shop)).toBe(
      'cms'
    );
  });

  it('is never off on a site that switched nothing off', () => {
    expect(offOnSite(row('/shop'), account, account, ['commerce.plp'])).toBeNull();
    expect(
      offOnSite(row('/products/:handle', 'collection', 'commerce.product'), account, account)
    ).toBeNull();
  });
});
