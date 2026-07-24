// Vitest setup — set env before src/env.ts evaluates.
//
// Load the service's own .env FIRST so a real local DATABASE_URL still wins:
// src/env.ts imports `dotenv/config` too, but by then these assignments have
// already landed and dotenv never overwrites an existing var. Loading it here
// keeps the ??= fallbacks below as what they are — a floor for environments
// with no .env at all (CI), not a silent override of the developer's.
import 'dotenv/config';

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL ??= 'silent';
process.env.SPARX_INTERNAL_JWT_SECRET ??= 'dev-only-internal-jwt-secret-change-me-32chars';
process.env.PORT ??= '0';

// src/env.ts requires DATABASE_URL, and the unit suites under src/** (the only
// ones CI runs — vitest.config.ts excludes test/** there) import the tool
// registry, which reaches env.ts through registrar.ts. Without a value the Zod
// parse EX_CONFIG-exits at import time and the suite fails before a single test
// runs. These point at the docker-compose Postgres; the unit suites never open
// a connection, and the integration suites under test/** get the real URL from
// .env above.
process.env.DATABASE_URL ??=
  'postgresql://sparx_app:devpassword@localhost:5544/sparx?schema=public';
process.env.AUTH_DATABASE_URL ??=
  'postgresql://sparx_owner:devpassword@localhost:5544/sparx?schema=public';
