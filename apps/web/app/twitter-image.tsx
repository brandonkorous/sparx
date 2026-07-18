// Twitter cards use the same artwork as the OG image.
// We re-use the rendering function but declare config locally so Next.js can
// statically detect it (re-exports of config fields aren't recognized).
import Image from './opengraph-image';

// nodejs so this card prerenders to a static .body with a real Content-Length —
// LinkedIn rejects the chunked, no-Content-Length response an edge OG route
// streams. See app/opengraph-image.tsx for the full reasoning.
export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'sparx — Everything, ignited.';

export default Image;
