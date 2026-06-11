// Marketplace artifact store (docs/85 §6) — the compiled, declarative payloads
// (theme tokens / component node-tree / blueprint manifest / connector spec) live
// in object storage as `marketplace/<category>/<slug>/<version>.json`, NEVER in a
// SQL column. The catalog row is a thin index; this module is the only seam the
// runtime uses to read/write the heavy artifact.
//
// Artifacts are IMMUTABLE per version (the version is in the key), so reads are
// safe to cache in-process forever — a new version is a new key, never an
// overwrite. That immutability is also what makes the storage write safe without a
// two-phase commit: write the object, then the catalog row's `version` is flipped;
// a failed write leaves a harmless orphan, never a row pointing at a missing object.

import type { Readable } from 'node:stream';
import type { MarketplaceCategory } from '@sparx/marketplace-schemas';

import { getStorage, marketplaceArtifactKey } from '../storage.js';

// Parsed-artifact cache, keyed by the (immutable) storage key. Bounded only by the
// number of distinct published (category, slug, version) tuples ever read by this
// process — small, and every entry is permanently valid.
const cache = new Map<string, unknown>();

async function streamToString(body: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** True when the object body backend reports "not found" (local ENOENT / GCS 404),
 *  vs a real I/O error we must not swallow. */
function isNotFound(err: unknown): boolean {
  const code = (err as { code?: string | number })?.code;
  if (code === 'ENOENT' || code === 404) return true;
  // GCS throws ApiError with a numeric `code` of 404; some paths surface it on a
  // nested `.response.status`.
  const status = (err as { response?: { status?: number } })?.response?.status;
  return status === 404;
}

/**
 * Read + JSON-parse the artifact for `(category, slug, version)` from storage, or
 * `null` when no such object exists (e.g. a legacy code-resolved item whose payload
 * was never ingested). Cached in-process — the key is version-pinned, so the cached
 * value can never go stale.
 */
export async function readArtifact<T = unknown>(
  category: MarketplaceCategory,
  slug: string,
  version: string
): Promise<T | null> {
  const key = marketplaceArtifactKey(category, slug, version);
  if (cache.has(key)) return cache.get(key) as T;
  try {
    const { body } = await getStorage().readObject(key);
    const text = await streamToString(body);
    const parsed = JSON.parse(text) as T;
    cache.set(key, parsed);
    return parsed;
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

/** Does an artifact already exist at this exact version? Used by the ingest's
 *  no-clobber guard (docs/85 §10): a published version is never overwritten. */
export async function artifactExists(
  category: MarketplaceCategory,
  slug: string,
  version: string
): Promise<boolean> {
  if (cache.has(marketplaceArtifactKey(category, slug, version))) return true;
  try {
    await getStorage().readObject(marketplaceArtifactKey(category, slug, version));
    return true;
  } catch (err) {
    if (isNotFound(err)) return false;
    throw err;
  }
}

/**
 * Write the compiled artifact for `(category, slug, version)` to storage. Caller
 * is the ingest (docs/85 §5) — it has already validated `data` against the
 * category schema and enforced the version guard. Populates the read cache so a
 * subsequent same-process read is consistent.
 */
export async function writeArtifact(
  category: MarketplaceCategory,
  slug: string,
  version: string,
  data: unknown
): Promise<void> {
  const key = marketplaceArtifactKey(category, slug, version);
  const buf = Buffer.from(JSON.stringify(data), 'utf8');
  await getStorage().writeObject(key, 'application/json', buf);
  cache.set(key, data);
}

/** Test-only — drop the in-process artifact cache between suites. */
export function _resetArtifactCacheForTest(): void {
  cache.clear();
}
