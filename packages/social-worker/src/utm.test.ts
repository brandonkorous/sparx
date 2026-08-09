import { describe, expect, it } from 'vitest';

import { tagSocialLink } from './utm.js';

// A fixed instant so the campaign month is deterministic (utm_campaign=social-2026-07).
const WHEN = new Date('2026-07-24T15:00:00.000Z');

/** Read the utm_* params off a tagged URL for assertions. */
function params(url: string): URLSearchParams {
  return new URL(url).searchParams;
}

describe('tagSocialLink', () => {
  it('tags a plain link with source/medium/campaign/content', () => {
    const out = tagSocialLink('https://shop.example.com/sale', 'linkedin', WHEN);
    const p = params(out!);
    expect(p.get('utm_source')).toBe('linkedin');
    expect(p.get('utm_medium')).toBe('organic-social');
    expect(p.get('utm_campaign')).toBe('social-2026-07');
    expect(p.get('utm_content')).toBe('linkedin');
  });

  it('collapses the Meta family to source `meta`, keeping the platform in utm_content', () => {
    const ig = params(tagSocialLink('https://ex.com/', 'instagram', WHEN)!);
    const fb = params(tagSocialLink('https://ex.com/', 'facebook_page', WHEN)!);
    expect(ig.get('utm_source')).toBe('meta');
    expect(fb.get('utm_source')).toBe('meta');
    // …but the specific surface is still distinguishable.
    expect(ig.get('utm_content')).toBe('instagram');
    expect(fb.get('utm_content')).toBe('facebook-page');
  });

  it('preserves an existing query string on the destination', () => {
    const p = params(tagSocialLink('https://ex.com/p?ref=abc&id=7', 'x', WHEN)!);
    expect(p.get('ref')).toBe('abc');
    expect(p.get('id')).toBe('7');
    expect(p.get('utm_source')).toBe('x');
  });

  it('leaves a link the author already UTM-tagged untouched', () => {
    const already = 'https://ex.com/p?utm_source=newsletter&utm_medium=email';
    expect(tagSocialLink(already, 'linkedin', WHEN)).toBe(already);
  });

  it('passes a non-http(s) link through unchanged', () => {
    expect(tagSocialLink('mailto:hi@ex.com', 'x', WHEN)).toBe('mailto:hi@ex.com');
    expect(tagSocialLink('@handle', 'x', WHEN)).toBe('@handle');
  });

  it('returns undefined when there is no link', () => {
    expect(tagSocialLink(undefined, 'x', WHEN)).toBeUndefined();
  });

  it('maps Google Business, Pinterest, TikTok and YouTube to their registered sources', () => {
    const src = (platform: Parameters<typeof tagSocialLink>[1]) =>
      params(tagSocialLink('https://ex.com/', platform, WHEN)!).get('utm_source');
    expect(src('google_business')).toBe('google');
    expect(src('pinterest')).toBe('pinterest');
    expect(src('tiktok')).toBe('tiktok');
    expect(src('youtube')).toBe('youtube');
  });
});
