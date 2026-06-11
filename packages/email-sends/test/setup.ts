// Vitest setup — quiet logs + point the DB env at local docker (mirrors
// @sparx/automation-actions). enqueueSend (called without a tx) uses the default
// @sparx/db client, which reads DATABASE_URL — so it must point at docker here.

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL ??= 'silent';

process.env.DATABASE_URL ??=
  'postgresql://sparx_app:devpassword@localhost:5544/sparx?schema=public';
process.env.MIGRATION_DATABASE_URL ??=
  'postgresql://sparx_owner:devpassword@localhost:5544/sparx?schema=public';
