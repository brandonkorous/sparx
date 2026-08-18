// The theme set + scoped CSS behind the marketplace component-preview theme picker
// (docs/118). A component preview's HTML is theme-INDEPENDENT — its silica utility
// classes (`bg-primary`, ``, …) read CSS custom properties — so the
// server renders each section ONCE and the picker switches themes purely by swapping
// those vars. This module emits every theme's token set scoped to
// `html[data-cp-tk="<key>"] .cp-surface`, so setting `data-cp-tk` / `data-cp-mode` on
// `<html>` re-themes ONLY the previews (`.cp-surface`), never the marketing chrome.
//
// The themes are the 20 sparx presets (`SPARX_THEMES`) plus the Ember base — the exact
// looks a merchant picks in the Builder + the marketplace themes shelf, so a visitor
// previews a component in the same theme they can adopt. Server-safe (React-free).

import {
  SPARX_THEMES,
  SPARX_THEME_GROUPS,
  resolveSparxTheme,
  BASE_SILICA_THEME,
} from '@wizeworks/silica-catalog';
import type { Theme } from '@wizeworks/silicaui-html';

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export interface PreviewThemeOption {
  key: string;
  label: string;
}
export interface PreviewThemeGroup {
  label: string;
  options: PreviewThemeOption[];
}

/** The picker's grouped option list: Ember (the platform default) first, then the 20
 *  presets under their shelves. `key` matches the `data-cp-tk` value the CSS scopes on. */
export const PREVIEW_THEME_GROUPS: PreviewThemeGroup[] = [
  { label: 'Default', options: [{ key: 'sparx', label: 'Ember (default)' }] },
  ...SPARX_THEME_GROUPS.map((g) => ({
    label: g.label,
    options: g.themes.map((t) => ({ key: t.name, label: cap(t.name) })),
  })),
];

/** Every (key, light tokens, dark color-delta) the CSS emits — Ember base + the presets.
 *  `resolveSparxTheme` gives the flat ship-ready tokens (light) + the dark color delta,
 *  exactly what the live site adopts. */
function themeBags(): {
  key: string;
  light: Record<string, string>;
  dark: Record<string, string>;
}[] {
  const preset = (t: Theme) => {
    const r = resolveSparxTheme(t);
    return { key: t.name, light: r.tokens, dark: r.dark ?? {} };
  };
  return [
    { key: 'sparx', light: BASE_SILICA_THEME.tokens, dark: BASE_SILICA_THEME.dark ?? {} },
    ...SPARX_THEMES.map(preset),
  ];
}

const block = (tokens: Record<string, string>): string =>
  Object.entries(tokens)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');

/** The full stylesheet the previews read. A default `.cp-surface` fallback (Ember light,
 *  so SSR / no-JS / pre-picker shows a real theme with no flash), then per-theme rules
 *  scoped by `data-cp-tk` (+ `data-cp-mode="dark"` for the dark delta), then the type
 *  rules that apply the theme's `--font-*` stacks. */
export function previewThemesCss(): string {
  const bags = themeBags();
  const fallback = `.cp-surface{${block(BASE_SILICA_THEME.tokens)}}`;
  const rules = bags
    .map(
      ({ key, light, dark }) =>
        `html[data-cp-tk="${key}"] .cp-surface{${block(light)}}` +
        (Object.keys(dark).length
          ? `html[data-cp-tk="${key}"][data-cp-mode="dark"] .cp-surface{${block(dark)}}`
          : '')
    )
    .join('');
  const type =
    `.cp-surface{font-family:var(--font-sans,system-ui,sans-serif)}` +
    `.cp-surface :is(h1,h2,h3,h4,h5,h6){font-family:var(--font-heading,var(--font-sans,system-ui))}`;
  return fallback + rules + type;
}

/** One Google-Fonts href covering EVERY face any theme states, so switching themes never
 *  waits on a font load. Collects the distinct google `sans`/`head` families across the
 *  base + all presets. Returns null if none are google-sourced. */
export function previewFontsHref(): string | null {
  const families = new Set<string>();
  const collect = (t: Theme | undefined) => {
    for (const f of [t?.fonts?.sans, t?.fonts?.head]) {
      if (f?.source === 'google') families.add(f.family);
    }
  };
  collect(BASE_SILICA_THEME);
  SPARX_THEMES.forEach(collect);
  // BASE_SILICA_THEME states its fonts as token stacks, not a `fonts` block, so add its
  // two faces explicitly (Inter / Space Grotesk).
  families.add('Inter');
  families.add('Space Grotesk');
  if (families.size === 0) return null;
  const params = [...families]
    .map((f) => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}
