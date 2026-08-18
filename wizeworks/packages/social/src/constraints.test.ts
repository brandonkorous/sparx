import { describe, expect, it } from 'vitest';

import { PLATFORM_CONSTRAINTS, constraintsFor } from './constraints.js';
import type { SocialPlatform } from './types.js';

const ALL_PLATFORMS: SocialPlatform[] = [
  'facebook_page',
  'instagram',
  'threads',
  'linkedin',
  'google_business',
  'x',
  'tiktok',
  'pinterest',
  'youtube',
];

describe('PLATFORM_CONSTRAINTS', () => {
  it('defines constraints for every platform in the union', () => {
    for (const p of ALL_PLATFORMS) {
      expect(PLATFORM_CONSTRAINTS[p], p).toBeDefined();
    }
  });

  it('has coherent values (positive limits, non-empty supported media)', () => {
    for (const p of ALL_PLATFORMS) {
      const c = PLATFORM_CONSTRAINTS[p];
      expect(c.maxTextLength, p).toBeGreaterThan(0);
      expect(c.maxMediaCount, p).toBeGreaterThan(0);
      expect(c.supportedMedia.length, p).toBeGreaterThan(0);
    }
  });

  it('never marks a platform requiresMedia while supporting no media', () => {
    for (const p of ALL_PLATFORMS) {
      const c = PLATFORM_CONSTRAINTS[p];
      if (c.requiresMedia) expect(c.supportedMedia.length, p).toBeGreaterThan(0);
    }
  });

  it('marks the media-first platforms as requiring media', () => {
    expect(PLATFORM_CONSTRAINTS.instagram.requiresMedia).toBe(true);
    expect(PLATFORM_CONSTRAINTS.tiktok.requiresMedia).toBe(true);
    expect(PLATFORM_CONSTRAINTS.pinterest.requiresMedia).toBe(true);
  });
});

describe('constraintsFor', () => {
  it('returns the constraints for a known platform', () => {
    expect(constraintsFor('x').maxTextLength).toBe(280);
  });

  it('throws on an unknown platform rather than returning a silent default', () => {
    expect(() => constraintsFor('myspace' as SocialPlatform)).toThrow(/no posting constraints/i);
  });
});
