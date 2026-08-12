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

import { withTenant } from '@sparx/db';
import {
  ALLOWED_IMAGE_MIME,
  MAX_UPLOAD_IMAGE_BYTES,
  createImageAssetFromBytes,
  createImageAssetFromUrl,
  type MediaWriteContext,
} from '@sparx/media';

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
    if (declared > MAX_UPLOAD_IMAGE_BYTES) {
      return { failure: `it is ${Math.round(declared / 1024)} KB, past our upload limit` };
    }

    const mimeType = mimeFor(filename, response.headers.get('content-type'));
    if (mimeType === undefined) return { failure: 'we could not tell what kind of image it is' };

    const data = Buffer.from(await response.arrayBuffer());
    if (data.length === 0) return { failure: 'the file came back empty' };
    if (data.length > MAX_UPLOAD_IMAGE_BYTES) {
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

/**
 * Fetch and store one image, or reuse it if this URL has come across already.
 *
 * De-duplication is by the ORIGINAL url, which every path records: the reference
 * path stores it as the asset key, and the copied path stores it in metadata via the
 * lookup below. Without it a catalogue whose 40 products share one brand banner would
 * import that banner 40 times.
 */
export async function ingestImage(
  ctx: ProcessorContext,
  url: string,
  options: { filename?: string; alt?: string } = {}
): Promise<IngestedImage> {
  const filename = filenameFromUrl(url, options.filename);

  const existing = await withTenant(ctx, (tx) =>
    tx.mediaAsset.findFirst({
      where: {
        tenantId: ctx.tenantId,
        deletedAt: null,
        OR: [{ key: url }, { originalFilename: filename }],
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })
  );
  if (existing !== null) return { assetId: existing.id, copied: true, reused: true };

  const write = mediaContext(ctx);
  const fetched = await fetchImage(url, filename);

  if ('failure' in fetched) {
    const created = await createImageAssetFromUrl(write, {
      url,
      filename,
      ...(options.alt !== undefined && options.alt !== '' ? { alt: options.alt } : {}),
    });
    return { assetId: created.assetId, copied: false, reason: fetched.failure, reused: false };
  }

  const created = await createImageAssetFromBytes(write, {
    data: fetched.data,
    mimeType: fetched.mimeType,
    filename,
    ...(options.alt !== undefined && options.alt !== '' ? { alt: options.alt } : {}),
  });
  return { assetId: created.assetId, copied: true, reused: false };
}

/** The sentence shown on a row whose image had to be linked rather than copied. */
export function linkedNotice(reason: string): string {
  return `Linked rather than copied, because ${reason}. It still shows on your site, but it is served from your old platform — replace it before you close that account.`;
}
