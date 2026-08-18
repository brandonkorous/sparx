// The jobs read-spine (docs/124 Phase 1) — "what background work is running?"
//
// A read-only projection over the per-domain run-ledgers. It owns NO table of
// its own: each source is a small adapter that reads its ledger and normalizes
// rows into the shared Job DTO. Adding a producer teaches this file one adapter,
// never a migration — the seam docs/124 calls the read-spine.
//
//   GET /v1/jobs?state=active|all&limit=  → { jobs: Job[] }
//
// Today only ImportJob models an in-flight state (pending → processing →
// completed | failed). The other ledgers are written at COMPLETION only
// (InventorySyncRun rows are stamped with finishedAt when the run ends), so they
// are terminal history: they contribute to `state=all` but never to
// `state=active`. That asymmetry is real, not a stub — when an async producer
// with a genuine running state lands, it registers an adapter here and the chip
// picks it up for free.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { TxClient } from '@wizeworks/db';
import { withRequestTenant } from '@wizeworks/api-core/db';
import { ok } from '@wizeworks/api-core/envelope';
import { requireAuth } from '@wizeworks/api-core/auth';

/** The normalized lifecycle every ledger collapses to. */
type JobStatus = 'running' | 'done' | 'failed';

/** The shared, app-agnostic job shape. `id` is source-prefixed so ids from
 *  different ledgers can never collide. There is deliberately NO route/href
 *  here: WHERE a job's output lives is a per-app concept (the workbench maps
 *  `kind` → a surface key client-side, the way the pulse assigns surfaces), so
 *  baking one app's paths into this contract would couple the read-spine to a
 *  consumer. `kind` carries enough for any consumer to route itself. */
interface Job {
  id: string;
  source: string; // 'import' | 'inventory-sync' | …
  kind: string; // 'import.products', 'inventory.sync', …
  label: string; // human, in owner language
  status: JobStatus;
  progress: number | null; // 0..100, or null when the ledger can't express it
  startedAt: string; // ISO
  finishedAt: string | null; // ISO, null while running
  error: string | null;
}

type JobState = 'active' | 'all';

/** An adapter reads one ledger and returns already-normalized jobs. It is handed
 *  `limit` so it never over-fetches; the caller re-sorts and re-slices the union. */
type JobAdapter = (tx: TxClient, state: JobState, limit: number) => Promise<Job[]>;

const Query = z.object({
  state: z.enum(['active', 'all']).default('active'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ── ImportJob ──────────────────────────────────────────────────────────────
// The one ledger with a real in-flight state today.

const IMPORT_ENTITY_LABEL: Record<string, string> = {
  products: 'products',
  customers: 'customers',
  b2b_accounts: 'B2B accounts',
  discounts: 'discounts',
};

const IMPORT_ACTIVE = ['pending', 'processing'];

function importStatus(raw: string): JobStatus {
  if (raw === 'completed') return 'done';
  if (raw === 'failed') return 'failed';
  return 'running'; // pending | processing
}

const importJobs: JobAdapter = async (tx, state, limit) => {
  const rows = await tx.importJob.findMany({
    where: state === 'active' ? { status: { in: IMPORT_ACTIVE } } : {},
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      entityType: true,
      status: true,
      rowCount: true,
      importedCount: true,
      updatedCount: true,
      errorCount: true,
      completedAt: true,
      createdAt: true,
    },
  });

  return rows.map((row): Job => {
    const status = importStatus(row.status);
    const entity = IMPORT_ENTITY_LABEL[row.entityType] ?? row.entityType;
    const processed = row.importedCount + row.updatedCount + row.errorCount;
    const progress =
      status === 'done'
        ? 100
        : row.rowCount > 0
          ? Math.min(100, Math.max(0, Math.round((processed / row.rowCount) * 100)))
          : null;

    const label =
      status === 'running'
        ? `Importing ${entity}`
        : status === 'done'
          ? `Imported ${entity}`
          : `Import of ${entity} failed`;

    const error =
      status === 'failed'
        ? row.errorCount > 0
          ? `${String(row.errorCount)} of ${String(row.rowCount)} rows couldn't be imported`
          : 'The import didn’t finish'
        : null;

    return {
      id: `import:${row.id}`,
      source: 'import',
      kind: `import.${row.entityType}`,
      label,
      status,
      progress,
      startedAt: row.createdAt.toISOString(),
      finishedAt: row.completedAt?.toISOString() ?? null,
      error,
    };
  });
};

// ── InventorySyncRun ─────────────────────────────────────────────────────────
// Terminal history only — a row exists only once the run has finished, so this
// contributes nothing to `state=active` and short-circuits there.

const inventorySyncRuns: JobAdapter = async (tx, state, limit) => {
  if (state === 'active') return []; // no in-flight rows exist for this ledger

  const rows = await tx.inventorySyncRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      status: true,
      error: true,
      startedAt: true,
      finishedAt: true,
      source: { select: { name: true } },
    },
  });

  return rows.map((row): Job => {
    const failed = row.status === 'error';
    const name = row.source?.name ?? 'a source';
    return {
      id: `inventory-sync:${row.id}`,
      source: 'inventory-sync',
      kind: 'inventory.sync',
      label: failed ? `Sync of ${name} failed` : `Synced ${name}`,
      status: failed ? 'failed' : 'done',
      progress: null,
      startedAt: row.startedAt.toISOString(),
      finishedAt: row.finishedAt?.toISOString() ?? null,
      error: failed ? (row.error ?? 'The sync didn’t finish') : null,
    };
  });
};

const ADAPTERS: JobAdapter[] = [importJobs, inventorySyncRuns];

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync demands async; route registration is sync.
const jobsRoutes: FastifyPluginAsync = async (app) => {
  // GET /v1/jobs — the union across every ledger, newest first.
  //
  // Not module-gated: a disabled module simply has no rows (RLS + empty), so the
  // honest answer is an empty list, never a 404. This is a cross-cutting platform
  // read, like the dashboard home.
  app.get('/v1/jobs', async (request) => {
    requireAuth(request);
    const { state, limit } = Query.parse(request.query);

    const jobs = await withRequestTenant(request, async (tx) => {
      const perSource = await Promise.all(ADAPTERS.map((adapter) => adapter(tx, state, limit)));
      return perSource.flat();
    });

    jobs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    return ok({ jobs: jobs.slice(0, limit) });
  });
};

export default jobsRoutes;
