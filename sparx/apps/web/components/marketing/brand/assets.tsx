import * as React from 'react';

/**
 * Renderers for the canonical, press-ready brand artwork that ships under
 * sparx/apps/web/public/brand/ (the static files derived from @sparx/brand's mark
 * geometry). The <Wordmark> component renders the same lockup live from vector
 * paths; these render the static PNG/SVG files for press downloads and previews,
 * with the "x" in the brand spark color.
 *
 * Variants (wordmark, mark, and app icon share one scheme):
 *   color    — dark letters + spark "x" (primary, for light surfaces)
 *   light    — white letters + spark "x" (reversed, for dark surfaces)
 *   black    — dark-on-light lockup (one-color use)
 *   white    — white-on-dark lockup (one-color use)
 *
 * The mark and the app icon are two DIFFERENT marks, not two sizes of one: the
 * mark is the "x" drawn on transparency; the app icon is a full-bleed field with
 * that same "x" knocked out of it. Both are generated from the shared geometry by
 * scripts/generate-brand-icons.mjs — never hand-edit the files under public/brand.
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

const APP_ICON_SRC: Record<ArtworkVariant, string> = {
  color: '/brand/sparx-app-icon.svg',
  light: '/brand/sparx-app-icon-light.svg',
  black: '/brand/sparx-app-icon-black.svg',
  white: '/brand/sparx-app-icon-white.svg',
};

export function OfficialWordmark({
  variant = 'color',
  className,
  style,
}: {
  variant?: ArtworkVariant;
  /** Sizing utilities — a `w-*` or `h-*`; the other dimension scales. */
  className?: string;
  /** Escape hatch for a genuinely computed dimension (e.g. a size-ladder step). */
  style?: React.CSSProperties;
}) {
  return (
    <img
      src={WORDMARK_SRC[variant]}
      alt="sparx"
      // The default `w-[280px]` is emitted ONLY when the caller supplies no
      // sizing class — two same-specificity width utilities on one element
      // resolve by stylesheet order, not className order.
      className={`block h-auto ${className ?? 'w-[280px]'}`}
      style={style}
    />
  );
}

export function OfficialMark({
  variant = 'color',
  size = 64,
  className,
}: {
  variant?: ArtworkVariant;
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={MARK_SRC[variant]}
      alt="sparx mark"
      width={size}
      height={size}
      className={`block ${className ?? ''}`}
    />
  );
}

export function OfficialAppIcon({
  variant = 'color',
  size = 64,
  className,
}: {
  variant?: ArtworkVariant;
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={APP_ICON_SRC[variant]}
      alt="sparx app icon"
      width={size}
      height={size}
      className={`block ${className ?? ''}`}
    />
  );
}
