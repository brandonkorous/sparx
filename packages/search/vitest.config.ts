import { defineConfig } from 'vitest/config';

// The search round-trip suite talks to a real Typesense (no good in-memory
// fake exists for it). It self-skips when Typesense isn't reachable, so it
// runs locally after `pnpm db:up` and no-ops in CI without one. Network
// round-trips want a roomier timeout than the 5s default.
export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
