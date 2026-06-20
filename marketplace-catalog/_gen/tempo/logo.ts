// Tempo generator — the brand logo + favicon, authored as self-contained SVG data URIs
// (the data:image asset support in the installer + public media route). The Wordmark
// renders this MARK beside the "Tempo" name; the favicon is the same mark.
//
// One identity logo serves BOTH the white header AND the ink footer. A bare ink mark
// would vanish on the footer and a bare white mark on the header, so — like Mosaic's
// monogram — the mark is a hard-edged ink BADGE carrying white "»" motion-chevrons: the
// ink square pops on the white header, and on the ink footer the square blends while the
// white chevrons stay crisp. The corners are SQUARE (radius 0) to match the brand's
// hard-edged shape tokens. The chevrons are a STROKED PATH, not SVG <text> (text in an
// <img>-context SVG is font-dependent and falls back unpredictably).
//
// The "»" forward double-chevron is Tempo's signature device — it replaces the mockup's
// trademarked three-stripes wherever a mark is stamped (the in-page CSS version lives in
// media.ts as `motionMark()`).

import { INK, PAPER } from './theme';

/** The motion-mark badge: a square ink tile with two white forward chevrons (»). */
const markSvg = (square: string, glyph: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
  `<rect width="64" height="64" fill="${square}"/>` +
  `<path d="M18 18 L31 32 L18 46" fill="none" stroke="${glyph}" stroke-width="6.5" ` +
  `stroke-linecap="square" stroke-linejoin="miter"/>` +
  `<path d="M33 18 L46 32 L33 46" fill="none" stroke="${glyph}" stroke-width="6.5" ` +
  `stroke-linecap="square" stroke-linejoin="miter"/>` +
  `</svg>`;

const toDataUri = (svg: string): string => `data:image/svg+xml,${encodeURIComponent(svg)}`;

const mark = toDataUri(markSvg(INK, PAPER));

export const LOGO_ASSET_ID = 'brand-logo';
export const FAVICON_ASSET_ID = 'brand-favicon';

/** The logo + favicon assets, merged into the manifest's `assets` alongside the product
 *  imagery. Referenced by `brand.logoLightAssetId` / `faviconAssetId`. */
export const brandAssets = [
  { id: LOGO_ASSET_ID, url: mark, alt: 'Tempo' },
  { id: FAVICON_ASSET_ID, url: mark, alt: 'Tempo' },
];
