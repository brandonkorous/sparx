import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { InstagramAdapter, planInstagramPost } from './instagram.js';
import type { RenderedPost } from '../types.js';

// The Instagram adapter's pure decision logic (docs/134 Phase 2). The two-step Content
// Publishing API is integration surface; here we lock the image/carousel/reel branching
// (with the link folded into the caption) and the authorize URL.

const rendered = (over: Partial<RenderedPost>): RenderedPost => ({
  text: 'Hello',
  mediaUrls: [],
  ...over,
});

describe('planInstagramPost', () => {
  it('is a single image, folding the link into the caption', () => {
    const plan = planInstagramPost(
      rendered({ mediaUrls: ['https://cdn/a.jpg'], link: 'https://shop/p/1' })
    );
    expect(plan).toEqual({
      kind: 'image',
      imageUrl: 'https://cdn/a.jpg',
      caption: 'Hello\n\nhttps://shop/p/1',
    });
  });

  it('is a carousel with more than one image', () => {
    const plan = planInstagramPost(
      rendered({ mediaUrls: ['https://cdn/a.jpg', 'https://cdn/b.png'] })
    );
    expect(plan).toEqual({
      kind: 'carousel',
      imageUrls: ['https://cdn/a.jpg', 'https://cdn/b.png'],
      caption: 'Hello',
    });
  });

  it('is a reel for a lone video', () => {
    const plan = planInstagramPost(rendered({ mediaUrls: ['https://cdn/clip.mp4'] }));
    expect(plan).toEqual({ kind: 'reel', videoUrl: 'https://cdn/clip.mp4', caption: 'Hello' });
  });

  it('is none when there is no media (the renderer blocks it upstream)', () => {
    expect(planInstagramPost(rendered({}))).toEqual({ kind: 'none' });
  });
});

describe('InstagramAdapter connectUrl / isConfigured', () => {
  beforeEach(() => {
    process.env.META_APP_ID = 'meta-app';
    process.env.META_APP_SECRET = 'meta-secret';
  });
  afterEach(() => {
    delete process.env.META_APP_ID;
    delete process.env.META_APP_SECRET;
  });

  it('shares the Meta app and requests IG publishing scope', () => {
    const a = new InstagramAdapter();
    expect(a.isConfigured()).toBe(true);
    const url = new URL(
      a.connectUrl({ tenantId: 't1', state: 's', redirectUri: 'https://app/cb', scopes: [] })
    );
    expect(url.searchParams.get('client_id')).toBe('meta-app');
    expect(url.searchParams.get('scope')).toContain('instagram_content_publish');
  });

  it('reports not-configured when the env is missing', () => {
    delete process.env.META_APP_ID;
    expect(new InstagramAdapter().isConfigured()).toBe(false);
  });
});
