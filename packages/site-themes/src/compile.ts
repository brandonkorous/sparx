// Token compilation + the CommerceSiteTheme write-through map.
//
// `compileTokens` overlays a tenant's per-mode token overrides on top of a
// theme preset's defaults to produce the final { light, dark } token maps that
// publishing snapshots into SiteVersion.compiledTokens. The light subset that
// has a matching CommerceSiteTheme column is written through on publish so the
// storefront's existing read path keeps working.

import type { ThemeOverlay, ThemeTokens, CompiledTokens } from './types';
import { TOKEN_KEYS } from './tokens';
import { PLATFORM_TOKEN_DEFAULTS } from './presets';

// Keep only recognized token keys from an untrusted partial (the overlay comes
// from JSONB, so a stray key shouldn't leak into the compiled output).
function pickKnown(partial: Partial<ThemeTokens> | undefined): Partial<ThemeTokens> {
    if (!partial) return {};
    const out: Partial<ThemeTokens> = {};
    for (const key of TOKEN_KEYS) {
        const v = partial[key];
        if (typeof v === 'string' && v !== '') out[key] = v;
    }
    return out;
}

/**
 * Merge the PLATFORM defaults with a tenant overlay → final tokens per mode.
 * Unknown overlay keys are dropped; missing overlay values fall back to the base
 * so the output is always a complete ThemeTokens map.
 *
 * This took a `themeKey` and resolved one of six code presets. The six are gone
 * (see presets/index.ts) and a real theme carries its own defaults, which is what
 * `compileTokensFromDefaults` is for — so the key selected nothing and only made it
 * look as though it did. Callers with a theme in hand should use that function; this
 * one is the no-theme base.
 */
export function compileTokens(overlay?: ThemeOverlay): CompiledTokens {
    return compileTokensFromDefaults(PLATFORM_TOKEN_DEFAULTS, overlay);
}

/**
 * Like `compileTokens`, but takes the preset's light/dark defaults DIRECTLY
 * instead of resolving them from the code registry by key. This is the seam for
 * DATA themes (docs/60): a tenant who applied a marketplace theme carries its
 * `DataThemePreset.v1` defaults in draftSettings, and the publish snapshot
 * compiles from them with no code preset.
 */
export function compileTokensFromDefaults(
    defaults: CompiledTokens,
    overlay?: ThemeOverlay
): CompiledTokens {
    return {
        light: { ...defaults.light, ...pickKnown(overlay?.light) },
        dark: { ...defaults.dark, ...pickKnown(overlay?.dark) },
    };
}

// Token → CommerceSiteTheme column. The light values for these PRESENTATION
// tokens are written through to the commerce-owned commerce_site_themes
// row on publish so the storefront's no-snapshot fallback read path keeps
// working. Identity tokens (colorPrimary/PrimaryForeground/Accent, fontHeading/
// Body) are NOT written through — they're owned by the tenant-level brand
// (docs/30 §6), read live and overlaid at render; their CommerceSiteTheme columns
// were removed in migration 20260610000200. Tokens with no column at all
// (colorForeground, colorBorder, containerWidth) reach the storefront only via
// the Site Builder public snapshot.
export const SITE_THEME_WRITETHROUGH: { token: keyof ThemeTokens; column: string }[] = [
    { token: 'colorBackground', column: 'colorBackground' },
    { token: 'colorMuted', column: 'colorMuted' },
    { token: 'radiusBase', column: 'radiusBase' },
];

/**
 * Projects a compiled light token map onto the CommerceSiteTheme column shape
 * for the write-through upsert performed by the publish service.
 */
export function toCommerceSiteThemeColumns(lightTokens: ThemeTokens): Record<string, string> {
    const out: Record<string, string> = {};
    for (const { token, column } of SITE_THEME_WRITETHROUGH) {
        const v = lightTokens[token];
        if (typeof v === 'string' && v !== '') out[column] = v;
    }
    return out;
}

// ─────────────────────────────────────────────────────────────────────────
// Brand identity (docs/30 §6) — the subset of theme tokens the tenant-level
// brand OWNS. These come from TenantBrand and WIN over theme presets and
// tenant presentation overrides everywhere (brand color = brand color). The
// rest of the tokens (background, foreground, muted, border, radius, container)
// are presentation, owned by the theme/tenant. Logo/favicon/business name are
// brand identity too but are not theme tokens — callers apply those separately.
// ─────────────────────────────────────────────────────────────────────────

export const BRAND_IDENTITY_TOKEN_KEYS = [
    'colorPrimary',
    'colorPrimaryForeground',
    'colorAccent',
    'fontHeading',
    'fontBody',
] as const satisfies readonly (keyof ThemeTokens)[];

export interface BrandIdentitySource {
    colorPrimary?: string | null;
    colorPrimaryForeground?: string | null;
    colorAccent?: string | null;
    fontHeading?: string | null;
    fontBody?: string | null;
}

/** Brand identity → a ThemeTokens overlay containing only the fields the brand
 *  has actually set. */
export function brandIdentityOverlay(
    brand: BrandIdentitySource | null | undefined
): Partial<ThemeTokens> {
    const out: Partial<ThemeTokens> = {};
    if (!brand) return out;
    for (const key of BRAND_IDENTITY_TOKEN_KEYS) {
        const v = brand[key];
        if (typeof v === 'string' && v !== '') out[key] = v;
    }
    return out;
}

/** Apply brand identity ON TOP of an already-compiled token pair so brand wins
 *  for the identity keys, in both light and dark. Operates on the loose record
 *  shape so it accepts both freshly compiled tokens and a stored snapshot. */
export function applyBrandIdentityTokens(
    compiled: { light: Record<string, string>; dark: Record<string, string> },
    brand: BrandIdentitySource | null | undefined
): { light: Record<string, string>; dark: Record<string, string> } {
    const overlay = brandIdentityOverlay(brand);
    return {
        light: { ...compiled.light, ...overlay },
        dark: { ...compiled.dark, ...overlay },
    };
}
