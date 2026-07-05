import { Pool } from 'pg';

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
