// Mosaic generator — the brand logo + favicon, authored as self-contained SVG data
// URIs (the data:image asset support in the installer + public media route). The
// Wordmark renders this MARK beside the "Mosaic" name; the favicon is the same mark.
// One identity logo serves the white header AND the footer, so it's drawn as a white
// "M" monogram on the ink (#191918) rounded square — exactly the mockup's mark.
//
// The "M" is a STROKED PATH, not SVG <text>: text inside an <img>-context SVG is
// font-dependent (it falls back unpredictably), so the path guarantees a crisp,
// identical monogram everywhere (the same reason Farm Fresh's mark is a vector path).

import { INK, WHITE } from './theme';

/** The "M" monogram: a rounded ink square with a white stroked M (bottom-left → up →
 *  center valley → up → bottom-right). */
const markSvg = (square: string, glyph: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
  `<rect x="4" y="4" width="56" height="56" rx="14" fill="${square}"/>` +
  `<path d="M18 45 V19 L32 36 L46 19 V45" fill="none" stroke="${glyph}" stroke-width="6" ` +
  `stroke-linecap="round" stroke-linejoin="round"/>` +
  `</svg>`;

const toDataUri = (svg: string): string => `data:image/svg+xml,${encodeURIComponent(svg)}`;

const mark = toDataUri(markSvg(INK, WHITE));

export const LOGO_ASSET_ID = 'brand-logo';
export const FAVICON_ASSET_ID = 'brand-favicon';

/** The logo + favicon assets, merged into the manifest's `assets`. Referenced by
 *  `brand.logoLightAssetId` / `faviconAssetId`. */
export const brandAssets = [
  { id: LOGO_ASSET_ID, url: mark, alt: 'Mosaic' },
  { id: FAVICON_ASSET_ID, url: mark, alt: 'Mosaic' },
];
