import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  LinkedInAdapter,
  appendLink,
  firstImageUrl,
  linkedInPermalink,
  planLinkedInPost,
} from './linkedin.js';
import type { RenderedPost } from '../types.js';

// The LinkedIn adapter's pure decision logic (docs/134 Slice 8). The network calls
// (OAuth, ACLs, Posts/Images) are integration surface; here we lock the media/link
// branching, the image detection, the permalink shape, and the authorize URL.

const rendered = (over: Partial<RenderedPost>): RenderedPost => ({
  text: 'Hello',
  mediaUrls: [],
  ...over,
});

describe('firstImageUrl', () => {
  it('finds an image by extension, ignoring query strings', () => {
    expect(firstImageUrl(['https://cdn.example.com/a.jpg?v=2'])).toBe(
      'https://cdn.example.com/a.jpg?v=2'
    );
    expect(firstImageUrl(['https://cdn.example.com/a.png'])).toBe('https://cdn.example.com/a.png');
  });
  it('returns null for non-image media (video)', () => {
    expect(firstImageUrl(['https://cdn.example.com/clip.mp4'])).toBeNull();
    expect(firstImageUrl([])).toBeNull();
  });
  it('picks the first image among mixed media', () => {
    expect(
      firstImageUrl(['https://cdn.example.com/clip.mp4', 'https://cdn.example.com/hero.webp'])
    ).toBe('https://cdn.example.com/hero.webp');
  });
});

describe('appendLink', () => {
  it('uses the link alone when there is no text', () => {
    expect(appendLink('', 'https://x.example.com')).toBe('https://x.example.com');
  });
  it('appends the link on its own paragraph', () => {
    expect(appendLink('Big news', 'https://x.example.com')).toBe(
      'Big news\n\nhttps://x.example.com'
    );
  });
  it('does not double a link already in the text', () => {
    expect(appendLink('See https://x.example.com now', 'https://x.example.com')).toBe(
      'See https://x.example.com now'
    );
  });
});

describe('linkedInPermalink', () => {
  it('encodes the post urn into a feed URL', () => {
    expect(linkedInPermalink('urn:li:share:123')).toBe(
      'https://www.linkedin.com/feed/update/urn%3Ali%3Ashare%3A123'
    );
  });
});

describe('planLinkedInPost', () => {
  it('uploads the image and carries the link inline', () => {
    const plan = planLinkedInPost(
      rendered({ mediaUrls: ['https://cdn.example.com/hero.jpg'], link: 'https://shop/p/1' })
    );
    expect(plan.imageUrl).toBe('https://cdn.example.com/hero.jpg');
    expect(plan.articleUrl).toBeNull();
    expect(plan.commentary).toBe('Hello\n\nhttps://shop/p/1');
  });
  it('uses an article card for a link with no image', () => {
    const plan = planLinkedInPost(rendered({ link: 'https://shop/p/1' }));
    expect(plan.imageUrl).toBeNull();
    expect(plan.articleUrl).toBe('https://shop/p/1');
    expect(plan.commentary).toBe('Hello');
  });
  it('is text-only when there is no media or link', () => {
    const plan = planLinkedInPost(rendered({}));
    expect(plan).toEqual({ commentary: 'Hello', imageUrl: null, articleUrl: null });
  });
  it('treats a video (no link) as text-only, not a failed image upload', () => {
    const plan = planLinkedInPost(rendered({ mediaUrls: ['https://cdn.example.com/clip.mp4'] }));
    expect(plan.imageUrl).toBeNull();
    expect(plan.articleUrl).toBeNull();
  });
});

describe('LinkedInAdapter connectUrl / isConfigured', () => {
  beforeEach(() => {
    process.env.LINKEDIN_CLIENT_ID = 'test-client';
    process.env.LINKEDIN_CLIENT_SECRET = 'test-secret';
  });
  afterEach(() => {
    delete process.env.LINKEDIN_CLIENT_ID;
    delete process.env.LINKEDIN_CLIENT_SECRET;
  });

  it('is configured once its env is set, and builds the authorize URL', () => {
    const a = new LinkedInAdapter();
    expect(a.isConfigured()).toBe(true);
    const url = new URL(
      a.connectUrl({
        tenantId: 't1',
        state: 'signed-state',
        redirectUri: 'https://app.example.com/social/callback',
        scopes: [],
      })
    );
    expect(url.origin + url.pathname).toBe('https://www.linkedin.com/oauth/v2/authorization');
    expect(url.searchParams.get('client_id')).toBe('test-client');
    expect(url.searchParams.get('state')).toBe('signed-state');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toContain('w_organization_social');
  });

  it('reports not-configured when the env is missing', () => {
    delete process.env.LINKEDIN_CLIENT_ID;
    expect(new LinkedInAdapter().isConfigured()).toBe(false);
  });
});
