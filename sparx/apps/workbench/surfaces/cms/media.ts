'use client';

// Media data — the library the content editor picks pictures from, and the
// two-phase upload that adds new ones.
//
// Backed by the media API: `GET /v1/media/assets` (browse, with thumbnail
// variants) and the `POST /v1/media/uploads` → PUT → `/complete` flow. Kept in
// the CMS module rather than borrowed from commerce's product data layer, so
// this surface stays self-contained and does not drag the whole catalog cache
// in behind one picker.

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import { getTokenState } from '../../lib/api/token';

/** One picture, as a picker or a field renders it. */
export interface MediaAsset {
  id: string;
  filename: string;
  mimeType: string;
  /** A URL that will actually render, or null while the file is still being
   *  processed (or, in production, when only the private original exists). */
  url: string | null;
  /** Whether `url` may be handed to Next's image optimizer. A tenant's asset URL
   *  is NOT guaranteed to be on our own media host (a blueprint hot-links stock
   *  photos), and `next/image` THROWS on an un-allow-listed host — which takes
   *  the pane down. Callers pass `unoptimized={!canOptimize}` to be safe. */
  canOptimize: boolean;
  status: string;
  /** 0..1 normalized subject point, defaulting to dead centre. Used when the image is
   *  cropped to a shape other than its own (per-platform social previews). */
  focalX: number;
  focalY: number;
}

/** The media API is snake_case and returns every transcoded size; the picker
 *  wants one camelCase row with one thumbnail URL. */
interface MediaAssetWire {
  id: string;
  original_filename: string;
  mime_type: string;
  status: string;
  original_url: string | null;
  // 0..1 normalized subject point. Set on the asset (the CMS image editor writes it),
  // so every surface that CROPS the image to a different shape — the social composer's
  // per-platform previews most of all — keeps the subject in frame instead of
  // centre-cropping a head off. Absent → treated as dead centre.
  focal_point_x?: number | null;
  focal_point_y?: number | null;
  variants: { id: string; format: string; width: number; height: number; url: string }[];
}

/** Is this one of OUR media URLs — decided on the PATH, not the host, because the
 *  host differs per environment while the path never does. Same predicate as
 *  next.config's `pathname: '/v1/public/media/**'` allow-list. */
function isOwnMediaUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    return new URL(url, 'http://localhost').pathname.startsWith('/v1/public/media/');
  } catch {
    return false;
  }
}

/** Smallest rendition at least 320px wide (sharp on a high-density tile, not a
 *  full-size photo), falling back to the largest variant, then the original. */
function thumbnailUrl(wire: MediaAssetWire): string | null {
  const sorted = [...wire.variants].sort((a, b) => a.width - b.width);
  const big = sorted.find((variant) => variant.width >= 320);
  return big?.url ?? sorted.at(-1)?.url ?? wire.original_url;
}

function toAsset(wire: MediaAssetWire): MediaAsset {
  const url = thumbnailUrl(wire);
  return {
    id: wire.id,
    filename: wire.original_filename,
    mimeType: wire.mime_type,
    url,
    canOptimize: isOwnMediaUrl(url),
    status: wire.status,
    focalX: clampUnit(wire.focal_point_x),
    focalY: clampUnit(wire.focal_point_y),
  };
}

/** A 0..1 focal coordinate, defaulting to centre for null/absent/out-of-range. */
function clampUnit(value: number | null | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

export const mediaKeys = {
  all: ['cms', 'media'] as const,
  library: (q: string, source?: string, collection?: string) =>
    [
      ...mediaKeys.all,
      'library',
      { q, source: source ?? null, collection: collection ?? null },
    ] as const,
  assets: (ids: string[]) => [...mediaKeys.all, 'assets', [...ids].sort().join(',')] as const,
};

/** Browse the picture library. Only fetched while the picker is open. `source` scopes
 *  to one auto-group (brand / product / marketing / content); `collection` scopes to a
 *  manual collection; absent = all. The active-site scope is applied by the server off
 *  `x-sparx-property-id`. */
export function useMediaLibrary(
  search: string,
  enabled: boolean,
  source?: string,
  collection?: string
) {
  return useQuery({
    queryKey: mediaKeys.library(search, source, collection),
    queryFn: async () => {
      const { items } = await api.list<MediaAssetWire>('/v1/media/assets', {
        type: 'image',
        status: 'ready',
        ...(search ? { q: search } : {}),
        ...(source ? { source } : {}),
        ...(collection ? { collection } : {}),
        take: 60,
      });
      return items.map(toAsset);
    },
    enabled,
  });
}

/**
 * The files behind a known set of ids — ALL of them in ONE request, for the
 * thumbnail a field shows once something is chosen. Files are effectively
 * immutable once transcoded, so this holds for five minutes.
 */
export function useMediaAssets(ids: string[]) {
  return useQuery({
    queryKey: mediaKeys.assets(ids),
    queryFn: async () => {
      const { items } = await api.list<MediaAssetWire>('/v1/media/assets', {
        ids: ids.join(','),
        take: Math.min(ids.length, 250),
      });
      return items.map(toAsset);
    },
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
    // A freshly uploaded image is still transcoding: the media-worker generates
    // its crops a few seconds after /complete, and in GCS mode those variants are
    // the ONLY previewable url (the private original resolves to null). Everything
    // that reads `url` — the social composer's per-platform preview most of all —
    // shows "Still processing…" until then. This is a one-shot query, so without
    // a poll the preview would stay stuck on that stale first read forever. Tick
    // while anything is unready, then stop so an idle pane isn't polling.
    refetchInterval: (q) => {
      const assets = q.state.data;
      if (!assets) return false;
      return assets.some((a) => a.status !== 'ready' || !a.url) ? 2_500 : false;
    },
  });
}

/** Fetch one asset in full (used right after an upload to resolve its URL). */
export async function fetchAsset(id: string): Promise<MediaAsset> {
  const wire = await api.get<MediaAssetWire>(`/v1/media/assets/${id}`);
  return toAsset(wire);
}

/**
 * Put a file in the media library and return its asset id.
 *
 * Two phases, on purpose: `POST /v1/media/uploads` reserves the row and budgets
 * the tenant's storage allowance BEFORE any bytes move, then hands back a URL to
 * PUT them to; `/complete` confirms. The bytes go by plain `fetch`, NOT through
 * `api` — the upload URL is pre-authorised and attaching a bearer token to it
 * invalidates the signature. The dev URL comes back RELATIVE (api-rest assumes a
 * proxy the workbench doesn't have), so it is resolved against the API origin.
 */
export function useUploadMedia(source?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const created = await api.post<{
        asset: { id: string };
        upload: { url: string; method: string; headers: Record<string, string> };
      }>('/v1/media/uploads', {
        filename: file.name,
        mime_type: file.type,
        byte_size: file.size,
        // The auto-group this upload belongs to (docs/49), passed by the surface
        // that opened the picker; omitted = a plain "Uploaded" library file.
        ...(source ? { source } : {}),
      });

      const { apiUrl } = await getTokenState();
      const target = created.upload.url.startsWith('/')
        ? `${apiUrl.replace(/\/$/, '')}${created.upload.url}`
        : created.upload.url;

      const response = await fetch(target, {
        method: created.upload.method,
        headers: created.upload.headers,
        body: file,
      });
      if (!response.ok) {
        throw new Error(`The file could not be uploaded (${String(response.status)}).`);
      }

      await api.post(`/v1/media/uploads/${created.asset.id}/complete`);
      return created.asset.id;
    },
    onSuccess: () => {
      // A new file changes what the library shows.
      void queryClient.invalidateQueries({ queryKey: [...mediaKeys.all, 'library'] });
    },
  });
}
