import { describe, expect, it } from 'vitest';

import {
  buildContentUrl,
  contentAnnounceFields,
  productAnnounceFields,
  type ContentAnnounceRow,
  type ProductAnnounceRow,
} from './resolvers.js';

// The pure `announce.*` field mappers the social.post action reads (docs/133 §9).
// Both a published product and a published article populate the SAME namespace so
// the action is entity-agnostic.

describe('productAnnounceFields', () => {
  const p: ProductAnnounceRow = {
    id: 'prod_1',
    title: 'Aurora Down Jacket',
    handle: 'aurora-down-jacket',
    status: 'active',
    description: '<p>Warm, <b>packable</b>, weatherproof.</p>',
  };

  it('fills announce + product fields, stripping HTML from the summary', () => {
    const f = productAnnounceFields(
      p,
      'https://s.example.com/products/aurora-down-jacket',
      'img_1',
      'site_1'
    );
    expect(f['announce.title']).toBe('Aurora Down Jacket');
    expect(f['announce.summary']).toBe('Warm, packable, weatherproof.');
    expect(f['announce.url']).toBe('https://s.example.com/products/aurora-down-jacket');
    expect(f['announce.imageAssetId']).toBe('img_1');
    expect(f['announce.sourceType']).toBe('product');
    expect(f['announce.sourceRef']).toBe('prod_1');
    expect(f['announce.propertyId']).toBe('site_1');
    expect(f['product.handle']).toBe('aurora-down-jacket');
    expect(f['product.status']).toBe('active');
  });

  it('tolerates a null description, url, image + property', () => {
    const f = productAnnounceFields({ ...p, description: null }, null, null, null);
    expect(f['announce.summary']).toBe('');
    expect(f['announce.url']).toBeNull();
    expect(f['announce.imageAssetId']).toBeNull();
    expect(f['announce.propertyId']).toBeNull();
  });

  it('truncates a long summary with an ellipsis', () => {
    const long = 'x'.repeat(500);
    const f = productAnnounceFields({ ...p, description: long }, null, null, null);
    const summary = f['announce.summary'] as string;
    expect(summary.length).toBeLessThanOrEqual(200);
    expect(summary.endsWith('…')).toBe(true);
  });
});

describe('contentAnnounceFields', () => {
  const base = 'https://s.example.com';
  const e: ContentAnnounceRow = {
    id: 'entry_1',
    slug: 'hello-world',
    typeKey: 'post',
    status: 'published',
    body: { title: 'Hello World', excerpt: 'Our first post.' },
    seoJson: { ogImageId: '99999999-8888-4777-8666-555555555555' },
  };

  it('reads the title from the body, image only when it is a uuid', () => {
    const f = contentAnnounceFields(e, '/blog/:slug', base, 'site_1');
    expect(f['announce.title']).toBe('Hello World');
    expect(f['announce.summary']).toBe('Our first post.');
    expect(f['announce.url']).toBe('https://s.example.com/blog/hello-world');
    expect(f['announce.imageAssetId']).toBe('99999999-8888-4777-8666-555555555555');
    expect(f['announce.sourceType']).toBe('content');
    expect(f['content.typeKey']).toBe('post');
  });

  it('falls back to the slug for the title and ignores a non-uuid image', () => {
    const f = contentAnnounceFields(
      { ...e, body: { image: 'https://cdn/x.jpg' }, seoJson: {} },
      null,
      base,
      null
    );
    expect(f['announce.title']).toBe('hello-world');
    expect(f['announce.imageAssetId']).toBeNull();
  });
});

describe('buildContentUrl', () => {
  const base = 'https://s.example.com';
  it('substitutes :slug in the url pattern', () => {
    expect(buildContentUrl(base, '/blog/:slug', 'hello')).toBe('https://s.example.com/blog/hello');
  });
  it('appends the slug when the pattern has no :slug token', () => {
    expect(buildContentUrl(base, '/news', 'hello')).toBe('https://s.example.com/news/hello');
  });
  it('uses the bare slug when there is no pattern', () => {
    expect(buildContentUrl(base, null, 'hello')).toBe('https://s.example.com/hello');
  });
  it('is null without a base or a slug', () => {
    expect(buildContentUrl(null, '/blog/:slug', 'hello')).toBeNull();
    expect(buildContentUrl(base, '/blog/:slug', null)).toBeNull();
  });
});
