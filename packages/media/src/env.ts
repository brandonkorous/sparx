// Storage config, read straight from process.env.
//
// This package is imported by api-mcp (and any other headless caller), which
// hydrates the SAME sparx-app-env / sparx-app-secrets as api-rest — so the GCS
// bucket names + public base are already present in the pod. We read them here
// rather than depend on a host service's validated `env`, so the package stays
// transport-agnostic (no @sparx/api-core, no Fastify).
//
// Unset GCS_MEDIA_BUCKET → the local-disk backend (dev/test), matching
// api-rest's storage.ts and media-worker's storage.ts (this is a third focused
// copy of the same layout — see storage.ts header).

import { z } from 'zod';

const StorageEnvSchema = z.object({
  // Private bucket — holds originals. Unset → LocalStorage (dev/test).
  GCS_MEDIA_BUCKET: z.string().optional(),
  // Public bucket — world-readable variants behind the CDN. Falls back to the
  // private bucket name when only one is configured.
  GCS_MEDIA_PUBLIC_BUCKET: z.string().optional(),
  // Azure Blob — the live backend, selected ahead of GCS and local disk. Both halves are
  // required together; one alone falls through, which would silently write a headless
  // caller's uploads to container-local disk that nothing serves.
  AZURE_STORAGE_ACCOUNT: z.string().optional(),
  AZURE_STORAGE_KEY: z.string().optional(),
  AZURE_MEDIA_CONTAINER: z.string().default('media'),
  AZURE_MEDIA_PUBLIC_CONTAINER: z.string().default('media-public'),
  // Externally-reachable api origin that serves /v1/public/media/* (empty →
  // same-origin relative URLs, used in dev).
  MEDIA_PUBLIC_URL: z.string().default(''),
  // Local backend root (dev/test only).
  MEDIA_LOCAL_DIR: z.string().default('.media-local'),
});

export type StorageEnv = z.infer<typeof StorageEnvSchema>;

let cached: StorageEnv | null = null;

export function storageEnv(): StorageEnv {
  if (cached) return cached;
  // Lenient parse: a missing optional simply falls back. A malformed value is
  // impossible here (all strings), so we never fail a headless caller's boot.
  cached = StorageEnvSchema.parse(process.env);
  return cached;
}

// Test hook — clears the memoised config between suites (e.g. after mutating
// process.env to exercise the gcs-vs-local branch).
export function _resetStorageEnvForTest(): void {
  cached = null;
}
