// Vitest setup — quiet logs + point the DB env at local docker.
//
// The overdue worker connects as sparx_owner in prod (RLS bypassed so it can
// scan every tenant). The integration suite mirrors that by driving the
// escalation through a sparx_owner client (MIGRATION_DATABASE_URL). DATABASE_URL
// only needs to satisfy env.ts validation — the test injects its own client.

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL ??= 'silent';

process.env.DATABASE_URL ??=
  'postgresql://sparx_app:devpassword@localhost:5544/sparx?schema=public';
process.env.MIGRATION_DATABASE_URL ??=
  'postgresql://sparx_owner:devpassword@localhost:5544/sparx?schema=public';
