import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  mapPinterestMetrics,
  PinterestAdapter,
  pinterestBases,
  pinterestPermalink,
  pinterestSandbox,
  planPinterestPin,
  shouldProvisionSandboxBoard,
} from './pinterest.js';
import { isImageUrl } from './_media.js';
import type { RenderedPost } from '../types.js';

// The Pinterest adapter's pure decision logic (docs/134 Phase 3). Network calls (token
// exchange, board listing, pin create) are integration surface; here we lock the
// image-required rule, the title derivation, the permalink, and the authorize URL.

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

describe('pinterestBases', () => {
  it('uses production endpoints by default', () => {
    expect(pinterestBases(false)).toEqual({
      api: 'https://api.pinterest.com/v5',
      token: 'https://api.pinterest.com/v5/oauth/token',
    });
  });

  it('routes token exchange + API calls to the sandbox host when on', () => {
    expect(pinterestBases(true)).toEqual({
      api: 'https://api-sandbox.pinterest.com/v5',
      token: 'https://api-sandbox.pinterest.com/v5/oauth/token',
    });
  });
});

describe('pinterestSandbox', () => {
  afterEach(() => {
    delete process.env.PINTEREST_SANDBOX;
  });

  it('is false by default — production Pinterest', () => {
    expect(pinterestSandbox()).toBe(false);
  });

  it('is true only for an explicit true (whitespace + case tolerant)', () => {
    process.env.PINTEREST_SANDBOX = ' TRUE ';
    expect(pinterestSandbox()).toBe(true);
  });

  it('stays false for any non-true value (a typo must not silently switch envs)', () => {
    for (const v of ['false', '1', 'yes', '']) {
      process.env.PINTEREST_SANDBOX = v;
      expect(pinterestSandbox()).toBe(false);
    }
  });
});

describe('shouldProvisionSandboxBoard', () => {
  it('provisions a board only when sandbox mode has zero boards', () => {
    // Pinterest's sandbox starts empty, so a fresh sandbox connection has no destination
    // until we seed one — this is the guard for that.
    expect(shouldProvisionSandboxBoard(0, true)).toBe(true);
  });

  it('never provisions when the account already has a board', () => {
    expect(shouldProvisionSandboxBoard(1, true)).toBe(false);
    expect(shouldProvisionSandboxBoard(3, true)).toBe(false);
  });

  it('never provisions in production — we do not create boards on a real account', () => {
    expect(shouldProvisionSandboxBoard(0, false)).toBe(false);
    expect(shouldProvisionSandboxBoard(2, false)).toBe(false);
  });
});

describe('mapPinterestMetrics', () => {
  it('maps IMPRESSION → impressions and SAVE → shares', () => {
    expect(mapPinterestMetrics({ IMPRESSION: 1200, SAVE: 34 })).toEqual({
      impressions: 1200,
      shares: 34,
    });
  });

  it('omits metrics the platform did not report (dash, not a fake zero)', () => {
    expect(mapPinterestMetrics({ IMPRESSION: 5 })).toEqual({ impressions: 5 });
    expect(mapPinterestMetrics({})).toEqual({});
    expect(mapPinterestMetrics(undefined)).toEqual({});
  });

  it('ignores click metrics that have no home in the shared shape', () => {
    // PIN_CLICK / OUTBOUND_CLICK are deliberately dropped rather than mislabelled.
    expect(mapPinterestMetrics({ IMPRESSION: 10, PIN_CLICK: 3, OUTBOUND_CLICK: 2 })).toEqual({
      impressions: 10,
    });
  });
});

describe('planPinterestPin', () => {
  it('builds a pin from the first image with a derived title + link', () => {
    const plan = planPinterestPin(
      rendered({
        text: 'Aurora Down Jacket\nWarm and packable.',
        mediaUrls: ['https://cdn/a.jpg'],
        link: 'https://shop/p/1',
      })
    );
    expect(plan).toEqual({
      imageUrl: 'https://cdn/a.jpg',
      title: 'Aurora Down Jacket',
      description: 'Aurora Down Jacket\nWarm and packable.',
      link: 'https://shop/p/1',
    });
  });

  it('is null when there is no image (a Pin needs one)', () => {
    expect(planPinterestPin(rendered({ link: 'https://shop/p/1' }))).toBeNull();
    expect(planPinterestPin(rendered({ mediaUrls: ['https://cdn/clip.mp4'] }))).toBeNull();
  });
});

describe('pinterestPermalink', () => {
  it('builds a pinterest.com pin URL', () => {
    expect(pinterestPermalink('12345')).toBe('https://www.pinterest.com/pin/12345/');
  });
});

describe('PinterestAdapter connectUrl / isConfigured', () => {
  beforeEach(() => {
    process.env.PINTEREST_APP_ID = 'pin-app';
    process.env.PINTEREST_APP_SECRET = 'pin-secret';
  });
  afterEach(() => {
    delete process.env.PINTEREST_APP_ID;
    delete process.env.PINTEREST_APP_SECRET;
  });

  it('is configured once its env is set and requests pins:write + boards:write', () => {
    const a = new PinterestAdapter();
    expect(a.isConfigured()).toBe(true);
    const url = new URL(
      a.connectUrl({ tenantId: 't1', state: 's', redirectUri: 'https://app/cb', scopes: [] })
    );
    expect(url.origin + url.pathname).toBe('https://www.pinterest.com/oauth/');
    expect(url.searchParams.get('client_id')).toBe('pin-app');
    expect(url.searchParams.get('scope')).toContain('pins:write');
    // boards:write is REQUIRED to create a pin on a board — without it Pinterest v5
    // returns 401 "Missing: ['boards:write']". Regression guard for that exact gap.
    expect(url.searchParams.get('scope')).toContain('boards:write');
  });

  it('reports not-configured when the env is missing', () => {
    delete process.env.PINTEREST_APP_SECRET;
    expect(new PinterestAdapter().isConfigured()).toBe(false);
  });
});
