// Bringing a picture across.
//
// Shared by the media processor (a whole media library) and the product processor
// (a catalogue's galleries), because they want exactly the same behaviour and having
// two copies of it is how one of them ends up hot-linking forever.
//
// The rule: COPY the bytes. A reference to the old platform's CDN looks identical on
// migration day and goes blank the day the tenant cancels the account they migrated
// away from — which is the whole point of migrating, so it is not a hypothetical.
// Copying is slower, and this runs on a background worker whose entire reason for
// existing separately is heavy file work.
//
// The fallback: when a fetch genuinely cannot succeed — a login-walled CDN, a host
// that blocks unknown clients, a file past our size cap — the asset is recorded as a
// reference instead of dropped, and the caller is told so it can be reported. A
// borrowed image the tenant knows about beats a missing one they discover later.

import { withTenant } from '@wizeworks/db';
import {
  ALLOWED_IMAGE_MIME,
  MAX_PROXIED_UPLOAD_BYTES,
  createImageAssetFromBytes,
  createImageAssetFromUrl,
  type MediaWriteContext,
} from '@wizeworks/media';

import type { ProcessorContext } from './types';

/** Give up on one asset rather than stalling a 4,000-image run behind a dead host. */
const FETCH_TIMEOUT_MS = 20_000;

const EXTENSION_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
};

export function filenameFromUrl(url: string, given?: string): string {
  const explicit = (given ?? '').trim();
  if (explicit !== '') return explicit.slice(0, 512);
  const last = url.split('?')[0]!.split('/').pop() ?? '';
  if (last === '') return 'image';
  try {
    return decodeURIComponent(last).slice(0, 512);
  } catch {
    return last.slice(0, 512);
  }
}

function mimeFor(filename: string, headerValue: string | null): string | undefined {
  const fromHeader = (headerValue ?? '').split(';')[0]?.trim().toLowerCase();
  if (fromHeader !== undefined && ALLOWED_IMAGE_MIME.has(fromHeader)) return fromHeader;
  const extension = filename.split('.').pop()?.toLowerCase() ?? '';
  const guess = EXTENSION_MIME[extension];
  return guess !== undefined && ALLOWED_IMAGE_MIME.has(guess) ? guess : undefined;
}

async function fetchImage(
  url: string,
  filename: string
): Promise<{ data: Buffer; mimeType: string } | { failure: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { accept: 'image/*,*/*;q=0.8' },
    });
    if (!response.ok) return { failure: `the old site answered ${response.status}` };

    const declared = Number(response.headers.get('content-length') ?? '0');
    if (declared > MAX_PROXIED_UPLOAD_BYTES) {
      return { failure: `it is ${Math.round(declared / 1024)} KB, past our upload limit` };
    }

    const mimeType = mimeFor(filename, response.headers.get('content-type'));
    if (mimeType === undefined) return { failure: 'we could not tell what kind of image it is' };

    const data = Buffer.from(await response.arrayBuffer());
    if (data.length === 0) return { failure: 'the file came back empty' };
    if (data.length > MAX_PROXIED_UPLOAD_BYTES) {
      return { failure: `it is ${Math.round(data.length / 1024)} KB, past our upload limit` };
    }
    return { data, mimeType };
  } catch (error) {
    return {
      failure:
        error instanceof Error && error.name === 'AbortError'
          ? 'it timed out'
          : 'we could not reach it',
    };
  } finally {
    clearTimeout(timer);
  }
}

export interface IngestedImage {
  assetId: string;
  /** True when the bytes are ours. False means we are pointing at the old platform. */
  copied: boolean;
  /** Why it could not be copied, when `copied` is false. */
  reason?: string;
  /** True when this URL had already been brought across. */
  reused: boolean;
}

export function mediaContext(ctx: ProcessorContext): MediaWriteContext {
  return {
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    tenantSlug: ctx.tenantSlug ?? '',
  };
}

/** Pictures already brought in during this worker's life, by tenant and address:
 *  a catalogue whose 40 products share one banner downloads it once per run, not
 *  40 times. Bounded, because a worker lives through many imports. */
const seenThisRun = new Map<string, string>();
const SEEN_MAX = 20_000;

/**
 * Fetch and store one image, or reuse the copy already here.
 *
 * "Already here" used to mean a picture with the same FILE NAME, or one whose key
 * was this address. Two things were wrong with that (sparx persona issue 056):
 *
 *  - A picture that could only be LINKED last time (too big for the old cap) was
 *    reused as the link forever, and reported as copied. A re-run could never
 *    bring it across.
 *  - Two different pictures that share a name ("image.png" on two products)
 *    showed the first one's photo on both.
 *
 * So the bytes are fetched first, and a copy is reused only when its name AND
 * its exact size match. A link from an earlier run is replaced by the real copy
 * everywhere a product uses it, so the gallery keeps one placement, not two.
 */
export async function ingestImage(
  ctx: ProcessorContext,
  url: string,
  options: { filename?: string; alt?: string } = {}
): Promise<IngestedImage> {
  const remembered = seenThisRun.get(`${ctx.tenantId}|${url}`);
  if (remembered !== undefined) return { assetId: remembered, copied: true, reused: true };

  const filename = filenameFromUrl(url, options.filename);
  const linked = await withTenant(ctx, (tx) =>
    tx.mediaAsset.findFirst({
      where: { tenantId: ctx.tenantId, deletedAt: null, key: url },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })
  );

  const write = mediaContext(ctx);
  const fetched = await fetchImage(url, filename);

  if ('failure' in fetched) {
    if (linked !== null) {
      return { assetId: linked.id, copied: false, reason: fetched.failure, reused: true };
    }
    const created = await createImageAssetFromUrl(write, {
      url,
      filename,
      ...(options.alt !== undefined && options.alt !== '' ? { alt: options.alt } : {}),
    });
    return { assetId: created.assetId, copied: false, reason: fetched.failure, reused: false };
  }

  const copy = await withTenant(ctx, (tx) =>
    tx.mediaAsset.findFirst({
      where: {
        tenantId: ctx.tenantId,
        deletedAt: null,
        originalFilename: filename,
        byteSize: fetched.data.length,
        NOT: { key: { startsWith: 'http' } },
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })
  );
  const assetId =
    copy?.id ??
    (
      await createImageAssetFromBytes(write, {
        data: fetched.data,
        mimeType: fetched.mimeType,
        filename,
        ...(options.alt !== undefined && options.alt !== '' ? { alt: options.alt } : {}),
        // A copy made here, not bytes carried in an MCP message: the larger cap.
        maxBytes: MAX_PROXIED_UPLOAD_BYTES,
      })
    ).assetId;
  if (linked !== null && linked.id !== assetId) await replaceLink(ctx, linked.id, assetId);

  if (seenThisRun.size >= SEEN_MAX) seenThisRun.clear();
  seenThisRun.set(`${ctx.tenantId}|${url}`, assetId);
  return { assetId, copied: true, reused: copy !== null };
}

/**
 * Point every product picture that used a LINK at the real copy instead, and
 * retire the link. Where a product already holds the copy too, its link
 * placement is dropped rather than moved, so the gallery shows the photo once.
 */
async function replaceLink(ctx: ProcessorContext, linkId: string, copyId: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const placements = await tx.variantImage.findMany({
      where: { mediaAssetId: linkId },
      select: { id: true, productId: true, variantId: true },
    });
    for (const placement of placements) {
      const twin = await tx.variantImage.findFirst({
        where: {
          productId: placement.productId,
          variantId: placement.variantId,
          mediaAssetId: copyId,
        },
        select: { id: true },
      });
      if (twin !== null) {
        await tx.variantImage.delete({ where: { id: placement.id } });
      } else {
        await tx.variantImage.update({
          where: { id: placement.id },
          data: { mediaAssetId: copyId },
        });
      }
    }
    await tx.mediaAsset.update({ where: { id: linkId }, data: { deletedAt: new Date() } });
  });
}

/** Test hook: forget what this worker has already brought in. */
export function _forgetSeenImagesForTest(): void {
  seenThisRun.clear();
}

/** The sentence shown on a row whose image had to be linked rather than copied. */
export function linkedNotice(reason: string): string {
  return `Linked rather than copied, because ${reason}. It still shows on your site, but it is served from your old platform: replace it before you close that account.`;
}
