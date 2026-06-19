// Farm Fresh generator — the brand logo + favicon, authored as self-contained SVG
// data URIs (the data:image asset support that landed in the installer + public media
// route). The Wordmark renders this MARK beside the "Farm Fresh" name; the favicon is
// the same mark. One identity logo is shown on BOTH the cream header and the ink
// footer, so the mark is drawn in fern green (legible on light AND dark) with a berry
// "seed" accent — a sprout rising from a bowl, the brand in one glyph.

import { BERRY, LEAF } from './theme';

const FERN = '#7FA85B';

/** The sprout-in-bowl mark. `leafA` is the primary (stem + right leaf), `leafB` the
 *  secondary leaf (a touch of depth), `bowl` the vessel, `seed` the berry accent. */
const markSvg = (bowl: string, leafA: string, leafB: string, seed: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
  // bowl
  `<path d="M15 39c0 9 7 15 17 15s17-6 17-15Z" fill="${bowl}"/>` +
  // stem
  `<path d="M32 41c0-6 0-11 0-17" stroke="${leafA}" stroke-width="3.6" stroke-linecap="round" fill="none"/>` +
  // left leaf
  `<path d="M32 35c-7 1-14-3-15-12 9-1 16 4 15 12Z" fill="${leafB}"/>` +
  // right leaf
  `<path d="M32 31c7 1 15-3 16-13-9-1-17 4-16 13Z" fill="${leafA}"/>` +
  // berry seed
  `<circle cx="32" cy="20" r="3.6" fill="${seed}"/>` +
  `</svg>`;

const toDataUri = (svg: string): string => `data:image/svg+xml,${encodeURIComponent(svg)}`;

// Fern-forward so the single identity logo reads on the cream header AND the ink
// footer; LEAF on the secondary leaf for depth; BERRY seed for the accent pop.
const mark = toDataUri(markSvg(FERN, FERN, LEAF, BERRY));

export const LOGO_ASSET_ID = 'brand-logo';
export const FAVICON_ASSET_ID = 'brand-favicon';

/** The logo + favicon assets, merged into the manifest's `assets` alongside the
 *  product imagery. Referenced by `brand.logoLightAssetId` / `faviconAssetId`. */
export const brandAssets = [
  { id: LOGO_ASSET_ID, url: mark, alt: 'Farm Fresh' },
  { id: FAVICON_ASSET_ID, url: mark, alt: 'Farm Fresh' },
];
