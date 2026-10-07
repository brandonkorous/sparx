'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE MEDIA LIBRARY DATA LAYER (admin)
//
// The picker in ./media.ts reads a thin, image-only slice of the library — one
// thumbnail URL per row, enough to choose a picture. The Media library SURFACE
// needs the whole story: every kind of file (images, video, audio, documents),
// the size and dimensions, the alt text and caption you can edit, how many
// places a file is used, and the delete. So this layer owns the FULL wire shape
// and its own key tree, and never edits media.ts (which the editor depends on).
//
// api-rest is snake_case on the wire (see serializeAsset in
// wizeworks/services/api-rest/src/routes/v1/media/assets.ts). Field names are kept
// verbatim off the wire and mapped ONCE, here, into the camelCase shape a
// surface renders — so there is one spelling of each fact between server and
// screen, and the list and the detail can never disagree about a field.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { apiErrorMessage } from '../../lib/api-error';
import { api } from '../../lib/api/client';
import { focalFromWire } from './focal-point';

/* ── What a file is, in the terms this surface groups by ─────────────────── */

export type MediaKind = 'image' | 'video' | 'audio' | 'document' | 'other';

/** The broad family a file belongs to, from its mime type. Drives the kind
 *  filter, the tile icon, and whether we show an image/video/audio preview. */
export function mediaKind(mimeType: string): MediaKind {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'document';
  return 'other';
}

/** The `?type=` prefix the list endpoint filters on (a `mimeType startsWith`).
 *  Documents live under the `application/` prefix. */
function kindToTypeParam(kind: Exclude<MediaKind, 'all' | 'other'>): string {
  return kind === 'document' ? 'application' : kind;
}

export type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

/** What a file's processing status means, in an owner's words, with the tone
 *  that carries it on a `<Badge>`. `uploading` covers both "the bytes are still
 *  arriving" and, in production, "the worker is still making thumbnails" — from
 *  the owner's side both are simply "not ready yet". */
export function assetStatusState(status: string): { label: string; tone: Tone; detail: string } {
  switch (status) {
    case 'ready':
      return { label: 'Ready', tone: 'success', detail: 'Uploaded and ready to use anywhere.' };
    case 'uploading':
      return {
        label: 'Processing',
        tone: 'warning',
        detail: 'Still being prepared. It will be ready to use in a moment. Refresh to check.',
      };
    case 'failed':
      return {
        label: 'Failed',
        tone: 'error',
        detail: 'Something went wrong preparing this file. Try uploading it again.',
      };
    default:
      return { label: status, tone: 'neutral', detail: '' };
  }
}

/* ── Wire shapes ────────────────────────────────────────────────────────── */

interface MediaVariantWire {
  id: string;
  format: string;
  width: number;
  height: number;
  byte_size: string;
  url: string;
}

/** One asset exactly as api-rest serialises it. Numbers that can exceed 2^53
 *  (byte sizes) arrive as strings. */
interface MediaAssetWire {
  id: string;
  key: string;
  original_filename: string;
  mime_type: string;
  byte_size: string;
  width: number | null;
  height: number | null;
  duration_sec: number | null;
  dominant_color: string | null;
  blurhash: string | null;
  focal_point: { x: number; y: number };
  alt_text: string | null;
  caption: string | null;
  status: string;
  processing_error: string | null;
  usage_count: number;
  usage_breakdown: {
    products: number;
    content: number;
    customers: number;
    authors: number;
    staff_documents: number;
    expenses: number;
    /** Absent from an api-rest older than issue 932. */
    site_pages?: number;
    site_layouts?: number;
    branding?: number;
    catalog?: number;
    reviews?: number;
    social_posts?: number;
    other_records?: number;
  } | null;
  original_url: string | null;
  /** Which products, articles and site pages show it, by name. Only on the
   *  single read (issue 932). */
  used_by?: UsePlace[];
  variants: MediaVariantWire[];
  created_at: string;
  updated_at: string;
}

/* ── The shape a surface renders ─────────────────────────────────────────── */

export interface MediaAsset {
  id: string;
  filename: string;
  mimeType: string;
  kind: MediaKind;
  /** Bytes as a real number — files are capped at 200 MB, so this is safe.
   *
   *  NULL when nobody measured it. No file is zero bytes, so a stored 0 never
   *  means "weighs nothing"; it means the size was never recorded — every
   *  linked picture, and 84 stored ones whose upload predates the size being
   *  written. Rendering that 0 through `formatBytes` printed a confident
   *  **0 bytes** under 74 of Devi's 87 photographs (issue 380). Issue 330
   *  settled the same rule for the publish weight report. */
  byteSize: number | null;
  /** The file is LINKED from somewhere else rather than stored here — the key
   *  is an `http(s):` URL (a hot-linked blueprint picture) or a `data:` URI (an
   *  inline brand mark). It is why most unmeasured files are unmeasured: there
   *  was never a local file to weigh. Same test api-rest uses to decide whether
   *  a key needs resolving through storage. */
  linked: boolean;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  /** Which part of the picture matters, 0..1 on each axis. Dead centre means
   *  NOBODY has chosen: the media worker treats that as "find the subject
   *  yourself" and only obeys the stored pair when it has been moved. Four
   *  layers read this and, until issue 869, no screen could write it — the
   *  wire has always carried `focal_point` and this mapper dropped it. */
  focalX: number;
  focalY: number;
  /** A small rendition for a grid tile, or null while nothing renders yet. */
  thumbnailUrl: string | null;
  /** The best full-size URL for a detail preview (the original, or the largest
   *  transcoded variant when the original is private). */
  previewUrl: string | null;
  altText: string | null;
  caption: string | null;
  status: string;
  processingError: string | null;
  usageCount: number;
  /** What is using it, by kind. Null on the paths that do not count (nothing
   *  renders those). The total above is a FLOOR: a picture placed directly into
   *  a page in the site editor is not counted, because a builder tree keeps its
   *  asset ids in plain JSON with no index beside them. */
  usage: AssetUsageBreakdown | null;
  /** Null where it was not asked for (the list). */
  usedBy: UsePlace[] | null;
  createdAt: string;
  updatedAt: string;
}

/** Where an asset is used, by kind — the same six api-rest counts. */
/** One place that shows a file, named, so the file's page can open it. */
export interface UsePlace {
  kind: 'product' | 'entry' | 'page' | 'layout';
  id: string;
  name: string;
  /** The site a page or a header and footer belongs to; null otherwise. */
  site: string | null;
  /** That site's id, to switch to it before opening the page. */
  siteId: string | null;
}

/** How a place reads in the list: what it is, and for a page, whose site. A
 *  business with seven sites has seven pages called Home (issue 932). */
export function placeLabel(place: UsePlace): string {
  switch (place.kind) {
    case 'product':
      return `${place.name} (product)`;
    case 'entry':
      return `${place.name} (page or article)`;
    case 'page':
      return `${place.name} (site page on ${place.site ?? 'your site'})`;
    case 'layout':
      return `Header and footer “${place.name}” on ${place.site ?? 'your site'}`;
  }
}

/** The pane that opens a place. A page or a header and footer on another site
 *  is opened after switching to that site (see media-used-by). */
export function placeTarget(place: UsePlace): { surface: string; params: Record<string, string> } {
  switch (place.kind) {
    case 'product':
      return { surface: 'commerce.product.detail', params: { id: place.id } };
    case 'entry':
      return { surface: 'cms.content.detail', params: { id: place.id } };
    case 'page':
      return { surface: 'builder.page', params: { pageId: place.id } };
    case 'layout':
      return { surface: 'builder.layout', params: {} };
  }
}

export interface AssetUsageBreakdown {
  products: number;
  content: number;
  customers: number;
  authors: number;
  staffDocuments: number;
  expenses: number;
  sitePages: number;
  siteLayouts: number;
  branding: number;
  catalog: number;
  reviews: number;
  socialPosts: number;
  otherRecords: number;
}

/** The smallest rendition at least `minWidth` across (sharp on a tile without
 *  hauling a full-size photo), falling back to the largest variant, then the
 *  original. */
function pickThumbnail(wire: MediaAssetWire, minWidth: number): string | null {
  const sorted = [...wire.variants].sort((a, b) => a.width - b.width);
  const big = sorted.find((variant) => variant.width >= minWidth);
  return big?.url ?? sorted.at(-1)?.url ?? wire.original_url;
}

function toAsset(wire: MediaAssetWire): MediaAsset {
  const largestVariant = [...wire.variants].sort((a, b) => b.width - a.width)[0]?.url ?? null;
  const byteSize = Number(wire.byte_size);
  const focal = focalFromWire(wire.focal_point);
  return {
    id: wire.id,
    filename: wire.original_filename,
    mimeType: wire.mime_type,
    kind: mediaKind(wire.mime_type),
    byteSize: Number.isFinite(byteSize) && byteSize > 0 ? byteSize : null,
    linked: /^(?:https?:|data:)/i.test(wire.key),
    width: wire.width,
    height: wire.height,
    durationSec: wire.duration_sec,
    focalX: focal.x,
    focalY: focal.y,
    thumbnailUrl: pickThumbnail(wire, 320),
    // Prefer the true original; fall back to the largest variant when the
    // original is private (production images) so a preview still renders.
    previewUrl: wire.original_url ?? largestVariant,
    altText: wire.alt_text,
    caption: wire.caption,
    status: wire.status,
    processingError: wire.processing_error,
    usageCount: wire.usage_count,
    usage: wire.usage_breakdown
      ? {
          products: wire.usage_breakdown.products,
          content: wire.usage_breakdown.content,
          customers: wire.usage_breakdown.customers,
          authors: wire.usage_breakdown.authors,
          staffDocuments: wire.usage_breakdown.staff_documents,
          expenses: wire.usage_breakdown.expenses,
          sitePages: wire.usage_breakdown.site_pages ?? 0,
          siteLayouts: wire.usage_breakdown.site_layouts ?? 0,
          branding: wire.usage_breakdown.branding ?? 0,
          catalog: wire.usage_breakdown.catalog ?? 0,
          reviews: wire.usage_breakdown.reviews ?? 0,
          socialPosts: wire.usage_breakdown.social_posts ?? 0,
          otherRecords: wire.usage_breakdown.other_records ?? 0,
        }
      : null,
    usedBy: wire.used_by ?? null,
    createdAt: wire.created_at,
    updatedAt: wire.updated_at,
  };
}

/* ── The query-key tree ─────────────────────────────────────────────────── */

/** All the ways the library list can be narrowed. `kind: 'all'` and
 *  `status: 'all'` mean "don't filter on that axis". */
export interface MediaListQuery {
  q: string;
  kind: MediaKind | 'all';
  status: 'all' | 'ready' | 'uploading' | 'failed';
  /** Whether anything uses the file (issue 932). */
  usage: 'all' | 'used' | 'unused';
  sort: 'recent' | 'oldest' | 'name' | 'largest';
  take: number;
  skip: number;
}

// A namespace distinct from the picker's `['cms','media','library'|'assets']`
// keys, so the two caches never collide — the picker's image-only, ready-only
// slice is a different query from the library's every-file window.
export const mediaAdminKeys = {
  all: ['cms', 'media', 'admin'] as const,
  lists: () => [...mediaAdminKeys.all, 'list'] as const,
  list: (query: MediaListQuery) => [...mediaAdminKeys.lists(), query] as const,
  detail: (id: string) => [...mediaAdminKeys.all, 'detail', id] as const,
};

/* ── Reads ──────────────────────────────────────────────────────────────── */

export function useMediaAssetsList(query: MediaListQuery) {
  return useQuery({
    queryKey: mediaAdminKeys.list(query),
    queryFn: async () => {
      const { items, total } = await api.list<MediaAssetWire>('/v1/media/assets', {
        ...(query.q ? { q: query.q } : {}),
        ...(query.kind !== 'all' && query.kind !== 'other'
          ? { type: kindToTypeParam(query.kind) }
          : {}),
        ...(query.status !== 'all' ? { status: query.status } : {}),
        ...(query.usage !== 'all' ? { usage: query.usage } : {}),
        ...(query.sort !== 'recent' ? { sort: query.sort } : {}),
        take: query.take,
        skip: query.skip,
      });
      return { items: items.map(toAsset), total };
    },
    // Keeps the current window on screen while the next one loads, so paging and
    // filtering don't blink the grid out to an empty state and back.
    placeholderData: (previous) => previous,
  });
}

export function useMediaAsset(id: string) {
  return useQuery({
    queryKey: mediaAdminKeys.detail(id),
    queryFn: async () => toAsset(await api.get<MediaAssetWire>(`/v1/media/assets/${id}`)),
    enabled: id !== 'new',
    // A 404 means deleted, not broken — don't retry it into a generic failure.
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

/** The one way anything here says "that changed": refresh the list windows, and
 *  — when a specific asset moved — its own record. Scoped to `lists()` rather
 *  than the whole `all` prefix so a list refresh never re-touches OTHER open
 *  detail panes. */
function useInvalidateMedia() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: mediaAdminKeys.lists() });
    if (id) void queryClient.invalidateQueries({ queryKey: mediaAdminKeys.detail(id) });
  };
}

/** Exposed for the list surface, which uploads through the picker's shared
 *  `useUploadMedia` (in ./media.ts) and needs to refresh THIS list afterwards —
 *  that hook only knows to refresh the picker's own cache. */
export function useRefreshMediaLibrary() {
  const invalidate = useInvalidateMedia();
  return () => {
    invalidate();
  };
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

/** The metadata the API lets you change on an asset. Filename is NOT here — the
 *  PATCH route only accepts these four fields, so the file's name is identity,
 *  not an editable field. */
export interface UpdateAssetInput {
  alt_text?: string | null;
  caption?: string | null;
  focal_point_x?: number;
  focal_point_y?: number;
}

export function useUpdateAsset(id: string) {
  const invalidate = useInvalidateMedia();
  return useMutation({
    mutationFn: (input: UpdateAssetInput) =>
      api.patch<MediaAssetWire>(`/v1/media/assets/${id}`, input).then(toAsset),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useDeleteAsset(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`/v1/media/assets/${id}`),
    onSuccess: () => {
      // Only the LIST is refreshed. The detail query is deliberately left alone:
      // the delete closes this pane, and refetching (or removing) detail(id)
      // would disturb the pane's own still-mounted observer while the dock
      // commits the close — a flushSync inside a lifecycle method.
      void queryClient.invalidateQueries({ queryKey: mediaAdminKeys.lists() });
    },
  });
}

/* ── Saying things in plain words ───────────────────────────────────────── */

/**
 * A human size — "2.4 MB", not "2516582 bytes".
 */
/** What to print where a file's size goes.
 *
 *  A size nobody recorded must not render as one, and the two reasons a size is
 *  missing are worth telling apart: a linked picture was never downloaded here,
 *  so there is nothing of ours to weigh, while a stored file with no size is a
 *  gap in its own record. */
export function sizeLabel(asset: Pick<MediaAsset, 'byteSize' | 'linked'>): string {
  if (asset.byteSize !== null) return formatBytes(asset.byteSize);
  return asset.linked ? 'Stored somewhere else' : 'Size not recorded';
}

/** "3 product photos and 1 page", or null when nothing is using it. Names the
 *  KINDS rather than a bare count, because "used in 4 places" does not tell an
 *  owner which screen to open before she can delete the file. */
export function usedInLabel(asset: Pick<MediaAsset, 'usageCount' | 'usage'>): string | null {
  if (asset.usageCount <= 0) return null;
  const u = asset.usage;
  if (!u) {
    const n = asset.usageCount;
    return `${String(n)} ${n === 1 ? 'place' : 'places'} on your site`;
  }
  const parts: string[] = [];
  const add = (n: number, one: string, many: string) => {
    if (n > 0) parts.push(`${String(n)} ${n === 1 ? one : many}`);
  };
  add(u.products, 'product photo', 'product photos');
  add(u.content, 'page or article', 'pages and articles');
  add(u.customers, 'customer record', 'customer records');
  add(u.authors, 'author profile', 'author profiles');
  add(u.staffDocuments, 'staff document', 'staff documents');
  add(u.expenses, 'expense', 'expenses');
  add(u.sitePages, 'site page', 'site pages');
  add(u.siteLayouts, 'site header or footer', 'site headers and footers');
  add(u.branding, 'logo or site icon', 'logos and site icons');
  add(u.catalog, 'category or collection', 'categories and collections');
  add(u.reviews, 'customer review', 'customer reviews');
  add(u.socialPosts, 'social post', 'social posts');
  add(u.otherRecords, 'other record', 'other records');
  if (parts.length === 0) return `${String(asset.usageCount)} places on your site`;
  if (parts.length === 1) return parts[0]!;
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)!}`;
}

/**
 * The line under a tile's filename: where the picture is used, or that nothing
 * uses it.
 *
 * The grid used to say the file's size there, and on 74 of Devi's 87 pictures
 * that read "Stored somewhere else": the same words on almost every tile, while
 * the fact that differed, and the one she needs before she deletes anything, was
 * already on every row the list fetched and drawn only on the detail (issue
 * 932). A library full of a design's sample pictures is cleared by finding the
 * ones nothing uses.
 */
export function tileUseLine(asset: Pick<MediaAsset, 'usageCount' | 'usage'>): string {
  const used = usedInLabel(asset);
  // "No use found", not "Not used anywhere": an email design, a saved section
  // or a theme can still hold a picture's address, and none of those is counted.
  return used === null ? 'No use found' : `In ${used}`;
}

/** The size, for a tile, only when it says something: a measured size, or the
 *  fault of a stored file nobody weighed. A picture kept somewhere else has no
 *  size of ours, and its own page says why. */
export function tileSizeLine(asset: Pick<MediaAsset, 'byteSize' | 'linked'>): string | null {
  if (asset.byteSize === null && asset.linked) return null;
  return sizeLabel(asset);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 bytes';
  const units = ['bytes', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  const rounded =
    exponent === 0 ? value : value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${String(rounded)} ${units[exponent]}`;
}

/** Pixel dimensions, or null when the file has none (audio, most documents). */
export function dimensionsLabel(asset: Pick<MediaAsset, 'width' | 'height'>): string | null {
  if (asset.width && asset.height) return `${String(asset.width)} × ${String(asset.height)} pixels`;
  return null;
}

/** A duration in minutes and seconds, for video and audio. */
export function durationLabel(durationSec: number | null): string | null {
  if (!durationSec || durationSec <= 0) return null;
  const total = Math.round(durationSec);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes)}:${seconds.toString().padStart(2, '0')}`;
}

/** Medium date and time. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * The server's own sentence for a 4xx, shown verbatim: the media routes explain
 * the real problem far better than a status code — most importantly the delete
 * conflict ("Asset is still referenced by 3 entries."), which names the exact
 * reason a file cannot be removed. A 5xx carries no such sentence, so it falls
 * back to the caller's wording.
 */
export function mediaErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}
