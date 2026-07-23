import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TikTokAdapter, classifyTikTokStatus, planTikTokPost } from './tiktok.js';
import type { RenderedPost } from '../types.js';

// The TikTok adapter's pure decision logic (docs/134 Phase 3). The two-step init/status
// Content Posting API is integration surface; here we lock the video/photo branching,
// the status classification, and the authorize URL.

const rendered = (over: Partial<RenderedPost>): RenderedPost => ({
  text: 'Hello',
  mediaUrls: [],
  ...over,
});

describe('planTikTokPost', () => {
  it('is a video post, folding the link into the caption', () => {
    expect(
      planTikTokPost(rendered({ mediaUrls: ['https://cdn/clip.mp4'], link: 'https://shop/p/1' }))
    ).toEqual({
      kind: 'video',
      videoUrl: 'https://cdn/clip.mp4',
      caption: 'Hello\n\nhttps://shop/p/1',
    });
  });

  it('prefers video when both a video and images are attached', () => {
    const plan = planTikTokPost(
      rendered({ mediaUrls: ['https://cdn/a.jpg', 'https://cdn/clip.mp4'] })
    );
    expect(plan.kind).toBe('video');
  });

  it('is a photo post when only images are attached', () => {
    expect(
      planTikTokPost(rendered({ mediaUrls: ['https://cdn/a.jpg', 'https://cdn/b.png'] }))
    ).toEqual({
      kind: 'photo',
      imageUrls: ['https://cdn/a.jpg', 'https://cdn/b.png'],
      caption: 'Hello',
    });
  });

  it('is none with no media (the renderer blocks it upstream)', () => {
    expect(planTikTokPost(rendered({}))).toEqual({ kind: 'none' });
  });
});

describe('classifyTikTokStatus', () => {
  it('maps PUBLISH_COMPLETE → ready and FAILED → failed', () => {
    expect(classifyTikTokStatus('PUBLISH_COMPLETE')).toEqual({ ready: true, failed: false });
    expect(classifyTikTokStatus('FAILED')).toEqual({ ready: false, failed: true });
  });
  it('treats download/processing states as still working', () => {
    expect(classifyTikTokStatus('PROCESSING_DOWNLOAD')).toEqual({ ready: false, failed: false });
    expect(classifyTikTokStatus(undefined)).toEqual({ ready: false, failed: false });
  });
});

describe('TikTokAdapter connectUrl / isConfigured', () => {
  beforeEach(() => {
    process.env.TIKTOK_CLIENT_KEY = 'tt-key';
    process.env.TIKTOK_CLIENT_SECRET = 'tt-secret';
  });
  afterEach(() => {
    delete process.env.TIKTOK_CLIENT_KEY;
    delete process.env.TIKTOK_CLIENT_SECRET;
  });

  it('is configured once its env is set and passes client_key + publish scope', () => {
    const a = new TikTokAdapter();
    expect(a.isConfigured()).toBe(true);
    const url = new URL(
      a.connectUrl({ tenantId: 't1', state: 's', redirectUri: 'https://app/cb', scopes: [] })
    );
    expect(url.origin + url.pathname).toBe('https://www.tiktok.com/v2/auth/authorize/');
    expect(url.searchParams.get('client_key')).toBe('tt-key');
    expect(url.searchParams.get('scope')).toContain('video.publish');
  });

  it('reports not-configured when the env is missing', () => {
    delete process.env.TIKTOK_CLIENT_KEY;
    expect(new TikTokAdapter().isConfigured()).toBe(false);
  });
});
