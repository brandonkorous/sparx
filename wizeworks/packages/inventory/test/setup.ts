// Vitest setup — keep noise low and point the @wizeworks/db client at local docker.
// Mirrors wizeworks/packages/crm/test/setup.ts so the two integration surfaces behave the
// same under `pnpm test` (against the docker-compose Postgres from `pnpm db:up`).

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL ??= 'silent';

process.env.DATABASE_URL ??=
  'postgresql://sparx_app:devpassword@localhost:5544/sparx?schema=public';
process.env.MIGRATION_DATABASE_URL ??=
  'postgresql://sparx_owner:devpassword@localhost:5544/sparx?schema=public';
