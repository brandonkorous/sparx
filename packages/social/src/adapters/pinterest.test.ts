import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  mapPinterestMetrics,
  PinterestAdapter,
  pinterestPermalink,
  planPinterestPin,
} from './pinterest.js';
import type { RenderedPost } from '../types.js';

// The Pinterest adapter's pure decision logic (docs/134 Phase 3). Network calls (token
// exchange, board listing, pin create) are integration surface; here we lock the
// image-required rule, the title derivation, the permalink, and the authorize URL.

const rendered = (over: Partial<RenderedPost>): RenderedPost => ({
  text: 'Hello',
  mediaUrls: [],
  ...over,
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
