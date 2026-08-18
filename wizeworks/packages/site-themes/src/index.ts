// @wizeworks/site-themes — barrel.
//
// The token COMPILER, not a theme library. Given a site's own preset plus the
// tenant's brand and presentation overlays, it produces the compiled theme the
// storefront and the builder preview both render from (`compileThemeForTenant`).
//
// It used to ship six presets of its own — apex, industrial, drift, market, fleet,
// drop — which were the platform's entire theme shelf before the silica catalog.
// They are retired: sparx's forty shipped themes live in @wizeworks/silica-catalog as
// authored silica `Theme`s, and `themePresetV2FromTokens` (v2/from-tokens.ts) is how
// one becomes a preset this compiler can layer. What's left here of a "preset" is
// the single platform base a site falls back to (presets/index.ts).

export * from './types';
export * from './tokens';
export * from './presets';
export * from './compile';
export * from './fonts';

// Token Model v2 (docs/33-token-model-v2.md). Distinct names from v1; both are
// exported during the build-out (the storefront read path cuts over in §3).
export * from './v2';

// Brand-palette interchange format — shared with the public color-palette tool
// (also available as the lighter `@wizeworks/site-themes/brand-palette` subpath).
export * from './brand-palette';
