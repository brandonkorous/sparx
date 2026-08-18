// The data-driven theme payload (docs/60 §6). A marketplace theme is a row whose
// `tokens` JSON column carries a COMPLETE theme definition as DATA — exactly what
// a code-side `@wizeworks/site-themes` preset carries, but resolvable at runtime
// without a deploy. It travels two paths after a tenant applies it:
//   • `v1` light/dark token maps → the v1 publish snapshot (SiteVersion.compiledTokens
//     + the CommerceSiteTheme write-through).
//   • `v2` ThemePresetV2 → the read-time v2 recompile (publish-service.overlayBrand),
//     layered with the tenant's brand + presentation overlay.
// On apply, the whole `DataThemePreset` is stashed in SiteConfig.draftSettings
// under `themePreset`, so the storefront/publish compile is self-contained (no
// marketplace lookup at render). Zod-only, so the seed + api-rest both validate it.

import { z } from 'zod';

const TokenValue = z.string().min(1).max(255);

/** The v1 storefront token surface (mirrors @wizeworks/site-themes ThemeTokens). */
export const ThemeTokensV1 = z.object({
  colorPrimary: TokenValue,
  colorPrimaryForeground: TokenValue,
  colorAccent: TokenValue,
  colorBackground: TokenValue,
  colorForeground: TokenValue,
  colorMuted: TokenValue,
  colorBorder: TokenValue,
  fontHeading: TokenValue,
  fontBody: TokenValue,
  radiusBase: TokenValue,
  containerWidth: TokenValue,
});
export type ThemeTokensV1 = z.infer<typeof ThemeTokensV1>;

/** One mode's v2 color slots (mirrors @wizeworks/site-themes ColorTokensV2). The
 *  `*Content` pairs are optional — the v2 compiler derives them when absent. */
export const ColorTokensV2Schema = z
  .object({
    base100: TokenValue,
    base200: TokenValue,
    base300: TokenValue,
    baseContent: TokenValue,
    primary: TokenValue,
    secondary: TokenValue,
    accent: TokenValue,
    neutral: TokenValue,
    info: TokenValue,
    success: TokenValue,
    warning: TokenValue,
    danger: TokenValue,
    border: TokenValue,
    highlight: TokenValue.optional(),
    primaryContent: TokenValue.optional(),
    secondaryContent: TokenValue.optional(),
    accentContent: TokenValue.optional(),
    neutralContent: TokenValue.optional(),
    infoContent: TokenValue.optional(),
    successContent: TokenValue.optional(),
    warningContent: TokenValue.optional(),
    dangerContent: TokenValue.optional(),
    highlightContent: TokenValue.optional(),
  })
  .strict();

/** Mode-independent v2 tokens (mirrors @wizeworks/site-themes SharedTokensV2). */
export const SharedTokensV2Schema = z
  .object({
    fontHeading: TokenValue,
    fontBody: TokenValue,
    radiusSelector: TokenValue,
    radiusField: TokenValue,
    radiusBox: TokenValue,
    borderWidth: TokenValue,
    spaceBase: TokenValue,
    sizeField: TokenValue,
    sizeSelector: TokenValue,
    depth: z.number(),
    containerWidth: TokenValue,
  })
  .strict();

/** A complete v2 preset (mirrors @wizeworks/site-themes ThemePresetV2). */
export const ThemePresetV2Schema = z
  .object({
    shared: SharedTokensV2Schema,
    light: ColorTokensV2Schema,
    dark: ColorTokensV2Schema,
  })
  .strict();
export type ThemePresetV2Data = z.infer<typeof ThemePresetV2Schema>;

/** The full data theme payload stored in `marketplace_themes.tokens` and carried
 *  per-tenant in `SiteConfig.draftSettings.themePreset`. */
export const DataThemePreset = z
  .object({
    v: z.literal(1),
    v1: z.object({ light: ThemeTokensV1, dark: ThemeTokensV1 }),
    v2: ThemePresetV2Schema,
  })
  .strict();
export type DataThemePreset = z.infer<typeof DataThemePreset>;

/** Tolerant read: parse an untrusted `tokens` JSON into a DataThemePreset, or
 *  null if it isn't one (e.g. a NULL column on a legacy/code-resolved theme). */
export function readDataThemePreset(input: unknown): DataThemePreset | null {
  const parsed = DataThemePreset.safeParse(input);
  return parsed.success ? parsed.data : null;
}
