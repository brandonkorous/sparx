import { describe, expect, it } from 'vitest';

import type { PageSummary } from '../../lib/studio/page-data';
import { statusOf } from './page-address';

const page = (over: Partial<PageSummary>): PageSummary => ({
  id: 'p',
  name: 'Shop',
  slug: '/shop',
  kind: 'singleton',
  recordType: null,
  recordSubtype: null,
  isDefault: false,
  frameId: null,
  published: false,
  live: true,
  publishedAt: null,
  position: 0,
  ...over,
});

describe('statusOf', () => {
  it('says a page is off when this site switched its module off, published or not', () => {
    // A journal with Selling switched off: /shop answers 404 (issue 944).
    expect(statusOf(page({ offOnSite: 'commerce', live: false })).label).toBe('Off on this site');
    expect(statusOf(page({ offOnSite: 'commerce', published: true })).label).toBe(
      'Off on this site'
    );
  });

  it('keeps the other states as they were', () => {
    expect(statusOf(page({ published: true })).label).toBe('Live');
    expect(statusOf(page({})).label).toBe('Live · standard design');
    expect(statusOf(page({ live: false })).label).toBe('Not live yet');
  });
});
