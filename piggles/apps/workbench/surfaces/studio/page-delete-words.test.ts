import { describe, expect, it } from 'vitest';

import type { PageSummary } from '../../lib/studio/page-data';
import { deletePageCost } from './page-delete-words';

const page = (over: Partial<PageSummary>): PageSummary => ({
  id: 'p',
  name: 'About',
  slug: '/about',
  kind: 'singleton',
  recordType: null,
  recordSubtype: null,
  isDefault: false,
  frameId: null,
  published: true,
  live: true,
  publishedAt: null,
  position: 0,
  ...over,
});

describe('deletePageCost', () => {
  it('tells the truth about a record page: its records keep a page, and a fresh copy returns', () => {
    // Measured on P09's journal (issue 947): deleting "Each article" left every article
    // answering 200, and the page list made a new "Each article" on its next load.
    const words = deletePageCost(
      page({
        name: 'Each article',
        slug: '/articles/:slug',
        kind: 'collection',
        recordType: 'cms.article',
      }),
      []
    );
    expect(words).toContain('back to the standard design');
    expect(words).toContain('fresh copy');
    expect(words).not.toContain('not-found');
    expect(words).not.toContain('no page at all');
  });

  it('sends a product-type design back to the one every other product uses', () => {
    const words = deletePageCost(
      page({ kind: 'collection', recordType: 'commerce.product', recordSubtype: 'apparel' }),
      []
    );
    expect(words).toContain('every other product uses');
    expect(words).not.toContain('fresh copy');
  });

  it('still warns that an ordinary live page stops answering', () => {
    const words = deletePageCost(page({}), []);
    expect(words).toContain('Nothing else answers to /about');
    expect(words).toContain('not-found page');
  });

  it('keeps a page the site needs, at an address it answers itself', () => {
    const words = deletePageCost(page({ name: 'Cart', slug: '/cart' }), []);
    expect(words).toContain('Your site keeps /cart');
    expect(words).not.toContain('stops working');
  });

  it('says a deleted starter page takes its address with it, which it now does', () => {
    // `/blog` on a journal: the page list no longer makes it again (issue 947).
    const words = deletePageCost(page({ name: 'Journal', slug: '/blog' }), []);
    expect(words).toContain('Nothing else answers to /blog, so that address stops working.');
  });

  it('calls a page served with the standard design live, which it is', () => {
    const words = deletePageCost(page({ slug: '/blog', published: false, live: true }), []);
    expect(words).toContain('It is live right now.');
    expect(words).not.toContain('never been live');
  });
});
