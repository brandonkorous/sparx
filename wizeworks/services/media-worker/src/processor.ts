// Per-asset processing pipeline. Pure function so the integration test
// can drive it without involving Pub/Sub.
//
//   1. Look up the MediaAsset row.
//   2. Download original bytes from GCS.
//   3. Run transcode() — variants + blurhash + dominant color + dims.
//   4. Upload each variant to GCS under the standard variant prefix.
//   5. Write MediaVariant rows + update MediaAsset(status='ready').
//
// On failure: MediaAsset.status='failed', processingError = err.message.
// The Pub/Sub message is acked either way — retries happen at a higher
// level (operator can re-enqueue manually) rather than thrashing GCS on
// transient encode failures.

import { withTenant } from '@wizeworks/db';
import { downloadObject, uploadVariant, variantKey } from './storage.js';
import { transcode } from './transcode.js';
import { cropSocialAspects } from './crop.js';

export interface ProcessResult {
  status: 'ready' | 'failed' | 'skipped';
  variantCount: number;
  errorMessage?: string;
}

export interface ProcessOptions {
  // Recrop-only pass (docs/133 §8): the asset is already `ready`; regenerate JUST its
  // social aspect crops from the current focal point (e.g. after the tenant nudged it,
  // or when media is first attached to a post). Leaves the base variants + status
  // untouched. The default (false) is the full upload pass.
  cropsOnly?: boolean;
}

export async function processAsset(
  assetId: string,
  tenantId: string,
  logger: {
    info: (obj: object, msg?: string) => void;
    warn: (obj: object, msg?: string) => void;
    error: (obj: object, msg?: string) => void;
  },
  opts: ProcessOptions = {}
): Promise<ProcessResult> {
  // media_assets is FORCE-RLS, so the load MUST run inside the tenant context
  // (from the event's tenantId) — a bare prisma query has no `current_tenant_id()`
  // and returns null in prod, which would log "asset missing" and skip every
  // upload's transcode. (Passes locally only because the dev DB user is a
  // superuser that bypasses RLS.) The write tx below already sets the context.
  const asset = await withTenant({ tenantId }, (tx) =>
    tx.mediaAsset.findUnique({ where: { id: assetId } })
  );
  if (!asset || asset.deletedAt) {
    logger.warn({ assetId }, 'asset missing or soft-deleted; skipping');
    return { status: 'skipped', variantCount: 0 };
  }

  // Recrop-only pass: the asset is already processed; just refresh its social crops
  // from the current focal point. A crops-only request for an asset that never
  // finished its base pass is a no-op (the base pass will crop when it runs).
  if (opts.cropsOnly) {
    if (asset.status !== 'ready') {
      logger.warn({ assetId, status: asset.status }, 'recrop for a non-ready asset; skipping');
      return { status: 'skipped', variantCount: 0 };
    }
    return regenerateCrops(asset, logger);
  }

  if (asset.status !== 'uploading') {
    logger.warn({ assetId, status: asset.status }, 'asset not in uploading state; skipping');
    return { status: 'skipped', variantCount: 0 };
  }

  try {
    logger.info({ assetId, key: asset.key, mimeType: asset.mimeType }, 'downloading original');
    const original = await downloadObject(asset.key);

    logger.info({ assetId, bytes: original.length }, 'transcoding');
    const result = await transcode(original, asset.mimeType);

    // Social aspect crops (docs/133 §8) alongside the responsive base variants —
    // framed to the asset's focal point so a post's image arrives correctly cropped
    // on every platform without the tenant doing it by hand.
    const crops = await cropSocialAspects(original, asset.mimeType, {
      x: asset.focalPointX,
      y: asset.focalPointY,
    });

    logger.info(
      { assetId, variants: result.variants.length, crops: crops.length },
      'uploading variants'
    );
    await Promise.all([
      ...result.variants.map((v) =>
        uploadVariant(
          variantKey(asset.tenantId, asset.id, v.format, v.width, v.ext),
          v.contentType,
          v.body
        )
      ),
      ...crops.map((c) =>
        uploadVariant(
          variantKey(asset.tenantId, asset.id, 'jpeg', c.width, c.ext, c.aspect),
          c.contentType,
          c.body
        )
      ),
    ]);

    // Single transaction so all the rows land atomically — the worker
    // either ships a complete set of variants OR leaves the asset in
    // status='uploading' for a manual retry.
    await withTenant({ tenantId: asset.tenantId }, async (tx) => {
      await tx.mediaVariant.deleteMany({ where: { assetId: asset.id } });
      for (const v of result.variants) {
        await tx.mediaVariant.create({
          data: {
            tenantId: asset.tenantId,
            assetId: asset.id,
            format: v.format,
            width: v.width,
            height: v.height,
            byteSize: BigInt(v.body.length),
            key: variantKey(asset.tenantId, asset.id, v.format, v.width, v.ext),
          },
        });
      }
      for (const c of crops) {
        await tx.mediaVariant.create({
          data: {
            tenantId: asset.tenantId,
            assetId: asset.id,
            format: 'jpeg',
            aspect: c.aspect,
            width: c.width,
            height: c.height,
            byteSize: BigInt(c.body.length),
            key: variantKey(asset.tenantId, asset.id, 'jpeg', c.width, c.ext, c.aspect),
          },
        });
      }
      await tx.mediaAsset.update({
        where: { id: asset.id },
        data: {
          status: 'ready',
          width: result.width,
          height: result.height,
          dominantColor: result.dominantColor,
          blurhash: result.blurhash,
          processingError: null,
        },
      });
    });

    const variantCount = result.variants.length + crops.length;
    logger.info({ assetId, variantCount }, 'asset ready');
    return { status: 'ready', variantCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ assetId, err: message }, 'processing failed');
    await withTenant({ tenantId: asset.tenantId }, async (tx) => {
      await tx.mediaAsset.update({
        where: { id: asset.id },
        data: { status: 'failed', processingError: message },
      });
    });
    return { status: 'failed', variantCount: 0, errorMessage: message };
  }
}

// Regenerate ONLY the social aspect crops for an already-`ready` asset from its
// current focal point (docs/133 §8). Leaves the base variants + asset row untouched.
// A raster asset yields the four crops; a non-image (SVG/video) yields none, and any
// stale crop rows are cleared either way. Best-effort: a failure here does NOT flip
// the asset to `failed` (its base variants are fine) — it logs + reports skipped so a
// redelivery retries.
async function regenerateCrops(
  asset: {
    id: string;
    tenantId: string;
    key: string;
    mimeType: string;
    focalPointX: number;
    focalPointY: number;
  },
  logger: {
    info: (obj: object, msg?: string) => void;
    warn: (obj: object, msg?: string) => void;
    error: (obj: object, msg?: string) => void;
  }
): Promise<ProcessResult> {
  try {
    const original = await downloadObject(asset.key);
    const crops = await cropSocialAspects(original, asset.mimeType, {
      x: asset.focalPointX,
      y: asset.focalPointY,
    });

    await Promise.all(
      crops.map((c) =>
        uploadVariant(
          variantKey(asset.tenantId, asset.id, 'jpeg', c.width, c.ext, c.aspect),
          c.contentType,
          c.body
        )
      )
    );

    await withTenant({ tenantId: asset.tenantId }, async (tx) => {
      // Replace only the crop rows (aspect IS NOT NULL) — base variants stay.
      await tx.mediaVariant.deleteMany({ where: { assetId: asset.id, aspect: { not: null } } });
      for (const c of crops) {
        await tx.mediaVariant.create({
          data: {
            tenantId: asset.tenantId,
            assetId: asset.id,
            format: 'jpeg',
            aspect: c.aspect,
            width: c.width,
            height: c.height,
            byteSize: BigInt(c.body.length),
            key: variantKey(asset.tenantId, asset.id, 'jpeg', c.width, c.ext, c.aspect),
          },
        });
      }
    });

    logger.info({ assetId: asset.id, crops: crops.length }, 'social crops regenerated');
    return { status: 'ready', variantCount: crops.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ assetId: asset.id, err: message }, 'recrop failed');
    return { status: 'skipped', variantCount: 0, errorMessage: message };
  }
}
