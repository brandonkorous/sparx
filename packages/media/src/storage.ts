// Focused media storage backend for HEADLESS uploaders (the MCP image tools).
//
// This is a deliberately SMALL third copy of the object-storage layout that
// already lives in two places — services/api-rest/src/lib/storage.ts (the
// browser presigned-PUT flow) and services/media-worker/src/storage.ts (the
// transcoder). Copying rather than sharing keeps those live services untouched
// (the same reason media-worker keeps its own mirror), and this copy carries
// ONLY what a server-side uploader needs: write an original + know its dev URL.
// Keep the object-key scheme identical to the other two so the worker + public
// resolver find what we write:
//   originals →  `${tenantId}/originals/${assetId}/${filename}`   (private bucket)
//
// Prod (GCS_MEDIA_BUCKET set) writes the original to the PRIVATE bucket; the
// `media.uploaded` event then drives media-worker to produce the public
// variants. Dev (unset) writes under MEDIA_LOCAL_DIR and hands back the
// api-rest file route the resolver already serves.

import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { Storage as GcsClient } from '@google-cloud/storage';
import { promises as fs } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { storageEnv } from './env.js';

export interface MediaStorage {
  readonly mode: 'gcs' | 'azure' | 'local';
  /** Whether a media-worker produces variants for objects written here — true for any
   *  object store, false for local disk. Callers deciding whether a new asset is `ready`
   *  or still `uploading` must ask THIS, not the vendor name. */
  readonly transcodes: boolean;
  // Write raw bytes to `key`. Returns the public URL for a variant key; empty
  // for a private original (the resolver derives its URL from the asset id).
  writeObject(key: string, contentType: string, body: Buffer): Promise<{ url: string }>;
  // Canonical public URL for a key (only meaningful for the local backend +
  // variant keys — originals in GCS are private).
  publicUrl(key: string): string;
}

function isPublicKey(key: string): boolean {
  return key.includes('/variants/');
}

class AzureBlobStorage implements MediaStorage {
  readonly mode = 'azure' as const;
  readonly transcodes = true;
  private readonly service: BlobServiceClient;
  constructor(
    account: string,
    key: string,
    private readonly privateContainer: string,
    private readonly publicContainer: string,
    private readonly publicBase: string
  ) {
    this.service = new BlobServiceClient(
      `https://${account}.blob.core.windows.net`,
      new StorageSharedKeyCredential(account, key)
    );
  }

  async writeObject(key: string, contentType: string, body: Buffer): Promise<{ url: string }> {
    const isPublic = isPublicKey(key);
    const container = this.service.getContainerClient(
      isPublic ? this.publicContainer : this.privateContainer
    );
    await container.getBlockBlobClient(key).upload(body, body.byteLength, {
      blobHTTPHeaders: {
        blobContentType: contentType,
        blobCacheControl: isPublic ? 'public, max-age=31536000, immutable' : 'private, no-store',
      },
    });
    return { url: isPublic ? this.publicUrl(key) : '' };
  }

  publicUrl(key: string): string {
    return `${this.publicBase}/v1/public/media/variants/${key}`;
  }
}

class GcsStorage implements MediaStorage {
  readonly mode = 'gcs' as const;
  readonly transcodes = true;
  private readonly client: GcsClient;
  constructor(
    private readonly privateBucket: string,
    private readonly publicBucket: string,
    private readonly publicBase: string
  ) {
    this.client = new GcsClient();
  }

  async writeObject(key: string, contentType: string, body: Buffer): Promise<{ url: string }> {
    const isPublic = isPublicKey(key);
    const bucket = isPublic ? this.publicBucket : this.privateBucket;
    const file = this.client.bucket(bucket).file(key);
    // createWriteStream + end(buffer) — the same call api-rest + media-worker use
    // (proven against this SDK version), rather than the `.save()` convenience.
    await new Promise<void>((res, reject) => {
      const stream = file.createWriteStream({
        contentType,
        resumable: false,
        metadata: {
          cacheControl: isPublic ? 'public, max-age=31536000, immutable' : 'private, no-store',
        },
      });
      stream.once('error', reject);
      stream.once('finish', res);
      stream.end(body);
    });
    return { url: isPublic ? this.publicUrl(key) : '' };
  }

  publicUrl(key: string): string {
    // Matches routes/v1/public/media.ts: only variants have a stable public URL.
    return `${this.publicBase}/v1/public/media/variants/${key}`;
  }
}

// Rejects a key that tries to escape the storage root. Belt-and-braces — keys
// are always constructed from `${tenantId}/...` inside this package — but a
// slipped invariant should 400, never write to a neighbouring directory.
function assertSafeKey(key: string): void {
  if (key.length === 0 || key.includes('..') || key.startsWith('/') || key.includes('\\')) {
    throw new Error(`Refusing unsafe storage key: ${JSON.stringify(key)}`);
  }
}

class LocalStorage implements MediaStorage {
  readonly mode = 'local' as const;
  readonly transcodes = false;
  private readonly root: string;
  constructor(
    root: string,
    private readonly publicBase: string
  ) {
    this.root = resolve(root);
  }

  async writeObject(key: string, _contentType: string, body: Buffer): Promise<{ url: string }> {
    assertSafeKey(key);
    const path = join(this.root, key);
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(path, body);
    return { url: this.publicUrl(key) };
  }

  publicUrl(key: string): string {
    assertSafeKey(key);
    // Real path segments (not one encodeURIComponent blob) — find-my-way decodes
    // `%2F`, so an encoded multi-segment key never matches the wildcard route.
    return `${this.publicBase || ''}/v1/public/media/file/${key}`;
  }
}

let cached: MediaStorage | null = null;

export function getStorage(): MediaStorage {
  if (cached) return cached;
  const env = storageEnv();
  // Azure → GCS → local disk. Same precedence as api-rest and media-worker; all three
  // must agree, since they read and write the same objects.
  if (env.AZURE_STORAGE_ACCOUNT && env.AZURE_STORAGE_KEY) {
    cached = new AzureBlobStorage(
      env.AZURE_STORAGE_ACCOUNT,
      env.AZURE_STORAGE_KEY,
      env.AZURE_MEDIA_CONTAINER,
      env.AZURE_MEDIA_PUBLIC_CONTAINER,
      env.MEDIA_PUBLIC_URL
    );
  } else if (env.GCS_MEDIA_BUCKET) {
    cached = new GcsStorage(
      env.GCS_MEDIA_BUCKET,
      env.GCS_MEDIA_PUBLIC_BUCKET ?? env.GCS_MEDIA_BUCKET,
      env.MEDIA_PUBLIC_URL
    );
  } else {
    cached = new LocalStorage(env.MEDIA_LOCAL_DIR, env.MEDIA_PUBLIC_URL);
  }
  return cached;
}

// Test hook — swap in a mock or reset between suites.
export function _setStorageForTest(storage: MediaStorage | null): void {
  cached = storage;
}

// Object-key helper — kept identical to api-rest + media-worker so the worker
// and the public resolver find what we write.
export function originalKey(tenantId: string, assetId: string, filename: string): string {
  return `${tenantId}/originals/${assetId}/${safeFilename(filename)}`;
}

export function safeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  return base.replace(/[^\w.-]+/g, '_').slice(0, 200) || 'file';
}
