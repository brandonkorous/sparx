#!/usr/bin/env tsx
// Copy the media PVC into Azure Blob storage.
//
//   pnpm --filter @wizeworks/api-rest ops:migrate-media-to-blob            # dry run
//   pnpm --filter @wizeworks/api-rest ops:migrate-media-to-blob -- --apply
//
// ── WHY THIS EXISTS ───────────────────────────────────────────────────────────
// Media used to live in GCS. When GCP was retired `GCS_MEDIA_BUCKET` went with it and
// every `getStorage()` — api-rest, media-worker, wizeworks/packages/media — fell through to its
// LAST branch, LocalStorage: the backend written for a laptop. Production media has been
// living on one ReadWriteOnce Azure Disk ever since, which is why api-rest and
// media-worker are pinned to the same node (a RWO volume mounts on exactly one).
//
// The Azure Blob backend replaces it. Every object key is unchanged — the containers
// mirror the GCS private/public split the keys already encode — so nothing that stores
// or resolves a key needs to change. What DOES need to happen is moving the bytes that
// are already on the disk, because the moment `AZURE_STORAGE_ACCOUNT` is set, every
// lookup goes to Blob and anything still only on the PVC is a 404.
//
// ── RUN IT BEFORE THE CUTOVER, NOT AFTER ──────────────────────────────────────
// This is safe to run while api-rest is still serving from the PVC: it only READS the
// disk and WRITES to Blob. Nothing is deleted. The intended sequence is
//
//   1. deploy the code with AZURE_STORAGE_* unset  → behaviour unchanged, still on disk
//   2. run this with --apply                       → bytes land in Blob, disk untouched
//   3. set AZURE_STORAGE_ACCOUNT + AZURE_STORAGE_KEY → reads and writes flip to Blob
//
// Run it again after step 3 to sweep up anything uploaded during the window; it skips
// blobs that already exist, so a second pass is cheap and idempotent.
//
// Keep the PVC around until you have verified images render. It is the only copy of
// anything this misses, and deleting it is not something to do on the same day.

import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { createReadStream, promises as fs } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const apply = process.argv.includes('--apply');

/** Both halves or nothing — a half-configured run would connect to no account at all.
 *  Narrowed inside a function so the credentials are non-optional everywhere below. */
function requireAzure(): { account: string; key: string } {
  const account = process.env.AZURE_STORAGE_ACCOUNT;
  const key = process.env.AZURE_STORAGE_KEY;
  if (!account || !key) {
    console.error(
      'AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_KEY must both be set — this task writes to Blob.'
    );
    process.exit(78); // EX_CONFIG
  }
  return { account, key };
}

const { account, key } = requireAzure();
const root = resolve(process.env.MEDIA_LOCAL_DIR ?? '/media');
const privateContainer = process.env.AZURE_MEDIA_CONTAINER ?? 'media';
const publicContainer = process.env.AZURE_MEDIA_PUBLIC_CONTAINER ?? 'media-public';

/** The same routing rule the storage backends use: a key with a `/variants/` segment is
 *  a derived variant and belongs in the public container; everything else is an original
 *  or a tenant-sensitive object and stays private. */
function containerFor(key: string): string {
  return key.includes('/variants/') ? publicContainer : privateContainer;
}

/** Content type by extension. The PVC keeps no metadata, and a blob served without a
 *  type is downloaded rather than rendered — so guessing here is not optional. */
function contentTypeFor(key: string): string {
  const ext = key.slice(key.lastIndexOf('.') + 1).toLowerCase();
  const known: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    avif: 'image/avif',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    pdf: 'application/pdf',
  };
  return known[ext] ?? 'application/octet-stream';
}

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

async function main(): Promise<void> {
  const service = new BlobServiceClient(
    `https://${account}.blob.core.windows.net`,
    new StorageSharedKeyCredential(account, key)
  );
  const containers = new Map(
    [privateContainer, publicContainer].map((n) => [n, service.getContainerClient(n)])
  );

  let seen = 0;
  let copied = 0;
  let skipped = 0;
  let failed = 0;
  let bytes = 0;

  try {
    await fs.access(root);
  } catch {
    console.error(`No media directory at ${root}. Is the PVC mounted?`);
    process.exit(1);
  }

  for await (const path of walk(root)) {
    // Object keys are POSIX-style and relative to the media root — the same strings the
    // MediaAsset/MediaVariant rows hold, so they must not pick up a platform separator.
    const objectKey = relative(root, path).split(sep).join('/');
    seen += 1;

    const container = containers.get(containerFor(objectKey));
    if (!container) continue;
    const blob = container.getBlockBlobClient(objectKey);

    try {
      if (await blob.exists()) {
        skipped += 1;
        continue;
      }
      const stat = await fs.stat(path);
      if (!apply) {
        console.log(`would copy  ${objectKey}  →  ${containerFor(objectKey)}  (${stat.size} B)`);
        copied += 1;
        bytes += stat.size;
        continue;
      }
      const isPublic = containerFor(objectKey) === publicContainer;
      await blob.uploadStream(createReadStream(path), undefined, undefined, {
        blobHTTPHeaders: {
          blobContentType: contentTypeFor(objectKey),
          blobCacheControl: isPublic ? 'public, max-age=31536000, immutable' : 'private, no-store',
        },
      });
      copied += 1;
      bytes += stat.size;
      if (copied % 100 === 0) console.log(`… ${copied} copied`);
    } catch (err) {
      failed += 1;
      console.error(`FAILED ${objectKey}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const mib = (bytes / 1024 / 1024).toFixed(1);
  console.log(
    `\n${apply ? 'Copied' : 'Would copy'} ${copied} object(s) (${mib} MiB) — ` +
      `${skipped} already present, ${failed} failed, ${seen} seen.`
  );
  if (!apply) console.log('Dry run. Re-run with --apply to write.');
  // A partial copy is worse than an obvious failure: the cutover would silently lose
  // exactly the objects that failed.
  if (failed > 0) process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
