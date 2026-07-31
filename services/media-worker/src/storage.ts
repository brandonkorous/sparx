// Object storage for the transcoder, in two backends. Mirrors the interface
// services/api-rest/src/lib/storage.ts uses so the two services stay coherent
// without sharing code (separate workspace, separate Pod, separate failure
// surface).
//
// WHICH BACKEND: `GCS_MEDIA_BUCKET` set → GCS; unset → local disk. That is the
// identical switch `packages/media` (`getStorage()`) and api-rest already make,
// and it is deliberately the only thing that decides. There is no MEDIA_BACKEND
// flag to get out of sync with the bucket names.
//
// The local backend is not a dev convenience — it is what the self-hosted
// deployments run on. media-worker WRITES variants to the same volume api-rest
// READS them from (k8s/azure/kustomization.yaml mounts one RWO PVC into both,
// and pins them to the same node). Point them at different directories and
// every image transcodes successfully and then 404s forever.

import { Storage } from '@google-cloud/storage';
import { promises as fs } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { env } from './env.js';

interface Backend {
  download(key: string): Promise<Buffer>;
  upload(key: string, contentType: string, body: Buffer): Promise<void>;
}

// Keys are always built by variantKey() or read off a MediaAsset row, so this
// should never fire. It is here because the local backend turns a key into a
// filesystem path, and the cost of being wrong about that is writing outside
// the media root.
function assertSafeKey(key: string): void {
  if (key.length === 0 || key.includes('..') || key.startsWith('/') || key.includes('\\')) {
    throw new Error(`Refusing unsafe storage key: ${JSON.stringify(key)}`);
  }
}

function gcsBackend(bucketName: string): Backend {
  // Constructed HERE rather than at module scope. At module scope this ran on
  // every import, including on a cluster with no Google credentials at all,
  // purely to be thrown away.
  //
  // On Cloud Run the client auto-detects the project from the ambient
  // GOOGLE_CLOUD_PROJECT; in tests/dev it picks up gcloud's
  // application-default credentials. No explicit projectId needed.
  const client = new Storage();
  // Private bucket — holds originals. Read-only from here; uploads come via
  // presigned URLs from the dashboard through api-rest.
  const originals = client.bucket(bucketName);
  // Public bucket — world-readable variants behind Cloudflare. Falls back to
  // the originals bucket when only one bucket name is configured (dev).
  const variants = client.bucket(env.GCS_MEDIA_PUBLIC_BUCKET || bucketName);

  return {
    async download(key) {
      const [buf] = await originals.file(key).download();
      return buf;
    },
    async upload(key, contentType, body) {
      const file = variants.file(key);
      await new Promise<void>((res, reject) => {
        const stream = file.createWriteStream({
          contentType,
          resumable: false,
          metadata: { cacheControl: 'public, max-age=31536000, immutable' },
        });
        stream.once('error', reject);
        stream.once('finish', res);
        Readable.from(body).pipe(stream);
      });
    },
  };
}

function localBackend(rootDir: string): Backend {
  const root = resolve(rootDir);
  return {
    async download(key) {
      assertSafeKey(key);
      return fs.readFile(join(root, key));
    },
    async upload(key, _contentType, body) {
      assertSafeKey(key);
      const path = join(root, key);
      // The originals directory exists (api-rest wrote into it), but a variants
      // directory is created by whichever transcode lands first.
      await fs.mkdir(dirname(path), { recursive: true });
      await fs.writeFile(path, body);
    },
  };
}

const backend: Backend = env.GCS_MEDIA_BUCKET
  ? gcsBackend(env.GCS_MEDIA_BUCKET)
  : localBackend(env.MEDIA_LOCAL_DIR);

export const storageMode: 'gcs' | 'local' = env.GCS_MEDIA_BUCKET ? 'gcs' : 'local';

export async function downloadObject(key: string): Promise<Buffer> {
  return backend.download(key);
}

export async function uploadVariant(key: string, contentType: string, body: Buffer): Promise<void> {
  return backend.upload(key, contentType, body);
}

export function variantKey(
  tenantId: string,
  assetId: string,
  format: string,
  width: number,
  ext: string,
  // A social crop aspect (docs/133 §8) — '1:1' | '4:5' | '9:16' | '16:9'. When set,
  // the colon is made filename-safe ('9:16' → '9x16') and folded into the key so a
  // crop never collides with the ordinary scale-to-width variant.
  aspect?: string
): string {
  // Mirror of api-rest's variantKey() so the asset detail endpoint can
  // re-derive any variant URL from (tenantId, assetId, format, width[, aspect]).
  const suffix = aspect ? `${format}-${aspect.replace(':', 'x')}-${width}` : `${format}-${width}`;
  return `${tenantId}/variants/${assetId}/${suffix}.${ext}`;
}
