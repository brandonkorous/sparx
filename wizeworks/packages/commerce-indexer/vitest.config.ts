import { configDefaults, defineConfig } from 'vitest/config';

// The projector suites under test/integration/** build their documents from real
// rows, so they need a live Postgres with migrations applied. CI does not run a
// database, so they are skipped there (GH Actions sets CI=true) — the same split
// api-rest uses, and the reason the pre-push guard runs with CI=true too: the
// hook must never be stricter than CI, or it becomes something people bypass.
// Locally `pnpm test` runs everything against the docker-compose Postgres.
const IS_CI = process.env.CI === 'true' || process.env.CI === '1';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 20_000,
    hookTimeout: 20_000,
    exclude: IS_CI ? [...configDefaults.exclude, 'test/integration/**'] : configDefaults.exclude,
  },
});
