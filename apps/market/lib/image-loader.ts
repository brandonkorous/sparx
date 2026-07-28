// Custom next/image loader for the marketplace.
//
// Marketplace images resolve through api-rest's public media endpoint
// (/v1/public/media/<id>), which 302-redirects to the best stored variant. We hand
// next/image this loader so it builds the responsive srcset URLs with w/q params
// appended (see marketImageLoader).
//
// The endpoint honours `w` — it picks the narrowest variant that covers the requested
// width and clamps to the widest when the source was too small to produce one (see
// `pickVariant` in api-rest's public/media route). So this srcset serves real bytes;
// it does not need a resizing CDN in front of it, which is what this comment used to
// claim while `media-worker` was already generating every width it asks for.

import { marketImageLoader } from './media';

export default function imageLoader(params: {
  src: string;
  width: number;
  quality?: number;
}): string {
  return marketImageLoader(params);
}
