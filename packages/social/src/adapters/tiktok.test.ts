import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  TikTokAdapter,
  classifyTikTokAudit,
  classifyTikTokStatus,
  mapTikTokMetrics,
  pickPrivacyLevel,
  planTikTokPost,
  tiktokAllowsPublic,
} from './tiktok.js';
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

describe('tiktokAllowsPublic', () => {
  afterEach(() => {
    delete process.env.TIKTOK_AUDITED;
  });

  it('is false by default — an unaudited app is limited to SELF_ONLY (private)', () => {
    expect(tiktokAllowsPublic()).toBe(false);
  });

  it('is true only when TIKTOK_AUDITED is explicitly set to true (audited app)', () => {
    process.env.TIKTOK_AUDITED = 'true';
    expect(tiktokAllowsPublic()).toBe(true);
    process.env.TIKTOK_AUDITED = ' TRUE '; // tolerates whitespace/case from a secret
    expect(tiktokAllowsPublic()).toBe(true);
  });

  it('stays false for any non-true value (a typo must not accidentally go public)', () => {
    for (const v of ['false', '1', 'yes', '']) {
      process.env.TIKTOK_AUDITED = v;
      expect(tiktokAllowsPublic()).toBe(false);
    }
  });
});

// pickPrivacyLevel is used ONLY on the audited path (unaudited forces SELF_ONLY before it
// is ever reached). Given the creator's allowed options, it publishes to the widest.
describe('pickPrivacyLevel', () => {
  it('publishes to the widest audience the account allows (public when offered)', () => {
    expect(pickPrivacyLevel(['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'])).toBe(
      'PUBLIC_TO_EVERYONE'
    );
  });

  it('falls back to SELF_ONLY when public is not offered (e.g. a private account)', () => {
    expect(pickPrivacyLevel(['SELF_ONLY'])).toBe('SELF_ONLY');
    expect(pickPrivacyLevel(['MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'])).toBe('SELF_ONLY');
  });

  it('defaults to SELF_ONLY when the options are empty (a creator_info hiccup)', () => {
    expect(pickPrivacyLevel([])).toBe('SELF_ONLY');
  });

  it('uses the first option when neither public nor SELF_ONLY is present', () => {
    expect(pickPrivacyLevel(['MUTUAL_FOLLOW_FRIENDS'])).toBe('MUTUAL_FOLLOW_FRIENDS');
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

// TikTok exposes no "is my app approved" endpoint, so the audit verdict is read out of
// the audiences it will accept. The asymmetry is the whole point: a public option can
// only come from an approved app, but private-only has two possible causes.
describe('classifyTikTokAudit', () => {
  it('reads a public option as proof the audit passed', () => {
    expect(classifyTikTokAudit(['PUBLIC_TO_EVERYONE', 'SELF_ONLY']).appReview).toBe('passed');
    expect(classifyTikTokAudit(['MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY']).appReview).toBe('passed');
  });

  it('reads private-only as still pending, and names the other cause', () => {
    const probe = classifyTikTokAudit(['SELF_ONLY']);
    expect(probe.appReview).toBe('pending');
    // Reporting "still under review" about an already-approved app sends someone to
    // TikTok support for a problem that lives in their own account settings.
    expect(probe.detail).toMatch(/set to private/i);
  });

  it('is unknown when TikTok said nothing, rather than guessing pending', () => {
    expect(classifyTikTokAudit([]).appReview).toBe('unknown');
  });

  it('never claims to have read scopes — this probe is about the app, not the grant', () => {
    expect(classifyTikTokAudit(['PUBLIC_TO_EVERYONE']).grantedScopes).toBeNull();
  });
});

describe('tiktok insights scope gating', () => {
  const OLD = process.env;
  beforeEach(() => {
    process.env = { ...OLD, TIKTOK_CLIENT_KEY: 'key', TIKTOK_CLIENT_SECRET: 'secret' };
  });
  afterEach(() => {
    process.env = OLD;
  });

  // video.list is granted separately from video.publish, and the scope must widen at
  // CONNECT — a token minted without it can never read metrics later.
  it('leaves the posting scope alone while the review is pending', () => {
    delete process.env.TIKTOK_INSIGHTS_ENABLED;
    expect(new TikTokAdapter().requiredScopes()).not.toContain('video.list');
  });

  it('requests video.list once the flag is on', () => {
    process.env.TIKTOK_INSIGHTS_ENABLED = 'true';
    const scopes = new TikTokAdapter().requiredScopes();
    expect(scopes).toContain('video.list');
    expect(scopes).toContain('video.publish');
  });
});

describe('mapTikTokMetrics', () => {
  it('maps all four counters, views standing in for impressions', () => {
    expect(
      mapTikTokMetrics({
        like_count: 120,
        comment_count: 8,
        share_count: 15,
        view_count: 4300,
      })
    ).toEqual({ likes: 120, comments: 8, shares: 15, impressions: 4300 });
  });

  it('never invents reach, which TikTok does not report', () => {
    expect(mapTikTokMetrics({ view_count: 4300 }).reach).toBeUndefined();
  });

  // A removed video comes back as an empty list — dashes, not zeros.
  it('omits anything the platform did not report', () => {
    expect(mapTikTokMetrics(undefined)).toEqual({});
    expect(mapTikTokMetrics({})).toEqual({});
  });
});
