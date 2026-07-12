// Chat widget accent-color swatches — sourced from the tenant's actual brand
// identity + every saved theme (docs/33), not a fixed palette. The count is
// whatever the theme builder has (n saved themes × up to 3 identity colors
// each), deduped by hex so a picker never shows the same color twice. Each
// swatch carries its paired `-content` (foreground) color so picking a theme
// color also picks the tenant's own legible-text decision for it, instead of
// a guessed black/white.

import type { BrandDto, SiteThemeDto } from '../../../builder/_brand/lib/types';

export interface ThemeColorSwatch {
  hex: string;
  /** Shown as the swatch's hover tooltip — the brand/theme role it came from. */
  label: string;
  /** The role's `-content` color, or null when the tenant left it to
   *  auto-derive (the picker then falls back to a computed black/white). */
  content: string | null;
}

/** Trims a raw `-content` value; blank collapses to null (there's nothing to
 *  carry over, not an explicit choice) so callers can rely on `??`. */
function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed;
}

export function themeColorSwatches(
  brand: BrandDto | null,
  savedThemes: SiteThemeDto[]
): ThemeColorSwatch[] {
  const seen = new Set<string>();
  const swatches: ThemeColorSwatch[] = [];

  function add(
    hex: string | null | undefined,
    content: string | null | undefined,
    label: string
  ): void {
    const v = hex?.trim();
    if (!v) return;
    const key = v.toUpperCase();
    if (seen.has(key)) return;
    seen.add(key);
    swatches.push({ hex: v, label, content: trimOrNull(content) });
  }

  add(brand?.colorPrimary, brand?.colorPrimaryForeground, 'Primary');
  add(brand?.colorSecondary, brand?.colorSecondaryForeground, 'Secondary');
  add(brand?.colorAccent, brand?.colorAccentForeground, 'Accent');
  for (const theme of savedThemes) {
    add(theme.brand?.colorPrimary, theme.brand?.colorPrimaryForeground, `${theme.name} · Primary`);
    add(
      theme.brand?.colorSecondary,
      theme.brand?.colorSecondaryForeground,
      `${theme.name} · Secondary`
    );
    add(theme.brand?.colorAccent, theme.brand?.colorAccentForeground, `${theme.name} · Accent`);
  }

  return swatches;
}

// Fallback palette for a tenant with no brand colors set and no saved themes
// yet — the swatch picker always has something to offer. Content is left null
// so `readableContentOn` derives it.
export const DEFAULT_ACCENT_SWATCHES: ThemeColorSwatch[] = [
  { hex: '#6366F1', label: 'Indigo', content: null },
  { hex: '#0EA5E9', label: 'Sky', content: null },
  { hex: '#14B8A6', label: 'Teal', content: null },
  { hex: '#F97316', label: 'Orange', content: null },
  { hex: '#EC4899', label: 'Pink', content: null },
  { hex: '#10B981', label: 'Emerald', content: null },
];

/** Black or white, whichever reads better on a `#rrggbb` fill (WCAG relative
 *  luminance) — used when the picked color isn't a known theme swatch (a
 *  custom hex typed/pasted into the picker has no paired content color). */
export function readableContentOn(hex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return '#ffffff';
  const channel = (h: string): number => {
    const s = parseInt(h, 16) / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const hexDigits = m[1] ?? '000000';
  const l =
    0.2126 * channel(hexDigits.slice(0, 2)) +
    0.7152 * channel(hexDigits.slice(2, 4)) +
    0.0722 * channel(hexDigits.slice(4, 6));
  const onBlack = (l + 0.05) / 0.05;
  const onWhite = 1.05 / (l + 0.05);
  return onBlack >= onWhite ? '#000000' : '#ffffff';
}
