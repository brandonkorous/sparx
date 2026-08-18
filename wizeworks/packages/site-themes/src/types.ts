// The v1 token overlay + compiled shapes.
//
// `ThemeKey`, `ThemePreset`, `ThemeCategory` and the `ThemeSettingField` schema
// used to live here. They described the six code presets and the customizer form
// that edited them — a per-theme list of "which fields may this theme expose",
// rendered by a settings panel in `apps/dashboard`. Both are gone: the six were
// retired in favour of the forty first-party themes (presets/index.ts), and the
// dashboard was superseded by the workbench, whose theming is silica-native. All
// six shipped the IDENTICAL `settingsSchema` constant, so the field never varied by
// theme in the first place — it was per-theme configuration that no theme configured.

import type { ThemeTokens, ThemeTokenKey } from './tokens';

// Tenant overlay stored in SiteConfig.draftSettings.tokens — a partial token
// map per mode laid over the preset defaults at compile time.
export interface ThemeOverlay {
  light?: Partial<ThemeTokens>;
  dark?: Partial<ThemeTokens>;
}

export interface CompiledTokens {
  light: ThemeTokens;
  dark: ThemeTokens;
}

export type { ThemeTokens, ThemeTokenKey };
