// A shipped silica theme → the `themePreset` blob a site stores.
//
// WHY A CONVERSION EXISTS AT ALL. sparx authors its forty themes as silica `Theme`s
// (@wizeworks/silica-catalog) — that is what the builder canvas, the marketplace preview
// and the live storefront all render. The tenant COMPILE path speaks Token Model v2,
// because a site's theme is only the bottom layer: the tenant's brand identity goes
// over it and the presentation overlay over that (`compileThemeForTenant`). A theme
// therefore has to arrive as a `ThemePresetV2` to be layered on at all.
//
// WHAT THIS FIXES. Nothing performed that conversion, so a site whose `themeKey` was
// a catalog slug had no preset to compile — and the compile fell back to the platform
// base. Picking `clinic` and picking nothing produced identical colors, with every
// surface reporting success. The theme was shipped, correct, and unreachable.
//
// THE SHAPE. `DataThemePreset` (@wizeworks/marketplace-schemas) — `{ v, v1, v2 }` — is
// what `SiteConfig.draftSettings.themePreset` has always held, because a marketplace
// theme wrote it. First-party themes now write the same shape, so every reader stays
// one branch: publish-service takes `.v1` for the legacy snapshot, silica-theme-sync
// and the storefront recompile take `.v2`. One format, two sources.

import {
  themePresetV2FromTokens,
  PLATFORM_PRESET_V2,
  PLATFORM_TOKEN_DEFAULTS,
  type CompiledTokens,
  type ThemeTokens,
} from '@wizeworks/site-themes';
import {
  BASE_SILICA_THEME,
  firstPartyTheme,
  resolveSparxTheme,
  type FirstPartyTheme,
} from '@wizeworks/silica-catalog';

type Theme = FirstPartyTheme['theme'];
type Tokens = Record<string, string | undefined>;

/** The stored per-site theme payload. Mirrors `DataThemePreset` without importing
 *  @wizeworks/marketplace-schemas — this package must not depend on the marketplace to
 *  apply a theme that ships in the box. */
export interface StoredThemePreset {
  v: 1;
  v1: CompiledTokens;
  v2: ReturnType<typeof themePresetV2FromTokens>;
}

/** First family of a CSS font stack, unquoted. Silica stores a stack; the v1 token
 *  surface stores a family. */
function family(stack: string | undefined, fallback: string): string {
  const bare =
    (stack ?? '')
      .split(',')[0]
      ?.trim()
      .replace(/^['"]|['"]$/g, '') ?? '';
  return bare || fallback;
}

/** The v1 token surface, projected from the resolved silica bag.
 *
 *  v1 is legacy and nothing renders from it — the storefront reads the silica theme
 *  — but `SiteVersion.compiledTokens` is a required column and transactional email
 *  still derives from these keys, so it is filled honestly rather than left to the
 *  platform base. `colorMuted` takes base-200 (the elevated/muted surface) and
 *  `colorBorder` the theme's own hairline, matching how the silica ramp is read
 *  everywhere else. */
function v1From(light: Tokens, dark: Tokens): CompiledTokens {
  const mode = (t: Tokens, base: Tokens): ThemeTokens => {
    const at = (role: string, fallback: string): string =>
      t[`--color-${role}`] ?? base[`--color-${role}`] ?? fallback;
    const shared = (key: string, fallback: string): string => base[key] ?? t[key] ?? fallback;
    return {
      colorPrimary: at('primary', '#e04631'),
      colorPrimaryForeground: at('primary-content', '#ffffff'),
      colorAccent: at('accent', at('primary', '#c1652e')),
      colorBackground: at('base-100', '#ffffff'),
      colorForeground: at('base-content', '#0f172a'),
      colorMuted: at('base-200', '#f8fafc'),
      colorBorder: at('border', at('base-300', '#e2e8f0')),
      fontHeading: family(shared('--font-heading', '') || shared('--font-head', ''), 'Inter'),
      fontBody: family(shared('--font-sans', ''), 'Inter'),
      radiusBase: shared('--radius-box', '0.5rem'),
      containerWidth: shared('--container-max', 'medium'),
    };
  };
  return { light: mode(light, light), dark: mode(dark, light) };
}

/**
 * A sparx theme → the preset blob stored on the site.
 *
 * `resolveSparxTheme` runs first so the input is FULLY resolved — every `-content`
 * pair concrete and AA-checked by silica's own contrast engine, plus the sparx
 * residuals (danger/highlight/border). Deriving contrast here instead would be a
 * second implementation of the thing silica already owns, and the two would drift.
 */
export function themePresetFor(theme: Theme): StoredThemePreset {
  const resolved = resolveSparxTheme(theme);
  const light: Tokens = resolved.tokens;
  const dark: Tokens = { ...resolved.tokens, ...(resolved.dark ?? {}) };
  return {
    v: 1,
    v1: v1From(light, dark),
    v2: themePresetV2FromTokens(light, dark),
  };
}

/** The slug the platform base answers to — READ OFF the base rather than spelled,
 *  so the two can never disagree.
 *
 *  It was spelled, as a product's name, back when the base WAS that product's look;
 *  moving the base to a neutral would have left this pointing a brand's slug at a
 *  palette that is no longer that brand's, which nothing would have reported. */
const PLATFORM_SLUG = BASE_SILICA_THEME.name;

/**
 * A theme SLUG → its stored preset, or null when the slug names no shipped theme.
 *
 * The base's own slug is answered from the base constants rather than the catalog,
 * even though the catalog also carries it: one slug, one answer, and the answer is
 * the same bag the storefront falls back to.
 */
export function themePresetForSlug(slug: string): StoredThemePreset | null {
  if (slug === PLATFORM_SLUG) {
    return { v: 1, v1: PLATFORM_TOKEN_DEFAULTS, v2: PLATFORM_PRESET_V2 };
  }
  const shipped = firstPartyTheme(slug);
  return shipped ? themePresetFor(shipped.theme) : null;
}
