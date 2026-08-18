import { configDefaults, defineConfig } from 'vitest/config';

// The processors talk to the domain services, which talk to Postgres — so the
// end-to-end suite under test/integration needs a live database with migrations
// applied. CI has none (GH Actions sets CI=true), so it is skipped there, exactly
// as api-rest does it. Locally `pnpm test` runs it against the docker-compose
// Postgres from `pnpm db:up`.
//
// The unit suite beside src/ has no such need and always runs.
const IS_CI = process.env.CI === 'true' || process.env.CI === '1';

export default defineConfig({
  test: {
    environment: 'node',
    // The end-to-end walkthrough writes real rows for one tenant and reads them
    // back; running files in parallel against one database makes those reads a
    // race with whatever else is mid-import.
    fileParallelism: false,
    sequence: { concurrent: false },
    setupFiles: ['./test/setup.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    exclude: IS_CI ? [...configDefaults.exclude, 'test/integration/**'] : configDefaults.exclude,
  },
});
