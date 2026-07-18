import * as React from 'react';

/**
 * Renderers for the canonical, press-ready brand artwork that ships under
 * apps/web/public/brand/ (the static files derived from @sparx/brand's mark
 * geometry). The <Wordmark> component renders the same lockup live from vector
 * paths; these render the static PNG/SVG files for press downloads and previews,
 * with the "x" in the brand spark color.
 *
 * Variants (wordmark and monogram share the scheme):
 *   color    — dark letters + spark "x" (primary, for light surfaces)
 *   light    — white letters + spark "x" (reversed, for dark surfaces)
 *   black    — dark-on-light lockup (one-color use)
 *   white    — white-on-dark lockup (one-color use)
 */

export type ArtworkVariant = 'color' | 'light' | 'black' | 'white';

const WORDMARK_SRC: Record<ArtworkVariant, string> = {
  color: '/brand/sparx-wordmark.svg',
  light: '/brand/sparx-wordmark-light.svg',
  black: '/brand/sparx-wordmark-black.svg',
  white: '/brand/sparx-wordmark-white.svg',
};

const MARK_SRC: Record<ArtworkVariant, string> = {
  color: '/brand/sparx-mark.svg',
  light: '/brand/sparx-mark-light.svg',
  black: '/brand/sparx-mark-black.svg',
  white: '/brand/sparx-mark-white.svg',
};

export function OfficialWordmark({
  variant = 'color',
  style,
}: {
  variant?: ArtworkVariant;
  /** Inline style — pass a `width` or `height`; the other dimension scales. */
  style?: React.CSSProperties;
}) {
  return (
    <img
      src={WORDMARK_SRC[variant]}
      alt="sparx"
      style={{ display: 'block', width: '280px', height: 'auto', ...style }}
    />
  );
}

export function OfficialMark({
  variant = 'color',
  size = 64,
  style,
}: {
  variant?: ArtworkVariant;
  size?: number;
  style?: React.CSSProperties;
}) {
  return (
    <img
      src={MARK_SRC[variant]}
      alt="sparx mark"
      width={size}
      height={size}
      style={{ display: 'block', ...style }}
    />
  );
}
