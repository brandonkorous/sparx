import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  YouTubeAdapter,
  mapYouTubeMetrics,
  planYouTubeShort,
  youtubeShortsPermalink,
} from './youtube.js';
import { isImageUrl } from './_media.js';
import type { RenderedPost } from '../types.js';

// The YouTube adapter's pure decision logic (docs/134 Phase 3). The resumable upload is
// integration surface; here we lock the video-required rule, the #Shorts title, the
// permalink, and the authorize URL.

const rendered = (over: Partial<RenderedPost>): RenderedPost => {
  const base = { text: 'Hello', mediaUrls: [] as string[], ...over };
  return {
    ...base,
    // These fixtures express attachments as bare URLs. Real posts carry MediaRef.kind
    // from the asset's MIME type; here we classify the way the media resolver would, so
    // a `.jpg` fixture stays an image and a `.mp4` stays a video.
    media:
      over.media ??
      base.mediaUrls.map((url) => ({ url, kind: isImageUrl(url) ? 'image' : 'video' }) as const),
  };
};

describe('planYouTubeShort', () => {
  it('builds a Short from the video, appending #Shorts to the title', () => {
    const plan = planYouTubeShort(
      rendered({
        text: 'Behind the scenes',
        mediaUrls: ['https://cdn/clip.mp4'],
        link: 'https://shop/p/1',
      })
    );
    expect(plan).toEqual({
      videoUrl: 'https://cdn/clip.mp4',
      title: 'Behind the scenes #Shorts',
      description: 'Behind the scenes\n\nhttps://shop/p/1',
    });
  });

  it('does not double a #Shorts already in the title', () => {
    const plan = planYouTubeShort(
      rendered({ text: 'Big reveal #shorts', mediaUrls: ['https://cdn/clip.mp4'] })
    );
    expect(plan?.title).toBe('Big reveal #shorts');
  });

  it('is null when there is no video (images/text only)', () => {
    expect(planYouTubeShort(rendered({ mediaUrls: ['https://cdn/a.jpg'] }))).toBeNull();
    expect(planYouTubeShort(rendered({}))).toBeNull();
  });
});

describe('youtubeShortsPermalink', () => {
  it('builds a youtube.com/shorts URL', () => {
    expect(youtubeShortsPermalink('abc123')).toBe('https://www.youtube.com/shorts/abc123');
  });
});

describe('YouTubeAdapter connectUrl / isConfigured', () => {
  beforeEach(() => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'goog-id';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'goog-secret';
  });
  afterEach(() => {
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  });

  it('reuses the Google web client and requests the upload scope offline', () => {
    const a = new YouTubeAdapter();
    expect(a.isConfigured()).toBe(true);
    const url = new URL(
      a.connectUrl({ tenantId: 't1', state: 's', redirectUri: 'https://app/cb', scopes: [] })
    );
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('goog-id');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('scope')).toContain('youtube.upload');
  });

  it('reports not-configured when the env is missing', () => {
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    expect(new YouTubeAdapter().isConfigured()).toBe(false);
  });
});

describe('mapYouTubeMetrics', () => {
  // YouTube sends every counter as a string; a naive read would store "4300" or NaN.
  it('parses the string counters into numbers', () => {
    expect(mapYouTubeMetrics({ viewCount: '4300', likeCount: '120', commentCount: '8' })).toEqual({
      impressions: 4300,
      likes: 120,
      comments: 8,
    });
  });

  // A creator who hides the like count gets the field omitted, not zeroed.
  it('omits a counter the owner has hidden', () => {
    expect(mapYouTubeMetrics({ viewCount: '10' })).toEqual({ impressions: 10 });
  });

  it('never invents shares or reach, which this edge does not report', () => {
    const metrics = mapYouTubeMetrics({ viewCount: '10' });
    expect(metrics.shares).toBeUndefined();
    expect(metrics.reach).toBeUndefined();
  });

  it('drops unparseable values rather than storing NaN', () => {
    expect(mapYouTubeMetrics({ viewCount: 'lots', likeCount: '' })).toEqual({});
    expect(mapYouTubeMetrics(undefined)).toEqual({});
  });
});
