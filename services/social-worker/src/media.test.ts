import { describe, expect, it } from 'vitest';

import { preferredAspectFor } from './media.js';

// Lock the platform → crop mapping (docs/133 §8). The media worker generates only the
// four core crops (1:1 / 4:5 / 9:16 / 16:9); every platform's declared ratio snaps to
// the nearest of those by log-distance, so a post's image publishes correctly framed.

describe('preferredAspectFor', () => {
  it('maps each platform to one of the four core crops', () => {
    // Square-first feeds → 1:1 (the first declared ratio wins).
    expect(preferredAspectFor('instagram')).toBe('1:1');
    expect(preferredAspectFor('facebook_page')).toBe('1:1');
    expect(preferredAspectFor('threads')).toBe('1:1');
    expect(preferredAspectFor('linkedin')).toBe('1:1');
    expect(preferredAspectFor('x')).toBe('16:9');
    // Google Business Profile is 4:3 — the geometric midpoint of 1:1 and 16:9; the
    // tie resolves to the squarer crop.
    expect(preferredAspectFor('google_business')).toBe('1:1');
    // Vertical-first platforms → 9:16 (TikTok 9:16 exactly, Pinterest 2:3 nearest).
    expect(preferredAspectFor('tiktok')).toBe('9:16');
    expect(preferredAspectFor('pinterest')).toBe('9:16');
    // YouTube community posts declare 1:1 first.
    expect(preferredAspectFor('youtube')).toBe('1:1');
  });

  it('only ever returns a crop the worker actually generates', () => {
    const generated = new Set(['1:1', '4:5', '9:16', '16:9']);
    const platforms = [
      'google_business',
      'linkedin',
      'facebook_page',
      'instagram',
      'threads',
      'x',
      'tiktok',
      'pinterest',
      'youtube',
    ] as const;
    for (const p of platforms) {
      expect(generated.has(preferredAspectFor(p))).toBe(true);
    }
  });
});
