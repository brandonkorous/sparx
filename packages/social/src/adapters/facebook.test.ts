import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FacebookPageAdapter, facebookPermalink, planFacebookPost } from './facebook.js';
import type { RenderedPost } from '../types.js';

// The Facebook Page adapter's pure decision logic (docs/134 Phase 2). Network calls
// (token exchange, Page listing, Graph publish) are integration surface; here we lock
// the photo/gallery/link/text branching, the permalink shape, and the authorize URL.

const rendered = (over: Partial<RenderedPost>): RenderedPost => ({
  text: 'Hello',
  mediaUrls: [],
  ...over,
});

describe('planFacebookPost', () => {
  it('is a single photo (link folded into the caption) with one image', () => {
    const plan = planFacebookPost(
      rendered({ mediaUrls: ['https://cdn/a.jpg'], link: 'https://shop/p/1' })
    );
    expect(plan).toEqual({
      kind: 'single_photo',
      imageUrl: 'https://cdn/a.jpg',
      caption: 'Hello\n\nhttps://shop/p/1',
    });
  });

  it('is a multi-photo gallery with more than one image', () => {
    const plan = planFacebookPost(
      rendered({ mediaUrls: ['https://cdn/a.jpg', 'https://cdn/b.png'] })
    );
    expect(plan).toEqual({
      kind: 'multi_photo',
      imageUrls: ['https://cdn/a.jpg', 'https://cdn/b.png'],
      message: 'Hello',
    });
  });

  it('is a feed post with a link card when there is a link and no image', () => {
    const plan = planFacebookPost(rendered({ link: 'https://shop/p/1' }));
    expect(plan).toEqual({ kind: 'feed', message: 'Hello', link: 'https://shop/p/1' });
  });

  it('is a plain feed status with no media or link', () => {
    expect(planFacebookPost(rendered({}))).toEqual({ kind: 'feed', message: 'Hello', link: null });
  });

  it('treats a lone video as a text/feed post (image-only upload for v1)', () => {
    const plan = planFacebookPost(rendered({ mediaUrls: ['https://cdn/clip.mp4'] }));
    expect(plan.kind).toBe('feed');
  });
});

describe('facebookPermalink', () => {
  it('builds a facebook.com URL from the story id', () => {
    expect(facebookPermalink('123_456')).toBe('https://www.facebook.com/123_456');
  });
});

describe('FacebookPageAdapter connectUrl / isConfigured', () => {
  beforeEach(() => {
    process.env.META_APP_ID = 'meta-app';
    process.env.META_APP_SECRET = 'meta-secret';
  });
  afterEach(() => {
    delete process.env.META_APP_ID;
    delete process.env.META_APP_SECRET;
  });

  it('is configured once its env is set and requests Page posting scopes', () => {
    const a = new FacebookPageAdapter();
    expect(a.isConfigured()).toBe(true);
    const url = new URL(
      a.connectUrl({
        tenantId: 't1',
        state: 's',
        redirectUri: 'https://app.example.com/cb',
        scopes: [],
      })
    );
    expect(url.searchParams.get('client_id')).toBe('meta-app');
    expect(url.searchParams.get('scope')).toContain('pages_manage_posts');
  });

  it('reports not-configured when the env is missing', () => {
    delete process.env.META_APP_SECRET;
    expect(new FacebookPageAdapter().isConfigured()).toBe(false);
  });
});
