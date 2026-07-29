import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InstagramAdapter, planInstagramPost } from './instagram.js';
import type { RenderedPost, SocialAuth, SocialTargetRef } from '../types.js';

function jsonRes(body: unknown): Response {
  return { ok: true, status: 200, json: () => Promise.resolve(body) } as unknown as Response;
}
function errRes(status: number, text: string): Response {
  return { ok: false, status, text: () => Promise.resolve(text) } as unknown as Response;
}

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

  // See the matching block in facebook.test.ts — an unrequested scope can never
  // produce the one successful API call Meta requires before it will approve the
  // permission, so these flags gate the submission itself, not just the feature.
  const scopeOf = (): string =>
    new URL(
      new InstagramAdapter().connectUrl({
        tenantId: 't1',
        state: 's',
        redirectUri: 'https://app/cb',
        scopes: [],
      })
    ).searchParams.get('scope') ?? '';

  afterEach(() => {
    delete process.env.META_INBOX_ENABLED;
    delete process.env.META_INSIGHTS_ENABLED;
  });

  it('omits the review-gated scopes when both flags are off', () => {
    const scope = scopeOf();
    expect(scope).not.toContain('instagram_manage_comments');
    expect(scope).not.toContain('instagram_manage_insights');
    expect(scope).toContain('instagram_content_publish');
  });

  it('adds instagram_manage_comments only for the inbox flag', () => {
    process.env.META_INBOX_ENABLED = 'true';
    const scope = scopeOf();
    expect(scope).toContain('instagram_manage_comments');
    expect(scope).not.toContain('instagram_manage_insights');
  });

  it('adds instagram_manage_insights only for the insights flag', () => {
    process.env.META_INSIGHTS_ENABLED = 'true';
    const scope = scopeOf();
    expect(scope).toContain('instagram_manage_insights');
    expect(scope).not.toContain('instagram_manage_comments');
  });
});

describe('InstagramAdapter getMetrics', () => {
  const auth: SocialAuth = { externalId: 'user', accessToken: 'user-token' };
  const target: SocialTargetRef = {
    externalTargetId: 'ig-1',
    name: '@acme',
    params: { pageAccessToken: 'page-token' },
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns like/comment counts + reach/impressions when insights are granted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        expect(url).toContain('access_token=page-token');
        if (url.includes('/insights')) {
          return Promise.resolve(
            jsonRes({
              data: [
                { name: 'impressions', values: [{ value: 640 }] },
                { name: 'reach', values: [{ value: 590 }] },
              ],
            })
          );
        }
        return Promise.resolve(jsonRes({ like_count: 40, comments_count: 6 }));
      })
    );

    const metrics = await new InstagramAdapter().getMetrics(auth, target, 'media-1');
    // No "shares" concept for an IG feed post.
    expect(metrics).toEqual({ likes: 40, comments: 6, impressions: 640, reach: 590 });
  });

  it('keeps the counts when the insights scope is missing (403)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/insights')) {
          return Promise.resolve(errRes(403, 'requires instagram_manage_insights'));
        }
        return Promise.resolve(jsonRes({ like_count: 9, comments_count: 0 }));
      })
    );

    const metrics = await new InstagramAdapter().getMetrics(auth, target, 'media-1');
    expect(metrics).toEqual({ likes: 9, comments: 0 });
    expect(metrics.reach).toBeUndefined();
  });
});
