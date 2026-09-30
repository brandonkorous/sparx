'use client';

// The media library as the "pick a picture" field lists it: images only, ready
// only. Split from media-field.tsx so the wire mapping can be tested alone.

import { useQuery } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import type { MediaAsset } from './products-data';

interface MediaAssetWire {
  id: string;
  original_filename: string;
  mime_type: string;
  status: string;
  original_url: string | null;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  variants: { id: string; format: string; width: number; height: number; url: string }[];
}

/** Same path-based test the product data layer and next.config use: is this one
 *  of OUR media URLs, so the image optimizer may touch it? */
function isOwnMediaUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    return new URL(url, 'http://localhost').pathname.startsWith('/v1/public/media/');
  } catch {
    return false;
  }
}

function thumbnailUrl(wire: MediaAssetWire): string | null {
  const sorted = [...wire.variants].sort((a, b) => a.width - b.width);
  const big = sorted.find((variant) => variant.width >= 320);
  return big?.url ?? sorted.at(-1)?.url ?? wire.original_url;
}

/** Carries the library's own alt text and size. These were hard-coded to null,
 *  so a picked picture arrived with no description even when the owner had
 *  written one. A blank description is none, never the filename. */
export function toLibraryAsset(wire: MediaAssetWire): MediaAsset {
  const url = thumbnailUrl(wire);
  return {
    id: wire.id,
    filename: wire.original_filename,
    mimeType: wire.mime_type,
    width: wire.width,
    height: wire.height,
    altText: wire.alt_text?.trim() ? wire.alt_text : null,
    url,
    canOptimize: isOwnMediaUrl(url),
    status: wire.status,
  };
}

export function useMediaLibrary(search: string, open: boolean) {
  return useQuery({
    queryKey: ['media', 'library', 'image', { q: search }],
    queryFn: async () => {
      const { items } = await api.list<MediaAssetWire>('/v1/media/assets', {
        type: 'image',
        status: 'ready',
        ...(search ? { q: search } : {}),
        take: 60,
      });
      return items.map(toLibraryAsset);
    },
    // Only fetch while the picker is open — the library is otherwise never read.
    enabled: open,
  });
}
