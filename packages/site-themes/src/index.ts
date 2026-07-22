// @sparx/site-themes — barrel.
//
// The six storefront themes as code-side presets (light + dark token
// defaults), the token surface + CSS-var mapping, and the token compiler that
// feeds publishing's write-through to CommerceSiteTheme. Consumed by the
// Site Builder service (compile-on-publish), the dashboard customizer (settings
// schema + preview), and the storefront (token → CSS).

export * from './types';
export * from './tokens';
export * from './presets';
export * from './compile';
export * from './fonts';

// Token Model v2 (docs/33-token-model-v2.md). Distinct names from v1; both are
// exported during the build-out (the storefront read path cuts over in §3).
export * from './v2';

// Brand-palette interchange format — shared with the public color-palette tool
// (also available as the lighter `@sparx/site-themes/brand-palette` subpath).
export * from './brand-palette';
