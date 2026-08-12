// Vitest setup. Loads the real .env first so DATABASE_URL points at the same
// docker-compose Postgres every other suite uses, then fills in a floor for an
// environment that has no .env at all. dotenv never overwrites an existing var, so
// loading it up front keeps these `??=` lines a fallback rather than a silent
// override of whatever the developer has configured. Mirrors api-rest/test/setup.ts.
import 'dotenv/config';

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL ??= 'silent';
process.env.DATABASE_URL ??=
  'postgresql://sparx_app:devpassword@localhost:5544/sparx?schema=public';
process.env.AUTH_DATABASE_URL ??=
  'postgresql://sparx_owner:devpassword@localhost:5544/sparx?schema=public';
