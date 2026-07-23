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

/** Load the post's assets with their base + crop variants, preserving id order. */
export async function resolvePostAssets(
  tenantId: string,
  assetIds: string[]
): Promise<ResolvedAsset[]> {
  if (assetIds.length === 0 || !env.MEDIA_PUBLIC_BASE_URL) return [];
  const base = env.MEDIA_PUBLIC_BASE_URL.replace(/\/$/, '');
  const url = (key: string): string => `${base}/v1/public/media/variants/${key}`;

  const assets = await withTenant({ tenantId }, (tx) =>
    tx.mediaAsset.findMany({
      where: { id: { in: assetIds }, status: 'ready', deletedAt: null },
      select: {
        id: true,
        mimeType: true,
        variants: { select: { key: true, width: true, aspect: true } },
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

    // Base = the widest scale-to-width variant (aspect IS NULL).
    let baseKey: string | null = null;
    let baseWidth = -1;
    const crops: Record<string, string> = {};
    for (const v of asset.variants) {
      if (v.aspect) {
        crops[v.aspect] = url(v.key);
      } else if (v.width > baseWidth) {
        baseWidth = v.width;
        baseKey = v.key;
      }
    }
    // Base URL falls back to any crop when there's no scale-to-width variant.
    const baseUrl = baseKey ? url(baseKey) : Object.values(crops)[0];
    if (!baseUrl) continue; // nothing renderable
    out.push({ id, kind, baseUrl, crops });
  }
  return out;
}

/** The MediaRefs to publish to one platform: each asset's crop for that platform's
 *  aspect, or its base variant when no such crop exists. */
export function mediaRefsForPlatform(
  assets: ResolvedAsset[],
  platform: SocialPlatform
): MediaRef[] {
  const aspect = preferredAspectFor(platform);
  return assets.map((a) => ({ url: a.crops[aspect] ?? a.baseUrl, kind: a.kind }));
}
