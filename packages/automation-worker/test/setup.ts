// Vitest setup — quiet logs + point env at local docker, BEFORE env.ts loads.
//
// The worker connects as sparx_app (DATABASE_URL); the engine's cross-tenant
// discovery uses SECURITY DEFINER helpers, so no owner URL is needed. The test
// also seeds/asserts through a sparx_owner client (MIGRATION_DATABASE_URL).

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL ??= 'silent';
process.env.SPARX_INTERNAL_CRON_TOKEN ??= 'test-cron-token-0123456789';

process.env.DATABASE_URL ??=
  'postgresql://sparx_app:devpassword@localhost:5544/sparx?schema=public';
process.env.MIGRATION_DATABASE_URL ??=
  'postgresql://sparx_owner:devpassword@localhost:5544/sparx?schema=public';
