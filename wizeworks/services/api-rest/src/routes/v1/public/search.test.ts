// Public "search everything" — what a shopper can find on a tenant's own site.
//
// Both of these pin a defect that shipped as silence (issue 378). A shop's pages
// and articles were absent from every search its own visitors ran: `cms_entry` was
// not in the public type list, and the `cms_page` branch resolved against a
// deprecated table holding zero rows. Nothing errored, nothing logged, and the
// screen offered "Browse all products" on a site whose footer links a Return Policy.

import { describe, expect, it } from 'vitest';

import { PUBLIC_ENTITY_TYPES, publicEntityTypesFor } from './search.js';

describe('PUBLIC_ENTITY_TYPES', () => {
  it('includes the CMS articles a shop writes', () => {
    expect(PUBLIC_ENTITY_TYPES).toContain('cms_entry');
  });

  it('includes the standalone pages a shop publishes', () => {
    expect(PUBLIC_ENTITY_TYPES).toContain('cms_page');
  });

  it('still covers the commerce records', () => {
    expect(PUBLIC_ENTITY_TYPES).toContain('product');
    expect(PUBLIC_ENTITY_TYPES).toContain('collection');
  });

  it('leaves out categories, which have no storefront page', () => {
    expect(PUBLIC_ENTITY_TYPES).not.toContain('category');
  });
});

// A journal that switched its shop off was offered a shop collection by its own
// search (P09): the public route searched every public type on every site.
describe('publicEntityTypesFor', () => {
  it('drops products and collections on a site whose shop is off', () => {
    expect(publicEntityTypesFor(['commerce', 'scheduling'])).toEqual(['cms_page', 'cms_entry']);
  });

  it('drops pages and articles on a site whose content is off', () => {
    expect(publicEntityTypesFor(['cms'])).toEqual(['product', 'collection']);
  });

  it('keeps every public type when nothing is switched off', () => {
    expect(publicEntityTypesFor([])).toEqual(PUBLIC_ENTITY_TYPES);
  });
});
