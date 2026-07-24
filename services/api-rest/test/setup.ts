// Vitest setup — force the test env BEFORE app.ts evaluates so the Fastify
// logger turns off and per-test noise stays low. The DATABASE_URL is read
// from the real .env (or shell), which points at the local docker Postgres.
//
// Load that .env HERE, first: src/env.ts imports `dotenv/config` too, but by
// then the assignments below have already landed and dotenv never overwrites an
// existing var. Loading it up front keeps the ??= fallbacks as what they are —
// a floor for environments with no .env at all (CI), not a silent override of
// the developer's.
import 'dotenv/config';

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL ??= 'silent';
process.env.SPARX_INTERNAL_JWT_SECRET ??= 'dev-only-internal-jwt-secret-change-me-32chars';
process.env.SPARX_INTERNAL_CRON_TOKEN ??= 'test-cron-token-1234567890abcdef';
process.env.SPARX_INTERNAL_OPERATOR_TOKEN ??= 'test-operator-token-1234567890ab';
process.env.PORT ??= '0';

// src/env.ts requires DATABASE_URL and EX_CONFIG-exits at import time without
// it, which would kill any suite that reaches the app graph — including the
// unit suites CI runs with no .env present. These point at the docker-compose
// Postgres; unit suites never open a connection, and the integration suites get
// the real URL from .env above.
process.env.DATABASE_URL ??=
  'postgresql://sparx_app:devpassword@localhost:5544/sparx?schema=public';
process.env.AUTH_DATABASE_URL ??=
  'postgresql://sparx_owner:devpassword@localhost:5544/sparx?schema=public';
