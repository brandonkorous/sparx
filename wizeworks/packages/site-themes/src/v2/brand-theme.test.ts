// The theme a tenant who has themed NOTHING renders in.
//
// This is the path most sites are on: the Design inspector is something an author
// opens on purpose and many never do, so `tenantTheme(EMPTY_BRAND, …)` — no brand
// row, no stored preset — is what api-rest hands the storefront for a large share of
// tenants, and what the OG card's accent is read from.
//
// It went unguarded, and what it compiled was one product's flagship palette. Three
// of the four live tenants of the OTHER brand with no theme of their own were
// serving that product's primary on their own social cards
// (piggles/docs/personas/issues/343). Nothing was broken enough to notice: a real
// color, on a real card, for a real business, belonging to a company the shop owner
// has never heard of.

import { describe, expect, it } from 'vitest';

import { EMPTY_BRAND, tenantTheme } from './brand-theme';
import { PLATFORM_PRESET_V2 } from '../presets';

describe('tenantTheme with nothing themed', () => {
  const theme = tenantTheme(EMPTY_BRAND, { themeKey: 'default' });

  it('compiles to the platform base', () => {
    expect(theme?.tokens['--color-primary']).toBe(PLATFORM_PRESET_V2.light.primary);
    expect(theme?.tokens['--color-base-100']).toBe(PLATFORM_PRESET_V2.light.base100);
  });

  it('carries no product brand color', () => {
    // The two that were actually on the screen, and the other brand's, so this fails
    // whichever direction a future default leans.
    const painted = Object.values(theme?.tokens ?? {}).map((v) => v.toLowerCase());
    for (const brandHex of ['#e04631', '#f2604b', '#ff6f86']) {
      expect(painted, brandHex).not.toContain(brandHex);
    }
  });
});
