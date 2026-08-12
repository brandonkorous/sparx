import { configDefaults, defineConfig } from 'vitest/config';

// Integration suites under test/integration/** require a live Postgres with
// migrations applied. CI doesn't run a database yet, so we skip them there
// (GH Actions sets CI=true, and so does the pre-push guard, which is what keeps
// the guard from being stricter than CI). Locally `pnpm test` runs everything
// against the docker-compose Postgres from `pnpm db:up`.
//
// The unit suites beside the source (src/*.test.ts) are pure arithmetic and run
// everywhere — they are the ones that catch a month-end anchor drifting.
const IS_CI = process.env.CI === 'true' || process.env.CI === '1';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    sequence: { concurrent: false },
    setupFiles: ['./test/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    exclude: IS_CI ? [...configDefaults.exclude, 'test/integration/**'] : configDefaults.exclude,
  },
});
