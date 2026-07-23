import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ThreadsAdapter, planThreadsPost, threadsPermalink } from './threads.js';
import type { RenderedPost } from '../types.js';

// The Threads adapter's pure decision logic (docs/134 Phase 2). The two-step publish +
// its separate host are integration surface; here we lock the text/image/carousel/video
// branching (native link attachment vs. folded-in link) and the authorize URL.

const rendered = (over: Partial<RenderedPost>): RenderedPost => ({
  text: 'Hello',
  mediaUrls: [],
  ...over,
});

describe('planThreadsPost', () => {
  it('is a text post with a native link attachment (Threads posts text-only)', () => {
    expect(planThreadsPost(rendered({ link: 'https://shop/p/1' }))).toEqual({
      kind: 'text',
      text: 'Hello',
      link: 'https://shop/p/1',
    });
  });

  it('is a plain text post with no media or link', () => {
    expect(planThreadsPost(rendered({}))).toEqual({ kind: 'text', text: 'Hello', link: null });
  });

  it('is a single image, folding the link into the text (no link field on media)', () => {
    expect(
      planThreadsPost(rendered({ mediaUrls: ['https://cdn/a.jpg'], link: 'https://shop/p/1' }))
    ).toEqual({ kind: 'image', imageUrl: 'https://cdn/a.jpg', text: 'Hello\n\nhttps://shop/p/1' });
  });

  it('is a carousel with more than one image', () => {
    expect(
      planThreadsPost(rendered({ mediaUrls: ['https://cdn/a.jpg', 'https://cdn/b.png'] }))
    ).toEqual({
      kind: 'carousel',
      imageUrls: ['https://cdn/a.jpg', 'https://cdn/b.png'],
      text: 'Hello',
    });
  });

  it('is a video for a lone non-image', () => {
    expect(planThreadsPost(rendered({ mediaUrls: ['https://cdn/clip.mp4'] }))).toEqual({
      kind: 'video',
      videoUrl: 'https://cdn/clip.mp4',
      text: 'Hello',
    });
  });
});

describe('threadsPermalink', () => {
  it('builds a threads.net URL from the post id', () => {
    expect(threadsPermalink('abc123')).toBe('https://www.threads.net/t/abc123');
  });
});

describe('ThreadsAdapter connectUrl / isConfigured', () => {
  beforeEach(() => {
    process.env.THREADS_APP_ID = 'threads-app';
    process.env.THREADS_APP_SECRET = 'threads-secret';
  });
  afterEach(() => {
    delete process.env.THREADS_APP_ID;
    delete process.env.THREADS_APP_SECRET;
  });

  it('uses its own app credentials + host and requests the publish scope', () => {
    const a = new ThreadsAdapter();
    expect(a.isConfigured()).toBe(true);
    const url = new URL(
      a.connectUrl({ tenantId: 't1', state: 's', redirectUri: 'https://app/cb', scopes: [] })
    );
    expect(url.origin + url.pathname).toBe('https://threads.net/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('threads-app');
    expect(url.searchParams.get('scope')).toContain('threads_content_publish');
  });

  it('reports not-configured when the env is missing', () => {
    delete process.env.THREADS_APP_ID;
    expect(new ThreadsAdapter().isConfigured()).toBe(false);
  });
});
