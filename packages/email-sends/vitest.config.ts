import { configDefaults, defineConfig } from 'vitest/config';

// Integration suites under test/integration/** write real ScheduledSend rows
// against a live Postgres (the sparx_app role, via @sparx/db — so RLS is in force).
// CI has no database, so skip them there (GH Actions sets CI=true). Locally
// `pnpm test` runs everything against the docker-compose Postgres from `pnpm db:up`.
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
