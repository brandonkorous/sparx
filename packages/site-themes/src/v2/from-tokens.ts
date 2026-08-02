// A resolved silica token bag → a v2 preset.
//
// WHY THIS EXISTS. sparx ships forty themes as authored silica `Theme`s
// (`FIRST_PARTY_THEMES`, @sparx/silica-catalog). The tenant compile path speaks v2
// (`compileThemeForTenant` → brand over preset over presentation), so a theme has to
// arrive as a `ThemePresetV2` to be layered on at all. Before this, it couldn't: a
// site whose `themeKey` was a catalog slug found nothing in the v1/v2 registries and
// silently compiled the platform default, so picking `clinic` and picking nothing
// produced the same colours. The theme was real, shipped, and unreachable.
//
// Deliberately takes plain `Record<string, string>` maps rather than a silicaui
// `Theme`, so @sparx/site-themes keeps its zero runtime dependencies and the silica
// types stay on the caller's side of the boundary.
//
// The INPUT is expected to be RESOLVED (silicaui's `resolveThemeTokens`, which sparx
// wraps as `resolveSparxTheme`) — every `-content` pair already concrete and
// AA-checked. The fallbacks below are for a hand-authored bag that skipped a slot,
// not a licence to pass a raw theme: derive contrast with silica's engine, never here.

import type { ColorTokensV2, SharedTokensV2, ThemePresetV2 } from './types';

/** The platform line weight when a theme states none. */
const DEFAULT_BORDER_WIDTH = '1px';
/** The rhythm unit v2 presets are authored against. Silica has no token for it. */
const DEFAULT_SPACE_BASE = '0.25rem';

type Tokens = Record<string, string | undefined>;

/** First family of a CSS font stack, unquoted — `'Inter', system-ui` → `Inter`.
 *
 *  Silica stores a full stack; `SharedTokensV2.fontHeading` is a FAMILY, because
 *  the storefront feeds it to the webfont loader (apps/site/app/layout.tsx reads
 *  `compiledV2.shared.fontHeading`). Handing that a stack asks the loader to fetch
 *  a font called `'Inter', system-ui, -apple-system, sans-serif`. */
function family(stack: string | undefined, fallback: string): string {
  const first = (stack ?? '').split(',')[0]?.trim() ?? '';
  const bare = first.replace(/^['"]|['"]$/g, '').trim();
  return bare || fallback;
}

/** Mode-independent tokens: type, shape, rhythm, effect, container. */
function sharedFrom(tokens: Tokens): SharedTokensV2 {
  const body = family(tokens['--font-sans'], 'Inter');
  const sizeField = tokens['--size-field'] ?? DEFAULT_SPACE_BASE;
  const depth = Number(tokens['--depth']);
  return {
    // `--font-heading` is the sparx residual, `--font-head` silica's own; a theme
    // that sets neither heads in its body face rather than in the platform default.
    fontHeading: family(tokens['--font-heading'] ?? tokens['--font-head'], body),
    fontBody: body,
    radiusSelector: tokens['--radius-selector'] ?? '9999px',
    radiusField: tokens['--radius-field'] ?? '0.375rem',
    radiusBox: tokens['--radius-box'] ?? '0.5rem',
    borderWidth: tokens['--border'] ?? DEFAULT_BORDER_WIDTH,
    spaceBase: DEFAULT_SPACE_BASE,
    sizeField,
    sizeSelector: tokens['--size-selector'] ?? sizeField,
    // A non-numeric `--depth` is flattened to the default rather than propagated as
    // NaN, which would reach the shadow multiplier and blank every elevation.
    depth: Number.isFinite(depth) ? depth : 1,
    containerWidth: tokens['--container-max'] ?? 'medium',
  };
}

/** One mode's colour slots. `dark` is read as a DELTA over `light` — silica stores
 *  it that way (colours only, shape/type live once), so an unstated dark slot
 *  inherits its light value instead of collapsing to a default. */
function colorsFrom(tokens: Tokens, base: Tokens = {}): ColorTokensV2 {
  const at = (role: string): string | undefined =>
    tokens[`--color-${role}`] ?? base[`--color-${role}`];
  const req = (role: string, fallback: string): string => at(role) ?? fallback;

  const base300 = req('base-300', '#eef2f7');
  const accent = req('accent', req('primary', '#e04631'));
  return {
    base100: req('base-100', '#ffffff'),
    base200: req('base-200', '#f8fafc'),
    base300,
    baseContent: req('base-content', '#0f172a'),
    primary: req('primary', '#e04631'),
    primaryContent: req('primary-content', '#ffffff'),
    secondary: req('secondary', accent),
    secondaryContent: req('secondary-content', '#ffffff'),
    accent,
    accentContent: req('accent-content', '#ffffff'),
    neutral: req('neutral', '#0f172a'),
    neutralContent: req('neutral-content', '#ffffff'),
    info: req('info', '#0284c7'),
    success: req('success', '#16a34a'),
    warning: req('warning', '#d97706'),
    // sparx says `danger`, silicaui's own role is `error`; either spelling resolves.
    danger: at('danger') ?? req('error', '#dc2626'),
    dangerContent: at('danger-content') ?? at('error-content'),
    highlight: at('highlight') ?? accent,
    highlightContent: at('highlight-content'),
    // A hairline that tracks the surface ramp, never a fixed grey.
    border: req('border', base300),
  };
}

/**
 * A resolved silica token bag → the `ThemePresetV2` the tenant compile layers brand
 * and presentation over. `dark` is the theme's dark colour delta (silica's `Theme.dark`);
 * omit it and the theme compiles the same in both modes.
 */
export function themePresetV2FromTokens(light: Tokens, dark?: Tokens): ThemePresetV2 {
  return {
    shared: sharedFrom(light),
    light: colorsFrom(light),
    dark: colorsFrom(dark ?? light, light),
  };
}
