import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FacebookPageAdapter, facebookPermalink, planFacebookPost } from './facebook.js';
import type { RenderedPost, SocialAuth, SocialTargetRef } from '../types.js';

function jsonRes(body: unknown): Response {
  return { ok: true, status: 200, json: () => Promise.resolve(body) } as unknown as Response;
}
function errRes(status: number, text: string): Response {
  return { ok: false, status, text: () => Promise.resolve(text) } as unknown as Response;
}
function binRes(bytes: Uint8Array, contentType = 'image/jpeg'): Response {
  return {
    ok: true,
    status: 200,
    arrayBuffer: () => Promise.resolve(bytes.buffer),
    headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? contentType : null) },
  } as unknown as Response;
}

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

describe('FacebookPageAdapter getMetrics', () => {
  const auth: SocialAuth = { externalId: 'user', accessToken: 'user-token' };
  const target: SocialTargetRef = {
    externalTargetId: 'page-1',
    name: 'Page',
    params: { pageAccessToken: 'page-token' },
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns engagement counts + reach/impressions when insights are granted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        // Reads as the PAGE, never the user token.
        expect(url).toContain('access_token=page-token');
        if (url.includes('/insights')) {
          return Promise.resolve(
            jsonRes({
              data: [
                { name: 'post_impressions', values: [{ value: 1000 }] },
                { name: 'post_impressions_unique', values: [{ value: 820 }] },
              ],
            })
          );
        }
        return Promise.resolve(
          jsonRes({
            likes: { summary: { total_count: 12 } },
            comments: { summary: { total_count: 3 } },
            shares: { count: 2 },
          })
        );
      })
    );

    const metrics = await new FacebookPageAdapter().getMetrics(auth, target, '123_456');
    expect(metrics).toEqual({ likes: 12, comments: 3, shares: 2, impressions: 1000, reach: 820 });
  });

  it('keeps the engagement counts when the insights scope is missing (403)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/insights')) {
          return Promise.resolve(errRes(403, '(#10) requires read_insights permission'));
        }
        return Promise.resolve(
          jsonRes({
            likes: { summary: { total_count: 5 } },
            comments: { summary: { total_count: 1 } },
            shares: { count: 0 },
          })
        );
      })
    );

    const metrics = await new FacebookPageAdapter().getMetrics(auth, target, '123_456');
    expect(metrics).toEqual({ likes: 5, comments: 1, shares: 0 });
    expect(metrics.impressions).toBeUndefined();
    expect(metrics.reach).toBeUndefined();
  });
});

// A single-image post must UPLOAD the bytes (multipart `source`), never hand Graph a
// public `url` to fetch — Cloudflare serves our media URL a 206 that /photos rejects
// (#324). This locks that: the worker downloads the image itself (a plain GET, no Range),
// then posts it as multipart with no `url` field.
describe('FacebookPageAdapter publish — single photo uploads bytes, not a url', () => {
  const auth: SocialAuth = { externalId: 'user', accessToken: 'user-token' };
  const target: SocialTargetRef = {
    externalTargetId: 'page-1',
    name: 'Page',
    params: { pageAccessToken: 'page-token' },
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('downloads the image and posts it as multipart source (no url= param)', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        calls.push({ url, init });
        if (url.includes('media.example')) {
          return Promise.resolve(binRes(new Uint8Array([0xff, 0xd8, 0xff, 0xd9])));
        }
        return Promise.resolve(jsonRes({ id: 'photo-1', post_id: 'page-1_100' }));
      })
    );

    const result = await new FacebookPageAdapter().publish(
      auth,
      target,
      rendered({ mediaUrls: ['https://media.example/pic.jpg'] }),
      'post:tgt'
    );
    expect(result.externalId).toBe('page-1_100');

    // 1) the image was downloaded from our CDN, and we set NO Range header (a plain GET
    //    returns 200; it's Graph's own range-fetch that gets the 206 we're avoiding).
    const download = calls.find((c) => c.url.includes('media.example'));
    expect(download).toBeTruthy();
    expect(download?.init?.headers).toBeUndefined();

    // 2) the /photos call is multipart with a `source` file part, the caption + page
    //    token — and crucially NO `url` field (that path is what fails).
    const photoPost = calls.find((c) => c.url.includes('/photos'));
    expect(photoPost).toBeTruthy();
    const body = photoPost?.init?.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.has('source')).toBe(true);
    expect(body.has('url')).toBe(false);
    expect(body.get('caption')).toBe('Hello');
    expect(body.get('access_token')).toBe('page-token');
  });
});
