// Forge generator — the brand logo + favicon, authored as self-contained SVG data URIs
// (the data:image asset support in the installer + public media route). The Wordmark
// renders this MARK beside the "Forge" name; the favicon is the same mark. One identity
// logo serves the dark header AND the footer, so it's drawn as an ACID slash on a deep
// ink rounded square — the slash being the design's signature device (it also leads the
// brand lockup and every section heading in the mockup).
//
// The slash is a filled POLYGON path, not SVG <text>: text inside an <img>-context SVG
// is font-dependent (it falls back unpredictably), so the path guarantees a crisp,
// identical mark everywhere (the same reason Mosaic's "M" + Farm Fresh's mark are
// vector paths).

import { ACID, INK } from './theme';

/** The "/" slash mark: a deep ink rounded square with a single acid forward-slash bar
 *  (bottom-left → top-right), echoing the mockup's skewed brand slash. */
const markSvg = (square: string, glyph: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
  `<rect x="4" y="4" width="56" height="56" rx="14" fill="${square}"/>` +
  `<path d="M36 14 L48 14 L28 50 L16 50 Z" fill="${glyph}"/>` +
  `</svg>`;

const toDataUri = (svg: string): string => `data:image/svg+xml,${encodeURIComponent(svg)}`;

const mark = toDataUri(markSvg(INK, ACID));

export const LOGO_ASSET_ID = 'brand-logo';
export const FAVICON_ASSET_ID = 'brand-favicon';

/** The logo + favicon assets, merged into the manifest's `assets`. Referenced by
 *  `brand.logoLightAssetId` / `faviconAssetId`. */
export const brandAssets = [
  { id: LOGO_ASSET_ID, url: mark, alt: 'Forge' },
  { id: FAVICON_ASSET_ID, url: mark, alt: 'Forge' },
];
