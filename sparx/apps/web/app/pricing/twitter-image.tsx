// Twitter cards share the OG renderer. Config is declared locally because
// Next.js can't statically detect re-exported route config.
import Image from './opengraph-image';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'sparx — Switch on what you use. Per-module pricing from $10/mo.';

export default Image;
