import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Integration suites need a live Postgres + the same JWT secret api-rest uses.
// CI skips them; locally `pnpm db:up` then `pnpm test` runs the whole thing.
const IS_CI = process.env.CI === 'true' || process.env.CI === '1';

export default defineConfig({
  // The tool-registry graph pulls in @sparx/email-platform → @sparx/email, which
  // ships raw .tsx (React Email templates). Without a JSX transform vite's
  // import-analysis can't parse it and EVERY suite fails at import time. Mirror
  // api-rest's config (test-only; production runs through tsx). See
  // packages/email/vitest.config.ts.
  plugins: [react()],
  test: {
    environment: 'node',
    fileParallelism: false,
    sequence: { concurrent: false },
    setupFiles: ['./test/setup.ts'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    exclude: IS_CI ? [...configDefaults.exclude, 'test/**'] : configDefaults.exclude,
  },
});
