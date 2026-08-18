// Vitest setup — pre-set env before src/env.ts evaluates.
//
// Load the service's .env first: src/env.ts imports `dotenv/config` too, but by
// then the assignments below have already landed and dotenv never overwrites an
// existing var. Loading it up front keeps the ??= fallbacks as what they are —
// a floor for environments with no .env at all (CI), not a silent override of
// the developer's.
import 'dotenv/config';

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL ??= 'silent';
process.env.SPARX_INTERNAL_JWT_SECRET ??= 'dev-only-internal-jwt-secret-change-me-32chars';
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
