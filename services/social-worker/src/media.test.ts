import { describe, expect, it } from 'vitest';

import {
  isUrlFetchPlatform,
  needsDirectHost,
  preferredAspectFor,
  swapMediaHost,
  variantUrlPath,
} from './media.js';

// Lock the platform → crop mapping (docs/133 §8). The media worker generates only the
// four core crops (1:1 / 4:5 / 9:16 / 16:9); every platform's declared ratio snaps to
// the nearest of those by log-distance, so a post's image publishes correctly framed.

describe('preferredAspectFor', () => {
  it('maps each platform to one of the four core crops', () => {
    // Square-first feeds → 1:1 (the first declared ratio wins).
    expect(preferredAspectFor('instagram')).toBe('1:1');
    expect(preferredAspectFor('facebook_page')).toBe('1:1');
    expect(preferredAspectFor('threads')).toBe('1:1');
    expect(preferredAspectFor('linkedin')).toBe('1:1');
    expect(preferredAspectFor('x')).toBe('16:9');
    // Google Business Profile is 4:3 — the geometric midpoint of 1:1 and 16:9; the
    // tie resolves to the squarer crop.
    expect(preferredAspectFor('google_business')).toBe('1:1');
    // Vertical-first platforms → 9:16 (TikTok 9:16 exactly, Pinterest 2:3 nearest).
    expect(preferredAspectFor('tiktok')).toBe('9:16');
    expect(preferredAspectFor('pinterest')).toBe('9:16');
    // YouTube is a SHORTS uploader, not community posts — there is no public API to
    // create a community post, so a YouTube post is a vertical short video (docs/134
    // Phase 3). It declared 1:1 while the slot was still notionally community posts.
    expect(preferredAspectFor('youtube')).toBe('9:16');
  });

  it('only ever returns a crop the worker actually generates', () => {
    const generated = new Set(['1:1', '4:5', '9:16', '16:9']);
    const platforms = [
      'google_business',
      'linkedin',
      'facebook_page',
      'instagram',
      'threads',
      'x',
      'tiktok',
      'pinterest',
      'youtube',
    ] as const;
    for (const p of platforms) {
      expect(generated.has(preferredAspectFor(p))).toBe(true);
    }
  });
});

// The public URL a platform fetches a post's image from must be the THREE-segment shape
// the serving route matches (docs/brain/apps/services.md). The stored variant key is FOUR
// segments — its middle `variants/` is bucket convention, not part of the URL. Emitting
// the raw key gives a URL Facebook (etc.) can't fetch, so the image never posts — this
// locks the strip that the media resolver applies.
describe('variantUrlPath', () => {
  it('drops the middle `variants/` so the URL path is three segments', () => {
    const key = 'tenant-1/variants/asset-9/jpeg-1x1-1080.jpg';
    expect(variantUrlPath(key)).toBe('tenant-1/asset-9/jpeg-1x1-1080.jpg');
    expect(variantUrlPath(key).split('/')).toHaveLength(3);
  });

  it('only strips the first `variants/` (ids never embed it, but be exact)', () => {
    expect(variantUrlPath('t/variants/a/webp-800.webp')).toBe('t/a/webp-800.webp');
  });
});

// Instagram/Threads/Pinterest publish by handing THEIR servers an image_url; Cloudflare
// answers any `Range: bytes=0-` with a `206 Partial Content` and those platforms reject
// it, so the image silently drops. They fetch from a DNS-only direct-origin host that
// bypasses CF. Facebook/LinkedIn byte-upload (download via this worker, no Range) and
// keep the CDN host. This locks which platforms swap hosts, and the swap itself.
describe('URL-fetch host routing', () => {
  it('routes the image-by-url-fetch platforms to the direct host', () => {
    // Fetch an IMAGE by URL (image_url / sourceUrl) → reject a 206 → need the direct host.
    for (const p of ['instagram', 'threads', 'pinterest', 'google_business'] as const) {
      expect(isUrlFetchPlatform(p)).toBe(true);
    }
    // Byte-upload (facebook/linkedin/youtube), text (x), and TikTok (splits by kind — see
    // needsDirectHost, so it's not a whole-platform member) keep the CDN host here.
    for (const p of ['facebook_page', 'linkedin', 'youtube', 'x', 'tiktok'] as const) {
      expect(isUrlFetchPlatform(p)).toBe(false);
    }
  });

  it('routes TikTok PHOTO posts to the direct host but leaves its video on the CDN host', () => {
    // TikTok photo posts pull an image_url → same 206 wall as Instagram/Pinterest.
    expect(needsDirectHost('tiktok', 'image')).toBe(true);
    // TikTok video ingest expects range/206 → stays on the CDN host.
    expect(needsDirectHost('tiktok', 'video')).toBe(false);
    // The pure URL-fetch platforms need the direct host for either kind.
    for (const p of ['instagram', 'threads', 'pinterest', 'google_business'] as const) {
      expect(needsDirectHost(p, 'image')).toBe(true);
      expect(needsDirectHost(p, 'video')).toBe(true);
    }
    // Byte-upload platforms never swap.
    expect(needsDirectHost('facebook_page', 'image')).toBe(false);
    expect(needsDirectHost('youtube', 'video')).toBe(false);
  });

  it('swaps the public base prefix for the direct base, path intact', () => {
    const pub = 'https://media.sparx.works';
    const dir = 'https://media-direct.sparx.works';
    const url = `${pub}/v1/public/media/variants/t/a/jpeg-1x1-1080.jpg`;
    expect(swapMediaHost(url, pub, dir)).toBe(
      `${dir}/v1/public/media/variants/t/a/jpeg-1x1-1080.jpg`
    );
  });

  it('tolerates a trailing slash on either base', () => {
    expect(swapMediaHost('https://a.co/x/y.jpg', 'https://a.co/', 'https://b.co/')).toBe(
      'https://b.co/x/y.jpg'
    );
  });

  it('is a no-op when the direct base is unset (preserves pre-fix behavior)', () => {
    const url = 'https://media.sparx.works/v1/public/media/variants/t/a/jpeg-1x1-1080.jpg';
    expect(swapMediaHost(url, 'https://media.sparx.works', undefined)).toBe(url);
  });

  it('is a no-op when the URL is not on the public base (external/hot-linked media)', () => {
    const url = 'https://cdn.example.com/img.jpg';
    expect(
      swapMediaHost(url, 'https://media.sparx.works', 'https://media-direct.sparx.works')
    ).toBe(url);
  });
});
