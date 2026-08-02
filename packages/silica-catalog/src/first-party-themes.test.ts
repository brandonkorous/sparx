// The bar for the shipped theme catalog. These themes are CODE, so the failure
// mode is not "the ingest didn't run" any more — it is "a silicaui bump added a
// preset and nobody wrote its copy", which would otherwise reach customers as a
// card with an empty tagline. That is what this file catches.

import { describe, expect, it } from 'vitest';
import { THEME_PRESETS } from '@wizeworks/silicaui-html';

import { SPARX_THEMES } from './themes';
import {
  FIRST_PARTY_THEMES,
  SILICA_THEME_META,
  SPARX_THEME_META,
  firstPartyTheme,
  isFirstPartyThemeSlug,
} from './first-party-themes';

describe('first-party theme catalog', () => {
  it('lists every sparx shelf and every silica preset', () => {
    expect(FIRST_PARTY_THEMES).toHaveLength(SPARX_THEMES.length + THEME_PRESETS.length);
  });

  // The reason this file exists: a preset with no copy is silently dropped from
  // the list, so without this the page just gets quietly shorter.
  it('has marketplace copy for every silica preset', () => {
    const missing = THEME_PRESETS.filter((t) => !SILICA_THEME_META[t.name]).map((t) => t.name);
    expect(missing).toEqual([]);
  });

  it('has marketplace copy for every sparx shelf', () => {
    const missing = SPARX_THEMES.filter((t) => !SPARX_THEME_META[t.name]).map((t) => t.name);
    expect(missing).toEqual([]);
  });

  it('keeps slugs unique across the two shelves', () => {
    const slugs = FIRST_PARTY_THEMES.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('states both modes, so a theme cannot paint a light fill on a dark surface', () => {
    for (const t of FIRST_PARTY_THEMES) {
      expect(t.theme.tokens, `${t.slug} light`).toBeTruthy();
      expect(t.theme.dark, `${t.slug} dark`).toBeTruthy();
    }
  });

  // Every facet drives a browse-rail bucket. An empty string would render a
  // nameless filter row that matches things.
  it('fills every browse facet', () => {
    for (const { slug, meta } of FIRST_PARTY_THEMES) {
      for (const key of ['industry', 'mood', 'colorFamily', 'density'] as const) {
        expect(meta[key], `${slug}.${key}`).toMatch(/\S/);
      }
    }
  });

  it('writes real copy, not placeholders', () => {
    for (const { slug, meta } of FIRST_PARTY_THEMES) {
      expect(meta.tagline.length, `${slug} tagline`).toBeGreaterThan(20);
      expect(meta.description.length, `${slug} description`).toBeGreaterThan(60);
      expect(meta.tagline, `${slug} tagline`).not.toMatch(/lorem|TODO|TBD/i);
    }
  });

  // A theme's colour chip is resolved from its own palette at read time, so a
  // primary that will not parse produces a grey card rather than a broken one —
  // this asserts the fallback stays unreachable.
  it('resolves a primary colour for every theme', () => {
    for (const t of FIRST_PARTY_THEMES) {
      const tokens = t.theme.tokens;
      expect(tokens['--color-primary'] ?? tokens.primary, `${t.slug} primary`).toMatch(/\S/);
    }
  });

  it('looks a theme up by slug, and reports first-party ownership', () => {
    const first = FIRST_PARTY_THEMES[0]!;
    expect(firstPartyTheme(first.slug)?.slug).toBe(first.slug);
    expect(isFirstPartyThemeSlug(first.slug)).toBe(true);
    // The guard that stops an uploaded row shadowing a shipped theme.
    expect(isFirstPartyThemeSlug('a-theme-a-tenant-uploaded')).toBe(false);
    expect(firstPartyTheme('a-theme-a-tenant-uploaded')).toBeUndefined();
  });

  it('leads with the business-named shelf', () => {
    expect(FIRST_PARTY_THEMES[0]!.shelf).toBe('sparx');
    expect(FIRST_PARTY_THEMES.at(-1)!.shelf).toBe('silica');
  });
});
