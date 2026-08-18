// Background jobs — "what's running right now?", polled.
//
// The read-side of the awareness layer (docs/124 Phase 1). `GET /v1/jobs` is a
// projection over the platform's run-ledgers; this hook asks only for the
// ACTIVE ones, which today means in-flight imports (the one ledger with a real
// running state). The status bar's jobs chip renders the result.
//
// Polling, not a socket: a job that survives a popout would need a socket kept
// alive across windows, and the honest cost of a background import is minutes,
// not milliseconds. So the cadence is brisk while work is in flight (a progress
// bar that visibly moves) and lazy when idle — but never off, so an import
// started in ANOTHER window still surfaces here within a few seconds.

import { useMemo } from 'react';
import { useQuery } from '@wizeworks/query';
import { api } from './client';

export type JobStatus = 'running' | 'done' | 'failed';

/** The app-agnostic job as api-rest returns it — no routing, on purpose. */
interface ApiJob {
  id: string;
  source: string;
  kind: string;
  label: string;
  status: JobStatus;
  /** 0..100, or null when the backing ledger can't express progress. */
  progress: number | null;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
}

/** The workbench's enriched job: the API fields plus the surface that shows
 *  this job's output, resolved here rather than server-side — the same split
 *  the pulse uses (lib/api/activity.ts assigns surfaces client-side too). */
export interface Job extends ApiJob {
  surface: string | null;
}

/** kind → the workbench surface that shows where this job's output lands, so a
 *  running import can click through to the list its rows are appearing in. Kept
 *  here (not in api-rest) so the API stays free of one consumer's surface keys. */
const KIND_SURFACE: Record<string, string> = {
  'import.products': 'commerce.products.list',
  'import.customers': 'crm.customers.list',
  'import.b2b_accounts': 'b2b.accounts.list',
  'import.discounts': 'commerce.discounts.list',
  'inventory.sync': 'inventory.sources',
};

const ACTIVE_POLL_MS = 4_000;
const IDLE_POLL_MS = 20_000;

/** Shared fetch + enrichment. `state` is part of the query key so the chip's
 *  active list and the Pulse pane's full list cache independently — and both
 *  start with 'jobs', which is what the status bar's "Syncing…" predicate
 *  excludes so neither poll blinks the connection slot. */
function useJobsQuery(state: 'active' | 'all', limit: number): Job[] {
  const query = useQuery({
    queryKey: ['jobs', state],
    queryFn: () => api.get<{ jobs: ApiJob[] }>('/v1/jobs', { state, limit }),
    // Brisk only while something is actually running; back off otherwise so an
    // idle workbench isn't polling every 4 seconds forever. `all` counts only
    // RUNNING rows here — a list of finished history doesn't need a fast clock.
    refetchInterval: (q) =>
      (q.state.data?.jobs ?? []).some((job) => job.status === 'running')
        ? ACTIVE_POLL_MS
        : IDLE_POLL_MS,
  });

  const jobs = query.data?.jobs;
  return useMemo<Job[]>(
    () => (jobs ?? []).map((job) => ({ ...job, surface: KIND_SURFACE[job.kind] ?? null })),
    [jobs]
  );
}

/** The jobs currently in flight, newest first. Empty when nothing is running —
 *  the chip hides itself in that case, exactly like the detached-windows chip. */
export function useActiveJobs(): Job[] {
  return useJobsQuery('active', 20);
}

/** Everything the ledgers know about, running and finished — what the Pulse
 *  surface shows. Finished rows are the whole point here: the chip can only say
 *  "still going", this is where "did it work?" gets answered. */
export function useAllJobs(): Job[] {
  return useJobsQuery('all', 50);
}
