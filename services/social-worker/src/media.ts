// Resolve a post's media asset ids to public MediaRefs the renderer + adapters use
// (docs/133 §8). Each asset carries its base (largest scale-to-width) variant plus the
// social aspect crops the media worker derived; at publish time we hand each TARGET
// the crop nearest its platform's required ratio, falling back to the base variant when
// a crop is missing (an older asset, or a non-image). Ordering is preserved — a
// carousel's order is the tenant's order.
//
// An asset that is not yet processed (no ready variant) or a deployment with no media
// base configured yields fewer refs than ids — the drain logs that gap rather than
// dropping it silently.

import { withTenant } from '@sparx/db';
import { constraintsFor, type MediaRef, type SocialPlatform } from '@sparx/social';
import { env } from './env.js';

/** One resolved asset: its kind, its base variant URL, and any social crop URLs keyed
 *  by aspect ('1:1' | '4:5' | '9:16' | '16:9'). */
export interface ResolvedAsset {
  id: string;
  kind: 'image' | 'video';
  baseUrl: string;
  crops: Record<string, string>;
}

// The four crop ratios the media worker produces (crop.ts), as numeric ratios, so a
// platform's declared aspect maps to the nearest one we actually have on disk.
const CORE_ASPECTS: readonly { name: string; ratio: number }[] = [
  { name: '9:16', ratio: 9 / 16 },
  { name: '4:5', ratio: 4 / 5 },
  { name: '1:1', ratio: 1 },
  { name: '16:9', ratio: 16 / 9 },
];

function parseRatio(label: string): number {
  const [a, b] = label.split(':').map(Number);
  return a && b ? a / b : 1;
}

/** The crop a platform should publish: its first declared aspect ratio, snapped to the
 *  nearest crop the worker generates (log-distance, so 4:3 → 1:1 and 2:3 → 9:16 land
 *  perceptually, not numerically). Pure over @sparx/social constraints — the ONE
 *  source of truth for platform ratios. */
export function preferredAspectFor(platform: SocialPlatform): string {
  const ratios = constraintsFor(platform).aspectRatios ?? [];
  const first = ratios[0];
  const target = first ? parseRatio(first) : 1;
  let best = { name: '1:1', ratio: 1 };
  let bestDist = Infinity;
  for (const c of CORE_ASPECTS) {
    const dist = Math.abs(Math.log(target) - Math.log(c.ratio));
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best.name;
}

function kindFor(mime: string): 'image' | 'video' | null {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return null;
}

/** Drop the bucket-convention middle `variants/` segment so the URL is the THREE-segment
 *  shape the serving route matches — the SAME contract as api-rest's `variantUrlPath`
 *  (docs/brain/apps/services.md "Media serving"). The stored key is four segments
 *  (`<tenant>/variants/<asset>/<file>`); the route is
 *  `/v1/public/media/variants/:tenantId/:assetId/:filename`. Emitting the raw key makes a
 *  four-segment URL the route never matches → the platform can't fetch the image and the
 *  post goes out image-less (or the photo call fails). This helper is the fix. */
export function variantUrlPath(key: string): string {
  return key.replace('/variants/', '/');
}

/** Load the post's assets with their base + crop variants, preserving id order. */
export async function resolvePostAssets(
  tenantId: string,
  assetIds: string[]
): Promise<ResolvedAsset[]> {
  if (assetIds.length === 0 || !env.MEDIA_PUBLIC_BASE_URL) return [];
  const base = env.MEDIA_PUBLIC_BASE_URL.replace(/\/$/, '');
  const url = (key: string): string => `${base}/v1/public/media/variants/${variantUrlPath(key)}`;

  const assets = await withTenant({ tenantId }, (tx) =>
    tx.mediaAsset.findMany({
      where: { id: { in: assetIds }, status: 'ready', deletedAt: null },
      select: {
        id: true,
        mimeType: true,
        variants: { select: { key: true, width: true, aspect: true, format: true } },
      },
    })
  );
  const byId = new Map(assets.map((a) => [a.id, a]));

  const out: ResolvedAsset[] = [];
  for (const id of assetIds) {
    const asset = byId.get(id);
    if (!asset) continue;
    const kind = kindFor(asset.mimeType);
    if (!kind) continue;

    // Base = a scale-to-width variant (aspect IS NULL). PREFER jpeg — Facebook (and the
    // other platforms' by-URL photo ingest) reliably accept jpeg but can reject an
    // avif/webp base; within the same format preference, take the widest.
    let baseKey: string | null = null;
    let baseWidth = -1;
    let baseIsJpeg = false;
    const crops: Record<string, string> = {};
    for (const v of asset.variants) {
      if (v.aspect) {
        crops[v.aspect] = url(v.key);
        continue;
      }
      const isJpeg = v.format === 'jpeg' || v.format === 'jpg';
      const better =
        baseKey === null ||
        (isJpeg && !baseIsJpeg) ||
        (isJpeg === baseIsJpeg && v.width > baseWidth);
      if (better) {
        baseKey = v.key;
        baseWidth = v.width;
        baseIsJpeg = isJpeg;
      }
    }
    // Base URL falls back to any crop (all crops are jpeg) when there's no scale-to-width
    // variant — a valid, platform-accepted image either way.
    const baseUrl = baseKey ? url(baseKey) : Object.values(crops)[0];
    if (!baseUrl) continue; // nothing renderable
    out.push({ id, kind, baseUrl, crops });
  }
  return out;
}

/** Platforms that publish an image by handing THEIR servers a URL to fetch (vs. the
 *  byte-upload platforms — Facebook/LinkedIn — which download via this worker). These
 *  must fetch from the direct-origin host: Cloudflare answers any `Range` request on a
 *  cacheable media object with a `206 Partial Content` (verified on HIT and MISS), and
 *  Instagram/Threads/Pinterest reject a 206, dropping the image. `MEDIA_DIRECT_BASE_URL`
 *  is a DNS-only host that bypasses CF, so the origin's clean 200 reaches them. */
const URL_FETCH_PLATFORMS: ReadonlySet<SocialPlatform> = new Set<SocialPlatform>([
  'instagram',
  'threads',
  'pinterest',
]);

/** Whether a platform hands its OWN servers an image_url to fetch (so it needs the
 *  CF-bypassing direct host), vs. a byte-upload platform that keeps the CDN host. */
export function isUrlFetchPlatform(platform: SocialPlatform): boolean {
  return URL_FETCH_PLATFORMS.has(platform);
}

/** Swap a variant URL's public (CDN) host prefix for the direct-origin host. Pure over
 *  its bases so it's unit-tested without env: a no-op when either base is missing or the
 *  URL doesn't start with the public base — so an unset direct host preserves the exact
 *  pre-fix behavior. Trailing slashes on either base are tolerated. */
export function swapMediaHost(
  url: string,
  publicBase: string | undefined,
  directBase: string | undefined
): string {
  const pub = publicBase?.replace(/\/$/, '');
  const dir = directBase?.replace(/\/$/, '');
  if (!pub || !dir || !url.startsWith(pub)) return url;
  return dir + url.slice(pub.length);
}

/** The MediaRefs to publish to one platform: each asset's crop for that platform's
 *  aspect, or its base variant when no such crop exists. URL-fetch platforms
 *  (Instagram/Threads/Pinterest) get the direct-origin host so Cloudflare's 206 on a
 *  ranged fetch can't drop the image (see `URL_FETCH_PLATFORMS`). */
export function mediaRefsForPlatform(
  assets: ResolvedAsset[],
  platform: SocialPlatform
): MediaRef[] {
  const aspect = preferredAspectFor(platform);
  return assets.map((a) => {
    const url = a.crops[aspect] ?? a.baseUrl;
    return {
      url: isUrlFetchPlatform(platform)
        ? swapMediaHost(url, env.MEDIA_PUBLIC_BASE_URL, env.MEDIA_DIRECT_BASE_URL)
        : url,
      kind: a.kind,
    };
  });
}
