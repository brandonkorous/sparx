import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  LinkedInAdapter,
  appendLink,
  firstImageUrl,
  linkedInPermalink,
  mapLinkedInMetrics,
  planLinkedInPost,
} from './linkedin.js';
import { isImageUrl } from './_media.js';
import type { MediaRef, RenderedPost } from '../types.js';

// The LinkedIn adapter's pure decision logic (docs/134 Slice 8). The network calls
// (OAuth, ACLs, Posts/Images) are integration surface; here we lock the media/link
// branching, the image detection, the permalink shape, and the authorize URL.

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

describe('firstImageUrl', () => {
  const image = (url: string): MediaRef => ({ url, kind: 'image' });
  const video = (url: string): MediaRef => ({ url, kind: 'video' });

  it('finds an image, query strings and all', () => {
    expect(firstImageUrl([image('https://cdn.example.com/a.jpg?v=2')])).toBe(
      'https://cdn.example.com/a.jpg?v=2'
    );
    expect(firstImageUrl([image('https://cdn.example.com/a.png')])).toBe(
      'https://cdn.example.com/a.png'
    );
  });
  it('returns null for non-image media (video)', () => {
    expect(firstImageUrl([video('https://cdn.example.com/clip.mp4')])).toBeNull();
    expect(firstImageUrl([])).toBeNull();
  });
  it('picks the first image among mixed media', () => {
    expect(
      firstImageUrl([video('https://cdn.example.com/clip.mp4'), image('https://cdn/hero.webp')])
    ).toBe('https://cdn/hero.webp');
  });
  it('finds an extensionless stock image — the case the old extension test could not', () => {
    expect(firstImageUrl([image('https://images.unsplash.com/photo-1588850561407')])).toBe(
      'https://images.unsplash.com/photo-1588850561407'
    );
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

describe('mapLinkedInMetrics', () => {
  it('folds both reads together when the admin-scoped statistics come back', () => {
    expect(
      mapLinkedInMetrics(
        {
          likesSummary: { totalLikes: 12 },
          commentsSummary: { aggregatedTotalComments: 5, totalFirstLevelComments: 3 },
        },
        {
          totalShareStatistics: {
            impressionCount: 1000,
            uniqueImpressionsCount: 820,
            shareCount: 4,
          },
        }
      )
    ).toEqual({ likes: 12, comments: 5, shares: 4, impressions: 1000, reach: 820 });
  });

  // The whole point of the best-effort split: no statistics must never cost us the counts.
  it('keeps the counts when the statistics call was skipped', () => {
    expect(
      mapLinkedInMetrics(
        { likesSummary: { totalLikes: 7 }, commentsSummary: { aggregatedTotalComments: 2 } },
        undefined
      )
    ).toEqual({ likes: 7, comments: 2 });
  });

  it('counts replies as comments, falling back to first-level when that is all there is', () => {
    expect(
      mapLinkedInMetrics({ commentsSummary: { totalFirstLevelComments: 3 } }, undefined)
    ).toEqual({ comments: 3 });
  });

  it('prefers the live socialActions counters over the lagging statistics aggregate', () => {
    expect(
      mapLinkedInMetrics(
        { likesSummary: { totalLikes: 12 } },
        { totalShareStatistics: { likeCount: 9, commentCount: 4 } }
      )
    ).toMatchObject({ likes: 12, comments: 4 });
  });

  // Null, never zero — an absent metric must stay absent so the UI shows "—".
  it('omits every metric the platform did not report', () => {
    expect(mapLinkedInMetrics(undefined, undefined)).toEqual({});
    expect(mapLinkedInMetrics({}, { totalShareStatistics: {} })).toEqual({});
  });
});
