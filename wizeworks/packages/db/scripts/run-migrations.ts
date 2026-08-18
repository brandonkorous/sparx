// Entrypoint for the migration K8s Job (see k8s/sparx-prod/db-migrate-job.yaml
// on GCP, and the `db-migrate` Job in .github/workflows/deploy-azure.yml).
//
// TWO MODES, chosen by whether `GCP_PROJECT_ID` is set. That is the same switch
// the rest of the platform already uses — `wizeworks/packages/events/src/publisher.ts`
// picks Pub/Sub vs. direct HTTP dispatch on it, and k8s/azure's ConfigMap omits
// the variable deliberately and says so.
//
// GCP mode (GCP_PROJECT_ID set):
//   1. Pull sparx_app + sparx_owner passwords from Secret Manager (the Pod's
//      Workload Identity SA has roles/secretmanager.secretAccessor).
//   2. Wait until the Cloud SQL Auth Proxy sidecar is listening on
//      localhost:5432 — the sidecar can take a few seconds to start.
//   3. Run sql/cloud-sql-bootstrap.sql as sparx_owner (idempotent grants).
//
// DIRECT mode (GCP_PROJECT_ID unset — Azure, docker, anywhere else):
//   The connection URL arrives in the environment and the database is reached
//   over the network, so all three of those steps are skipped. Roles and grants
//   are somebody else's job: on Azure the `db-roles` Job runs
//   sql/azure-bootstrap.sql before this one.
//
// Both modes then converge:
//   4. Reconcile any migration-directory renames against `_prisma_migrations`
//      so `prisma migrate deploy` sees a consistent on-disk + DB state.
//   5. Run `prisma migrate deploy`.
//   6. If env RUN_SEED=true, run the seed.
//   7. If env RUN_BACKFILL=true, run the Builder box→class backfill (docs/61) —
//      rewrites persisted page/layout/component trees from the pre-cutover
//      box/layout shape to the class-only model. Idempotent + dry-run-safe.
//
// This used to be GCP-only, with `GCP_PROJECT_ID ?? 'sparxworks'` as its
// default — so on a cluster with no Google credentials it did not fall back, it
// confidently tried to read secrets from a project it could not authenticate
// to, and died with "Could not load the default credentials" before touching
// the database. Nothing in the message mentions migrations.
//
// Any step that fails causes a non-zero exit so the K8s Job goes to Failed.

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { Client as PgClient } from 'pg';

// Known migration-directory renames. Each entry is applied idempotently:
// we only rename when the OLD row exists in `_prisma_migrations` and the
// NEW row doesn't. After the first deploy that fixes prod, every later
// deploy is a no-op for that entry.
//
// Add an entry here whenever a migration directory is renamed in the repo
// (e.g. to fix alphabetical ordering for Prisma's shadow-DB replay).
const KNOWN_MIGRATION_RENAMES: readonly (readonly [string, string])[] = [
  ['20260528070458_cms_index_alignment', '20260528100300_cms_index_alignment'],
];

// No `?? 'sparxworks'` default. An absent project means "not on GCP", and
// defaulting it turned that into an authentication failure against a project
// this Pod was never meant to reach.
const PROJECT_ID = process.env.GCP_PROJECT_ID;
const PROXY_HOST = process.env.PROXY_HOST ?? '127.0.0.1';
const PROXY_PORT = process.env.PROXY_PORT ?? '5432';
const DB_NAME = process.env.DB_NAME ?? 'sparx';
const RUN_SEED = process.env.RUN_SEED === 'true';
const RUN_BACKFILL = process.env.RUN_BACKFILL === 'true';

// Migrations and the hand-edited RLS SQL must run as the OWNER, not as the
// RLS-constrained role the apps use. Callers may pass either name; DATABASE_URL
// is what the Azure Job sets (from the AUTH_DATABASE_URL secret).
const DIRECT_URL = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;

// Lazily constructed. At module scope this built a Secret Manager client on
// every import — including in direct mode, where it is pure waste.
let sm: SecretManagerServiceClient | null = null;

async function getSecret(name: string): Promise<string> {
  sm ??= new SecretManagerServiceClient();
  const [version] = await sm.accessSecretVersion({
    name: `projects/${PROJECT_ID}/secrets/${name}/versions/latest`,
  });
  const payload = version.payload?.data?.toString();
  if (!payload) throw new Error(`Secret ${name} has no payload`);
  return payload.trim();
}

async function waitForProxy(timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const client = new PgClient({
      host: PROXY_HOST,
      port: Number(PROXY_PORT),
      user: 'sparx_app',
      database: DB_NAME,
      // Intentionally no password — we expect this to fail authentication, but
      // a failed-auth response proves the proxy is reachable. We swallow the
      // auth error and treat it as "proxy is up".
      connectionTimeoutMillis: 2_000,
    });
    try {
      await client.connect();
      await client.end();
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/password|authentication|SASL/i.test(msg)) return; // proxy reachable
      await sleep(2_000);
    }
  }
  throw new Error(`Auth Proxy did not become reachable within ${timeoutMs}ms`);
}

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', env });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

// `_prisma_migrations` is created by `prisma migrate deploy` itself, so on a
// brand-new database it does not exist until AFTER the two maintenance steps
// below have already run. On Cloud SQL that was invisible — the table had
// existed since the first deploy years of migrations ago — and it stayed
// invisible right up until the first migration against an empty Azure
// database, which died on `relation "_prisma_migrations" does not exist`
// before applying a single migration.
//
// A fresh database has no renames to reconcile and no failed rows to clear,
// so the honest answer in both cases is "skip".
async function hasMigrationsTable(client: PgClient): Promise<boolean> {
  const { rows } = await client.query<{ present: boolean }>(
    "SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present"
  );
  return rows[0]?.present ?? false;
}

// Apply KNOWN_MIGRATION_RENAMES against `_prisma_migrations` so the table
// matches the renamed directories on disk before `prisma migrate deploy`
// runs. Without this, deploy would either re-apply already-executed SQL
// under the new name (and fail) or refuse to proceed.
//
// Idempotency: each rename only fires when the OLD row exists and the NEW
// one doesn't. After the first successful deploy past a rename, all later
// deploys log "no-op" for that entry. Connects as sparx_owner so we can
// UPDATE the _prisma_migrations table regardless of RLS.
async function reconcileMigrationRenames(connectionUrl: string): Promise<void> {
  if (KNOWN_MIGRATION_RENAMES.length === 0) return;
  const client = new PgClient({ connectionString: connectionUrl });
  await client.connect();
  try {
    if (!(await hasMigrationsTable(client))) {
      console.log('[migrate] no _prisma_migrations table yet — nothing to reconcile.');
      return;
    }
    for (const [oldName, newName] of KNOWN_MIGRATION_RENAMES) {
      const { rows } = await client.query<{ migration_name: string }>(
        'SELECT migration_name FROM _prisma_migrations WHERE migration_name IN ($1, $2)',
        [oldName, newName]
      );
      const names = new Set(rows.map((r) => r.migration_name));
      if (names.has(newName)) {
        console.log(`[migrate] rename ${oldName} → ${newName}: already applied, skipping.`);
        continue;
      }
      if (!names.has(oldName)) {
        console.log(`[migrate] rename ${oldName} → ${newName}: no row to rename, skipping.`);
        continue;
      }
      const result = await client.query(
        'UPDATE _prisma_migrations SET migration_name = $1 WHERE migration_name = $2',
        [newName, oldName]
      );
      if (result.rowCount !== 1) {
        throw new Error(
          `rename ${oldName} → ${newName}: expected to update 1 row, updated ${result.rowCount}`
        );
      }
      console.log(`[migrate] renamed ${oldName} → ${newName}.`);
    }
  } finally {
    await client.end();
  }
}

// Postgres DDL is transactional, and Prisma wraps every migration file in
// an implicit transaction. A migration that errors mid-flight is therefore
// fully rolled back at the DB level — but Prisma still records a row in
// `_prisma_migrations` with `finished_at = NULL`, which causes every
// subsequent `migrate deploy` to refuse to run until an operator clears
// it (normally via `prisma migrate resolve --rolled-back <name>`).
//
// Since we know the row represents work that did NOT commit, it is safe
// for us to delete it automatically so the next deploy re-attempts the
// (presumably-now-fixed) migration. This is equivalent to running
// `prisma migrate resolve --rolled-back` for every failed entry.
async function clearFailedMigrations(connectionUrl: string): Promise<void> {
  const client = new PgClient({ connectionString: connectionUrl });
  await client.connect();
  try {
    if (!(await hasMigrationsTable(client))) {
      console.log('[migrate] no _prisma_migrations table yet — nothing to clear.');
      return;
    }
    const { rows } = await client.query<{ migration_name: string }>(
      'SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL'
    );
    if (rows.length === 0) {
      console.log('[migrate] no failed migration rows to clear.');
      return;
    }
    for (const r of rows) {
      console.log(`[migrate] clearing failed migration row: ${r.migration_name}`);
    }
    await client.query(
      'DELETE FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL'
    );
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  let databaseUrl: string;
  let migrationUrl: string;

  if (PROJECT_ID) {
    console.log(`[migrate] GCP mode — fetching secrets from project ${PROJECT_ID}…`);
    const [appPassword, ownerPassword] = await Promise.all([
      getSecret('sparx-db-app-password'),
      getSecret('sparx-db-owner-password'),
    ]);

    // sslmode=disable is correct ONLY here: the connection is to a Cloud SQL
    // Auth Proxy on loopback, which is itself the encrypted hop.
    const baseHost = `${PROXY_HOST}:${PROXY_PORT}`;
    databaseUrl = `postgresql://sparx_app:${encodeURIComponent(appPassword)}@${baseHost}/${DB_NAME}?sslmode=disable`;
    migrationUrl = `postgresql://sparx_owner:${encodeURIComponent(ownerPassword)}@${baseHost}/${DB_NAME}?sslmode=disable`;

    console.log('[migrate] waiting for Auth Proxy sidecar…');
    await waitForProxy();
  } else {
    if (!DIRECT_URL) {
      throw new Error(
        'No GCP_PROJECT_ID and no MIGRATION_DATABASE_URL/DATABASE_URL. ' +
          'Set GCP_PROJECT_ID to use Secret Manager + the Cloud SQL Auth Proxy, ' +
          'or supply a connection URL for the owner role.'
      );
    }
    // One URL for both: the caller already handed us an owner connection, and
    // nothing below needs the unprivileged one — `prisma migrate deploy` reads
    // DATABASE_URL and must run as the owner.
    databaseUrl = DIRECT_URL;
    migrationUrl = DIRECT_URL;
    console.log('[migrate] direct mode — using the supplied connection URL.');
    console.log('[migrate] no Secret Manager, no Auth Proxy sidecar.');
  }

  const baseEnv: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    MIGRATION_DATABASE_URL: migrationUrl,
  };

  if (PROJECT_ID) {
    console.log('[migrate] applying bootstrap grants as sparx_owner…');
    await run(
      'pnpm',
      [
        'exec',
        'prisma',
        'db',
        'execute',
        '--url',
        migrationUrl,
        '--file',
        'sql/cloud-sql-bootstrap.sql',
      ],
      baseEnv
    );
  } else {
    // sql/cloud-sql-bootstrap.sql assumes roles that `gcloud sql users create`
    // made out of band, so it grants without creating. Azure has no equivalent,
    // which is why sql/azure-bootstrap.sql both creates AND grants — and why it
    // runs as its own `db-roles` Job before this one, not from here.
    console.log('[migrate] skipping cloud-sql bootstrap grants (not on GCP).');
  }

  console.log('[migrate] reconciling known migration renames…');
  await reconcileMigrationRenames(migrationUrl);

  console.log('[migrate] clearing rolled-back failed migration rows…');
  await clearFailedMigrations(migrationUrl);

  console.log('[migrate] running prisma migrate deploy…');
  await run('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], baseEnv);

  if (RUN_SEED) {
    console.log('[migrate] running seed…');
    await run('pnpm', ['exec', 'tsx', 'prisma/seed.ts'], baseEnv);
  } else {
    console.log('[migrate] RUN_SEED!=true, skipping seed.');
  }

  if (RUN_BACKFILL) {
    // Run as sparx_owner (migration connection): the backfill UPDATEs FORCE-RLS
    // builder tables per-tenant (it sets app.tenant_id itself), and the owner
    // role is guaranteed DML grants on the tables it owns. `--apply` writes;
    // without it the script only dry-runs.
    // `migrateTree` emits silicaui classes directly (`btn btn-primary btn-md`),
    // so this is safe to run after the `st-*` → silica migration — it cannot
    // reintroduce the retired vocabulary.
    //
    // There WAS a second step here, an `sf-` → `st-` prefix normalizer. It is
    // gone with the rest of `st-*`: running it after that migration would have
    // written the retired prefix back into trees the migration had just cleaned.
    // Its script is deleted (docs/implementation/st-token-retirement.md §4).
    console.log('[migrate] running Builder box→class backfill…');
    await run('pnpm', ['exec', 'tsx', 'scripts/backfill-builder-class.ts', '--apply'], {
      ...baseEnv,
      DATABASE_URL: migrationUrl,
    });
    // Independently, make every site's customer-facing name live on
    // `Property.name` (tenant↔site clarity, docs/49): fill a placeholder/'Default'
    // name from brand_override.businessName → tenant_brands.business_name, and
    // strip the deprecated `brand_override.businessName` key. Never clobbers a
    // real name; idempotent. Order vs. the builder backfills is irrelevant — it
    // touches `properties`, not builder trees.
    console.log('[migrate] running Property.name backfill…');
    await run('pnpm', ['exec', 'tsx', 'scripts/backfill-property-name.ts', '--apply'], {
      ...baseEnv,
      DATABASE_URL: migrationUrl,
    });
  } else {
    console.log('[migrate] RUN_BACKFILL!=true, skipping Builder class + Property.name backfills.');
  }

  console.log('[migrate] done.');
}

main().catch((err: unknown) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
