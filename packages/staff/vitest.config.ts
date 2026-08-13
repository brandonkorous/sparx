import { configDefaults, defineConfig } from 'vitest/config';

// The suites beside the source (`src/*.test.ts`) are pure arithmetic and date
// logic — no database, so they run everywhere including CI and the pre-push
// guard. They are the ones that catch a pay-rate window drifting or a salary
// amortisation losing a cent, which are the two ways this module produces a
// wrong number nobody notices until quarter end.
//
// `test/integration/**` needs a live Postgres with migrations applied, and CI
// does not run one — GH Actions sets CI=true and so does the pre-push guard,
// which is what keeps the guard from being stricter than CI. Locally
// `pnpm test` runs everything against the docker-compose Postgres from
// `pnpm db:up`. Same split as @sparx/finance, whose ledger this writes into.
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
