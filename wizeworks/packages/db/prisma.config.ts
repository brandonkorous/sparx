// Prisma configuration — replaces the deprecated package.json#prisma block
// (Prisma 7 removes that, and the warning has been firing on every command).
//
// The schema is split per domain across prisma/schema/*.prisma. Migrations
// live in prisma/migrations as normal.
//
// The .env is read by Node's own loader, not by `import 'dotenv/config'`.
// This package has never declared dotenv, and under pnpm's strict linking a
// package that is not declared cannot be resolved, so that import threw. The
// config file is loaded before anything else, which means EVERY prisma command
// here died before it parsed its own arguments: `migrate deploy`, `migrate
// status`, `generate`, `studio`, even `--version`. process.loadEnvFile is
// built into Node and behaves the same way dotenv did, including leaving a
// variable that is already set alone, so a real environment still wins over a
// local file.

import path from 'node:path';
import { defineConfig } from 'prisma/config';

try {
  process.loadEnvFile();
} catch {
  // No .env alongside this file. That is the normal case in CI and in the
  // release pipeline, where DATABASE_URL is already in the environment.
}

export default defineConfig({
  schema: path.join('prisma', 'schema'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
});
