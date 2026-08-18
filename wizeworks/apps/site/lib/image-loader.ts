// Custom next/image loader for the storefront.
//
// Storefront images resolve through api-rest's public media endpoint
// (/v1/public/media/<id>), which 302-redirects to the best stored variant. We hand
// next/image this loader so it builds the responsive srcset URLs with w/q params
// appended (see siteImageLoader).
//
// This comment used to say the endpoint IGNORED `w`, and that correctly-sized bytes
// had to wait for a resizing CDN in Phase 2. Both were wrong in the same way: the
// variants were already there — `media-worker` has generated four widths in three
// formats on every upload since it shipped — and nothing needed buying. The resolver
// simply never read the parameter, and answered every request with the widest file it
// had. It reads it now (`pickVariant`), so every srcset this loader has been emitting
// all along started serving real, correctly-sized bytes with zero component changes.

import { siteImageLoader } from './media';

export default function imageLoader(params: {
  src: string;
  width: number;
  quality?: number;
}): string {
  return siteImageLoader(params);
}
