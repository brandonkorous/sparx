import { defineConfig } from 'vitest/config';

// The search round-trip suite talks to a real Typesense (no good in-memory
// fake exists for it), and it DROPS EVERY COLLECTION on that instance before it
// starts — every tenant's documents, not just its own two fixtures, because
// collection names are fixed constants with no per-run namespace. It therefore
// self-skips both when Typesense is unreachable AND under `CI=true`, which the
// pre-push hook sets: otherwise a push emptied the pusher's own search index in
// silence. Run it deliberately, and reindex afterwards. Network round-trips
// want a roomier timeout than the 5s default.
export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
