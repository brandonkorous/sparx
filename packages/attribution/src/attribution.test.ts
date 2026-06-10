import { describe, expect, it } from 'vitest';
import {
  buildLink,
  buildUtmUrl,
  captureTouch,
  classify,
  deserializeSnapshot,
  hasChannelContext,
  isValidCampaign,
  isValidSource,
  resolveFirstTouch,
  resolveLastTouch,
  serializeSnapshot,
} from './index';

describe('classify', () => {
  it('trusts an explicit medium first', () => {
    expect(classify({ medium: 'paid-social' })).toBe('paid_social');
    expect(classify({ medium: 'mcp' })).toBe('mcp_ai');
    expect(classify({ medium: 'cpc' })).toBe('paid_search');
  });

  it('infers paid from a click id when no medium', () => {
    expect(classify({ clickIds: { gclid: 'abc' } })).toBe('paid_search');
    expect(classify({ clickIds: { fbclid: 'xyz' } })).toBe('paid_social');
  });

  it('classifies by referrer host', () => {
    expect(classify({ referrerHost: 'www.google.com' })).toBe('organic_search');
    expect(classify({ referrerHost: 'news.ycombinator.com' })).toBe('community');
    expect(classify({ referrerHost: 'l.facebook.com' })).toBe('organic_social');
    expect(classify({ referrerHost: 'some-blog.example.com' })).toBe('referral');
  });

  it('detects agent traffic as mcp_ai', () => {
    expect(classify({ userAgent: 'Mozilla/5.0 ChatGPT-User/1.0' })).toBe('mcp_ai');
    expect(classify({ referrerHost: 'claude.ai' })).toBe('mcp_ai');
  });

  it('falls back to direct with no signal', () => {
    expect(classify({})).toBe('direct');
  });
});

describe('buildUtmUrl + buildLink', () => {
  it('appends normalized utm params, preserving existing query', () => {
    const url = buildUtmUrl('https://sparx.works/pricing?ref=x', {
      source: 'Product Hunt',
      medium: 'referral',
      campaign: 'Launch 2026 06',
    });
    expect(url).toContain('ref=x');
    expect(url).toContain('utm_source=product-hunt');
    expect(url).toContain('utm_medium=referral');
    expect(url).toContain('utm_campaign=launch-2026-06');
  });

  it('warns on an unknown source and a malformed campaign', () => {
    const { warnings } = buildLink({
      label: 'bad',
      destination: 'https://sparx.works/',
      source: 'myspace',
      medium: 'referral',
      campaign: 'no-date',
    });
    expect(warnings.length).toBe(2);
  });

  it('accepts the partner-{name} source pattern', () => {
    expect(isValidSource('partner-peerlist')).toBe(true);
    expect(isValidCampaign('founding-100-2026-06')).toBe(true);
  });
});

describe('captureTouch', () => {
  it('reads utm params + classifies', () => {
    const t = captureTouch({
      url: 'https://sparx.works/?utm_source=hacker-news&utm_medium=community&utm_campaign=launch-2026-06',
      capturedAt: '2026-06-09T00:00:00.000Z',
    });
    expect(t.source).toBe('hacker-news');
    expect(t.channel).toBe('community');
    expect(t.landingPath).toBe('/');
  });

  it('captures click ids only with marketing consent', () => {
    const args = {
      url: 'https://sparx.works/?gclid=abc123',
      capturedAt: '2026-06-09T00:00:00.000Z',
    };
    expect(captureTouch({ ...args, allowMarketing: false }).clickIds.gclid).toBeUndefined();
    expect(captureTouch({ ...args, allowMarketing: true }).clickIds.gclid).toBe('abc123');
  });

  it('reduces referrer to a PII-light host/path', () => {
    const t = captureTouch({
      url: 'https://sparx.works/ai',
      referrer: 'https://www.google.com/search?q=secret+query',
      capturedAt: '2026-06-09T00:00:00.000Z',
    });
    expect(t.referrer).toBe('www.google.com/search');
    expect(t.channel).toBe('organic_search');
  });
});

describe('first-touch (set-once) and last-touch (last-non-direct)', () => {
  const phTouch = captureTouch({
    url: 'https://sparx.works/?utm_source=product-hunt&utm_medium=referral&utm_campaign=launch-2026-06',
    capturedAt: '2026-06-01T00:00:00.000Z',
  });
  const directTouch = captureTouch({
    url: 'https://sparx.works/',
    capturedAt: '2026-06-05T00:00:00.000Z',
  });
  const hnTouch = captureTouch({
    url: 'https://sparx.works/?utm_source=hacker-news&utm_medium=community&utm_campaign=launch-2026-06',
    capturedAt: '2026-06-08T00:00:00.000Z',
  });

  it('keeps the original first-touch forever', () => {
    expect(resolveFirstTouch(phTouch, hnTouch).source).toBe('product-hunt');
    expect(resolveFirstTouch(null, phTouch).source).toBe('product-hunt');
  });

  it('does not let a bare direct hit overwrite last-touch', () => {
    expect(hasChannelContext(directTouch)).toBe(false);
    expect(resolveLastTouch(phTouch, directTouch).source).toBe('product-hunt');
  });

  it('lets a new channel-bearing touch update last-touch', () => {
    expect(resolveLastTouch(phTouch, hnTouch).source).toBe('hacker-news');
  });
});

describe('snapshot serialization', () => {
  it('round-trips', () => {
    const t = captureTouch({
      url: 'https://sparx.works/?utm_source=x',
      capturedAt: '2026-06-09T00:00:00.000Z',
    });
    expect(deserializeSnapshot(serializeSnapshot(t))?.source).toBe('x');
  });

  it('returns null on garbage', () => {
    expect(deserializeSnapshot('not json')).toBeNull();
    expect(deserializeSnapshot(null)).toBeNull();
    expect(deserializeSnapshot('{}')).toBeNull();
  });
});
