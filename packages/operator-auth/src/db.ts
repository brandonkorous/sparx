import { Pool } from 'pg';

import { isNextBuild } from './build-phase';

// The operator instance's ONLY database handle: a pg Pool connected as the
// dedicated `wize_operator` role with its search_path pinned to the `wize_admin`
// schema (docs/apps/admin/build-plan.md §2 D3/D6).
//
// This is deliberately NOT the shared @sparx/db Prisma client. The operator app
// holds no cross-tenant business-data role at all — `wize_operator` has grants
// ONLY on `wize_admin` (operator identity, capabilities, audit). Every byte of
// tenant business data flows through api-rest /internal/operator/* instead.
//
// Better Auth drives its core tables through this same pool via its native
// Kysely adapter (server.ts); our capability + audit queries use it directly.
// One pool per process, cached on globalThis so Next dev HMR doesn't leak
// connections (mirrors @sparx/db's client + @sparx/auth's authPrisma).

declare global {
  var __sparxOperatorPool: Pool | undefined;
}

function connectionString(): string {
  const explicit = process.env.OPERATOR_DATABASE_URL;
  if (explicit) return explicit;

  // In production an unset URL is a CONFIGURATION BUG, never a default.
  //
  // This used to fall through to the dev localhost string unconditionally, and
  // the Azure deployment shipped without OPERATOR_DATABASE_URL — so the admin
  // console dialled 127.0.0.1:5544 from inside the cluster and every sign-in
  // returned 500 with an ECONNREFUSED buried in the pod log. The pod was
  // Running, its probes passed, and the only symptom was that nobody could log
  // in. Failing at boot turns that into a rollout that visibly does not
  // complete, which is the same call packages/events/src/transport.ts makes for
  // an unset broker and for the same reason.
  //
  // EXCEPT during `next build`. Next runs page-data collection with
  // NODE_ENV=production inside the image build, where there is no database and
  // no secrets — so throwing there fails the BUILD rather than a misconfigured
  // deploy. It did exactly that: `Failed to collect page data for
  // /api/operator/bootstrap`. The build never opens a connection, so skipping
  // the guard costs nothing; the check still fires when the container actually
  // runs, which is the moment that matters.
  if (process.env.NODE_ENV === 'production' && !isNextBuild()) {
    throw new Error(
      'OPERATOR_DATABASE_URL is not set. The operator console needs its own ' +
        'connection as `wize_operator` to the wize_admin schema; there is no ' +
        'safe default in production. See the Sync secrets step in ' +
        '.github/workflows/deploy-azure.yml.'
    );
  }

  // Dev fallback so a fresh checkout boots without env wiring. Matches the
  // docker Postgres port (5544) + the `wize_operator` role seeded by
  // packages/db/docker/init/01-roles.sql.
  return 'postgresql://wize_operator:devpassword@localhost:5544/sparx';
}

export const operatorPool: Pool =
  globalThis.__sparxOperatorPool ??
  new Pool({
    connectionString: connectionString(),
    // Pin every connection in the pool to the wize_admin schema so Better Auth's
    // unqualified Kysely queries (platform_operators, …) resolve there. Our own
    // queries schema-qualify explicitly as belt-and-suspenders.
    options: '-c search_path=wize_admin',
    max: 5,
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__sparxOperatorPool = operatorPool;
}
