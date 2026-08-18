// Vitest setup — keep noise low and ensure the DB env points at local docker.
// Mirrors wizeworks/packages/finance/test/setup.ts, because the staff integration suite
// writes into the finance ledger and the two must agree about the database.

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL ??= 'silent';

process.env.DATABASE_URL ??=
  'postgresql://sparx_app:devpassword@localhost:5544/sparx?schema=public';
process.env.MIGRATION_DATABASE_URL ??=
  'postgresql://sparx_owner:devpassword@localhost:5544/sparx?schema=public';
