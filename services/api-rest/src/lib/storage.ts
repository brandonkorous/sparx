// Media storage backends.
//
// Two implementations:
//
//   - GcsStorage (prod) — generates V4 signed PUT URLs against
//     `GCS_MEDIA_BUCKET`. The browser PUTs the bytes directly to GCS so
//     api-rest never streams large files. Object keys follow the per-tenant
//     prefix scheme documented in plan §3.2:
//       `${tenantId}/originals/${assetId}/${filename}`
//       `${tenantId}/variants/${assetId}/${format}-${width}.${ext}`
//
//   - LocalStorage (dev / test) — writes to `MEDIA_LOCAL_DIR` on the host
//     filesystem and returns a path-based "presigned" URL that points back
//     at api-rest's own /v1/media/_local/* endpoints. Lets the dashboard
//     exercise the full upload flow without a GCS service account.
//
// The pubsub `media.uploaded` event lands the same way in both modes —
// downstream workers (media-worker) read the asset row and pull from
// storage via `readObject(key)` rather than re-deriving the URL, so the
// abstraction is honest end-to-end.

import { Storage as GcsClient } from '@google-cloud/storage';
import { promises as fs, createReadStream, createWriteStream } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import { env } from '../env.js';

export interface PresignedPut {
  // URL the browser PUTs to. In GCS mode this is a V4 signed URL valid for
  // PUT_URL_TTL_SEC; in local mode this is a `/v1/media/_local/...` path.
  url: string;
  // Headers the caller must send with the PUT — content-type at minimum
  // (so GCS records it on the object).
  headers: Record<string, string>;
  // Object key — caller writes this back to the asset row so we can re-
  // derive variants later.
  key: string;
  // Expiry time (ISO) — only meaningful in GCS mode.
  expiresAt: string;
}

export interface ReadObject {
  body: Readable;
  contentType: string | null;
  size: number | null;
}

export interface MediaStorage {
  readonly mode: 'gcs' | 'local';
  // Generate a presigned PUT URL the browser can use to upload `key` with
  // the given content-type.
  presignPut(key: string, contentType: string, contentLength: number): Promise<PresignedPut>;
  // Pipe an existing object into a Readable so the transcoder worker can
  // process it without re-downloading via the public URL.
  readObject(key: string): Promise<ReadObject>;
  // Write a derived variant to storage. Returns the public URL (CDN in
  // prod, api-rest origin in dev) that callers can persist alongside the
  // MediaVariant row.
  writeObject(key: string, contentType: string, body: Buffer | Readable): Promise<{ url: string }>;
  // Best-effort delete. Used by soft-delete GC and bucket cleanup.
  deleteObject(key: string): Promise<void>;
  // Copy an object within the bucket (server-side; no bytes through the app in
  // GCS mode). Used by the form-attachment flow to promote an upload from the
  // lifecycle-GC'd `staging/` prefix to the permanent `attached/` prefix. Both
  // keys route to the same (private) bucket. Overwrites the destination.
  copyObject(srcKey: string, destKey: string): Promise<void>;
  // Recursively delete every object under `prefix`. Used by bulk cleanup — e.g.
  // purging the whole marketplace blueprint catalog (artifacts + media) across
  // ALL versions in one call, since artifacts are immutable-per-version and a
  // per-key delete would orphan older versions. Idempotent; a non-existent
  // prefix is a no-op. `prefix` must be non-empty (refuses to wipe the root).
  deletePrefix(prefix: string): Promise<void>;
  // Get the canonical public URL for a variant key. Constant-time in both
  // backends; no signing required because variants are world-readable.
  publicUrl(key: string): string;
  // Mint a short-lived signed READ url for a PRIVATE object (e.g. a résumé
  // original in the private bucket). Unlike publicUrl — which only works for
  // world-readable variant keys — this signs access to a private key so a
  // recipient (e.g. the careers notification email) can open it without a
  // logged-in session. GCS caps signed-URL lifetime at 7 days.
  presignGet(key: string, ttlSeconds?: number): Promise<string>;
}

const PUT_URL_TTL_SEC = 15 * 60;
// Default signed-read lifetime — 7 days, the GCS V4 maximum. Long enough that a
// careers notification email's résumé link stays live for the review window.
const GET_URL_TTL_SEC = 7 * 24 * 60 * 60;

// ────────────────────────────────────────────────────────────────────────
// GCS backend
// ────────────────────────────────────────────────────────────────────────

class GcsStorage implements MediaStorage {
  readonly mode = 'gcs' as const;
  private readonly client: GcsClient;
  // Private bucket — originals + any tenant-sensitive object. Reads via
  // service-account auth or short-lived signed URLs.
  private readonly privateBucketName: string;
  // Public bucket — derived variants only. World-readable; storefronts
  // <img src> against the publicBase, fronted by Cloudflare.
  private readonly publicBucketName: string;
  private readonly publicBase: string;

  constructor(privateBucketName: string, publicBucketName: string, publicBase: string) {
    this.client = new GcsClient(env.GCP_PROJECT_ID ? { projectId: env.GCP_PROJECT_ID } : {});
    this.privateBucketName = privateBucketName;
    this.publicBucketName = publicBucketName;
    // Variants are served via api-rest's GET /v1/public/media/variants/:key
    // route (see routes/v1/public/media.ts) because the org-level DRS
    // policy forbids allUsers on GCS. `publicBase` is the externally-
    // reachable api-rest origin (https://api.sparx.works); empty means
    // same-origin (relative URLs — used in dev).
    this.publicBase = publicBase;
  }

  // Variants live on the public bucket; originals + anything else go to the
  // private one. Object keys follow the `<tenantId>/{originals,variants}/...`
  // convention from variantKey()/originalKey() below, so a substring check
  // is sufficient and avoids per-call argument plumbing.
  private isPublicKey(key: string): boolean {
    return key.includes('/variants/');
  }

  private file(key: string) {
    const bucketName = this.isPublicKey(key) ? this.publicBucketName : this.privateBucketName;
    return this.client.bucket(bucketName).file(key);
  }

  async presignPut(key: string, contentType: string): Promise<PresignedPut> {
    const expires = Date.now() + PUT_URL_TTL_SEC * 1000;
    const [url] = await this.file(key).getSignedUrl({
      version: 'v4',
      action: 'write',
      expires,
      contentType,
    });
    return {
      url,
      headers: { 'content-type': contentType },
      key,
      expiresAt: new Date(expires).toISOString(),
    };
  }

  async readObject(key: string): Promise<ReadObject> {
    const file = this.file(key);
    const [meta] = await file.getMetadata();
    return {
      body: file.createReadStream(),
      contentType: typeof meta.contentType === 'string' ? meta.contentType : null,
      size: typeof meta.size === 'number' ? meta.size : meta.size ? Number(meta.size) : null,
    };
  }

  async writeObject(key: string, contentType: string, body: Buffer | Readable) {
    const isPublic = this.isPublicKey(key);
    const file = this.file(key);
    const stream = file.createWriteStream({
      contentType,
      resumable: false,
      // Variants are world-readable behind CDN — see the bucket TF for the
      // ACL/IAM that makes this work without a per-object publicRead grant.
      // Private objects (marketplace artifacts, originals) are mutable-by-
      // version, so no immutable cache directive on those.
      metadata: isPublic
        ? { cacheControl: 'public, max-age=31536000, immutable' }
        : { cacheControl: 'private, no-store' },
    });
    if (Buffer.isBuffer(body)) {
      await new Promise<void>((resolveStream, reject) => {
        stream.once('error', reject);
        stream.once('finish', resolveStream);
        stream.end(body);
      });
    } else {
      await pipeline(body, stream);
    }
    // Public (variant) keys get a stable CDN URL; private keys (artifacts,
    // originals) have none — callers read them back via readObject(key).
    return { url: isPublic ? this.publicUrl(key) : '' };
  }

  async deleteObject(key: string): Promise<void> {
    await this.file(key)
      .delete({ ignoreNotFound: true })
      .catch(() => {
        // Already-gone is fine; storage backends should be idempotent.
      });
  }

  async copyObject(srcKey: string, destKey: string): Promise<void> {
    // Server-side copy — GCS moves the bytes bucket-internally; the app never
    // streams them. src + dest share the private bucket (both non-variant keys).
    await this.file(srcKey).copy(this.file(destKey));
  }

  async deletePrefix(prefix: string): Promise<void> {
    assertNonRootPrefix(prefix);
    // Route to the same bucket the keys live on: marketplace artifacts/media are
    // private (no `/variants/` segment); variant prefixes hit the public bucket.
    const bucketName = this.isPublicKey(prefix) ? this.publicBucketName : this.privateBucketName;
    await this.client.bucket(bucketName).deleteFiles({ prefix, force: true });
  }

  publicUrl(key: string): string {
    // Only variants have a stable public URL. Originals are private —
    // callers asking for one are using the wrong path; route via a signed
    // GET instead.
    if (!this.isPublicKey(key)) {
      throw new Error(
        `Refusing to mint a public URL for a private-bucket key: ${JSON.stringify(key)}`
      );
    }
    // Public URL path matches routes/v1/public/media.ts:
    //   <tenantId>/variants/<assetId>/<filename> →
    //   <base>/v1/public/media/variants/<tenantId>/<assetId>/<filename>
    // Splitting on `/variants/` lets us preserve the original key shape
    // without re-encoding the segments (they're already URL-safe — the
    // worker only emits `[a-z]+-\d+\.[a-z0-9]+` filenames).
    return `${this.publicBase}/v1/public/media/variants/${key}`;
  }

  async presignGet(key: string, ttlSeconds = GET_URL_TTL_SEC): Promise<string> {
    const expires = Date.now() + ttlSeconds * 1000;
    const [url] = await this.file(key).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires,
    });
    return url;
  }
}

// ────────────────────────────────────────────────────────────────────────
// Local filesystem backend
// ────────────────────────────────────────────────────────────────────────

// Local mode rejects keys that try to escape the storage root. The check is
// belt-and-braces because the API never *forwards* user-controlled keys
// directly — they're constructed from `${tenantId}/...` inside our routes —
// but if that invariant ever slipped we'd rather 400 here than write to a
// neighbouring directory.
function assertSafeKey(key: string): void {
  if (key.length === 0 || key.includes('..') || key.startsWith('/') || key.includes('\\')) {
    throw new Error(`Refusing unsafe storage key: ${JSON.stringify(key)}`);
  }
}

// A recursive delete is a footgun: an empty / root prefix would wipe a whole
// bucket. Require a non-trivial prefix that descends at least one directory
// (`a/b…`) before any backend deletes by it. Used by deletePrefix in both modes.
function assertNonRootPrefix(prefix: string): void {
  const trimmed = prefix.trim();
  if (trimmed.length === 0 || trimmed === '/' || !trimmed.replace(/\/+$/, '').includes('/')) {
    throw new Error(`Refusing to delete by a root/too-broad prefix: ${JSON.stringify(prefix)}`);
  }
}

class LocalStorage implements MediaStorage {
  readonly mode = 'local' as const;
  private readonly root: string;
  private readonly publicBase: string;

  constructor(root: string, publicBase: string) {
    this.root = resolve(root);
    this.publicBase = publicBase;
  }

  private path(key: string): string {
    assertSafeKey(key);
    return join(this.root, key);
  }

  // The local "presigned PUT" is a private api-rest endpoint that accepts
  // raw bytes and persists them under `MEDIA_LOCAL_DIR`. The endpoint
  // verifies the signed key claim so a malicious caller can't spray bytes
  // into arbitrary tenant prefixes.
  //
  // The URL is RELATIVE and carries the key as real path segments (the route
  // is a wildcard, see routes/v1/media/uploads.ts). Relative so the browser
  // PUTs same-origin: in dev the dashboard proxies `/v1/media/_local/*` to
  // api-rest (next.config rewrite) — no cross-origin, no CORS. Real segments
  // (not a single encodeURIComponent blob) so the proxy never has to round-trip
  // an encoded `%2F`, which path normalisers mangle.
  presignPut(key: string, contentType: string): Promise<PresignedPut> {
    assertSafeKey(key);
    const expires = Date.now() + PUT_URL_TTL_SEC * 1000;
    return Promise.resolve({
      url: `/v1/media/_local/${key}`,
      headers: { 'content-type': contentType },
      key,
      expiresAt: new Date(expires).toISOString(),
    });
  }

  async readObject(key: string): Promise<ReadObject> {
    const path = this.path(key);
    const stat = await fs.stat(path);
    return {
      body: createReadStream(path),
      contentType: null, // Caller round-trips through MediaAsset.mimeType
      size: stat.size,
    };
  }

  async writeObject(key: string, _contentType: string, body: Buffer | Readable) {
    const path = this.path(key);
    await fs.mkdir(dirname(path), { recursive: true });
    if (Buffer.isBuffer(body)) {
      await fs.writeFile(path, body);
    } else {
      await pipeline(body, createWriteStream(path));
    }
    return { url: this.publicUrl(key) };
  }

  async deleteObject(key: string): Promise<void> {
    await fs.rm(this.path(key), { force: true });
  }

  async copyObject(srcKey: string, destKey: string): Promise<void> {
    const dest = this.path(destKey);
    await fs.mkdir(dirname(dest), { recursive: true });
    await fs.copyFile(this.path(srcKey), dest);
  }

  async deletePrefix(prefix: string): Promise<void> {
    assertNonRootPrefix(prefix);
    assertSafeKey(prefix);
    // Recursive rm of the on-disk directory the prefix maps to. `force` makes a
    // missing dir a no-op (idempotent).
    await fs.rm(join(this.root, prefix), { recursive: true, force: true });
  }

  publicUrl(key: string): string {
    const base = this.publicBase || '';
    // Real path segments (not a single encodeURIComponent blob): the file route
    // is a wildcard, and find-my-way decodes `%2F` before routing over real
    // HTTP, so an encoded key never matches a multi-segment path (it 404s as
    // JSON, which the browser then ORB-blocks when used as an <img>).
    return `${base}/v1/public/media/file/${key}`;
  }

  presignGet(key: string, _ttlSeconds?: number): Promise<string> {
    assertSafeKey(key);
    // Local mode serves every object (including private originals) through the
    // dev-only file route, so no signing is needed on a developer's machine —
    // the same URL publicUrl() builds is directly fetchable.
    return Promise.resolve(this.publicUrl(key));
  }
}

// ────────────────────────────────────────────────────────────────────────
// Module-level singleton
// ────────────────────────────────────────────────────────────────────────

let cached: MediaStorage | null = null;

export function getStorage(): MediaStorage {
  if (cached) return cached;
  if (env.GCS_MEDIA_BUCKET) {
    cached = new GcsStorage(
      env.GCS_MEDIA_BUCKET,
      env.GCS_MEDIA_PUBLIC_BUCKET,
      env.MEDIA_PUBLIC_URL
    );
  } else {
    cached = new LocalStorage(env.MEDIA_LOCAL_DIR, env.MEDIA_PUBLIC_URL);
  }
  return cached;
}

// Test-only — let the integration tests swap in a mock or reset between
// suites. Not exported in production code paths.
export function _resetStorageForTest(): void {
  cached = null;
}

// Object-key helpers — keep the layout in one place so changing it later
// is a single-file edit.

export function originalKey(tenantId: string, assetId: string, filename: string): string {
  // Filename in the key is informational only (helps GCS console + CLI
  // recognise the file). The route layer slugifies it to ASCII so the GCS
  // key stays URL-safe.
  return `${tenantId}/originals/${assetId}/${safeFilename(filename)}`;
}

export function variantKey(
  tenantId: string,
  assetId: string,
  format: string,
  width: number,
  ext: string
): string {
  return `${tenantId}/variants/${assetId}/${format}-${width}.${ext}`;
}

// Marketplace storage prefixes (docs/85 §6) — the parent "directories" the keys
// below descend from. The single source of truth for the marketplace object layout,
// so a bulk cleanup (deletePrefix) and the per-object keys can never drift.
export function marketplaceArtifactPrefix(category: string): string {
  return `marketplace/${category}/`;
}
export function marketplaceMediaPrefix(category: string): string {
  return `marketplace/media/${category}/`;
}

// Marketplace artifact key (docs/85 §6). Private object — the compiled,
// immutable-per-version declarative artifact (theme tokens / component tree /
// blueprint manifest / connector spec). No `/variants/` segment, so it lands on
// the private bucket and is read back via readObject(), never a public URL.
export function marketplaceArtifactKey(category: string, slug: string, version: string): string {
  return `${marketplaceArtifactPrefix(category)}${slug}/${version}.json`;
}

// Marketplace media key (docs/85 §6) — the catalog card imagery (icon.png,
// preview.png, screenshots). Lands on the private bucket (no `/variants/`) and is
// served, world-readable, by GET /v1/public/marketplace/media/* (api-rest pipes
// the bytes — the org forbids allUsers on the bucket; Cloudflare absorbs repeats).
export function marketplaceMediaKey(category: string, slug: string, filename: string): string {
  return `${marketplaceMediaPrefix(category)}${slug}/${filename}`;
}

// The browser-reachable URL for a marketplace media object. Absolute in prod
// (MEDIA_PUBLIC_URL = the api public origin, fronted by Cloudflare); relative in
// dev (empty base) — the bytes are still served by the route below.
export function marketplaceMediaUrl(category: string, slug: string, filename: string): string {
  const base = env.MEDIA_PUBLIC_URL || '';
  return `${base}/v1/public/marketplace/media/${category}/${slug}/${filename}`;
}

// Careers résumé key (docs/…) — the applicant's uploaded PDF. No `/variants/`
// segment, so it lands on the PRIVATE bucket (never world-readable) and is read
// back via a short-lived presignGet() signed URL, never publicUrl(). Scoped
// under the (platform) tenant like every other object, then by application id.
export function careersResumeKey(
  tenantId: string,
  applicationId: string,
  filename: string
): string {
  return `${tenantId}/careers/resumes/${applicationId}/${safeFilename(filename)}`;
}

// ── Site-form attachments (docs/115 Part D) ─────────────────────────────────
//
// A visitor-uploaded file lands in a STAGING prefix first, then is promoted to a
// permanent ATTACHED prefix once the form is actually submitted. Both are private
// (no `/variants/` segment → private bucket). The lifecycle discriminator
// (`staging`/`attached`) is the FIRST key segment — before the tenant id — so a
// single GCS lifecycle rule (`matchesPrefix: ["form-uploads/staging/"]`) can
// auto-delete abandoned uploads across ALL tenants without touching attached
// files. The uploaded-but-never-submitted object is thus GC'd for free; a
// submitted one is moved out of staging's reach (copyObject + deleteObject).

/** The lifecycle-GC'd staging prefix — matched by the bucket lifecycle rule. */
export const FORM_UPLOAD_STAGING_PREFIX = 'form-uploads/staging/';

/** Staging key for a fresh, not-yet-submitted attachment (server-minted uid). */
export function formUploadStagingKey(tenantId: string, uploadId: string, filename: string): string {
  return `${FORM_UPLOAD_STAGING_PREFIX}${tenantId}/${uploadId}/${safeFilename(filename)}`;
}

/** Permanent key an attachment is promoted to at submit — outside staging's
 *  lifecycle reach. Keyed by the same uid so the move is a deterministic rename. */
export function formUploadAttachedKey(
  tenantId: string,
  uploadId: string,
  filename: string
): string {
  return `form-uploads/attached/${tenantId}/${uploadId}/${safeFilename(filename)}`;
}

/** Public re-export so route handlers sanitize a filename the same way the key
 *  helpers do (belt-and-braces before it reaches a Content-Disposition header). */
export function sanitizeFilename(name: string): string {
  return safeFilename(name);
}

function safeFilename(name: string): string {
  // Strip path traversal and non-printable bytes; collapse whitespace.
  const base = name.split(/[\\/]/).pop() ?? 'file';
  return base.replace(/[^\w.-]+/g, '_').slice(0, 200) || 'file';
}
