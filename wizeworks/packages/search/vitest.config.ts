import crypto from 'node:crypto';

import { defineConfig } from 'vitest/config';

// The search round-trip suite talks to a real Typesense (no good in-memory fake
// exists for it). It must never touch a real collection on that instance, so
// every run gets its own collection prefix, `test_<random>_`, and the package's
// one naming mechanism (TYPESENSE_COLLECTION_PREFIX, read by
// src/schemas/naming.ts) puts it in front of every collection the code reads,
// writes or drops. The suite creates `test_<run>_products` and friends, fills
// them, and drops them again in its teardown. A developer's `products`,
// `customers`, `orders` and `entities` collections are never named, so they are
// never touched.
//
// The backstop: the drop helpers refuse any collection without a test prefix,
// loudly, before anything is gone. On 2026-10-04 a run without this isolation
// dropped every collection on a developer's local Typesense.
//
// The suite still self-skips when Typesense is unreachable and under `CI=true`
// (the pre-push hook sets it): CI has no Typesense, and the hook must never be
// stricter than CI. Network round-trips want a roomier timeout than 5s.
const RUN_PREFIX = `test_${crypto.randomBytes(4).toString('hex')}_`;

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 20_000,
    hookTimeout: 20_000,
    env: { TYPESENSE_COLLECTION_PREFIX: RUN_PREFIX },
  },
});
