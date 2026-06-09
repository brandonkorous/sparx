import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Integration suites under test/integration/** require a live Postgres with
// migrations applied. CI doesn't run a database yet, so we skip them there
// (GH Actions sets CI=true). Locally `pnpm test` runs everything against
// the docker-compose Postgres from `pnpm db:up`.
const IS_CI = process.env.CI === 'true' || process.env.CI === '1';

export default defineConfig({
  // The app graph pulls in @sparx/email, which ships raw .tsx (React Email
  // templates). Without a JSX transform vite's import-analysis can't parse it
  // and EVERY integration suite fails at import time. Mirror @sparx/email's own
  // test config so api-rest can transform that JSX (test-only; production runs
  // through tsx). See packages/email/vitest.config.ts.
  plugins: [react()],
  test: {
    environment: 'node',
    fileParallelism: false,
    sequence: { concurrent: false },
    setupFiles: ['./test/setup.ts'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    exclude: IS_CI ? [...configDefaults.exclude, 'test/integration/**'] : configDefaults.exclude,
  },
});
