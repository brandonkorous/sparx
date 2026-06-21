// Recurring booking-series materialization tick (docs/79 §7.6). A series stores an
// RRULE and materializes child bookings up to a horizon; this background pass rolls
// that horizon forward so unbounded series keep generating occurrences. Singleton
// across pods via an advisory lock — mirrors lib/scheduling-calendar-sync.ts.
//
// The cross-tenant scan goes through the SECURITY DEFINER find_due_booking_series
// (migration 20260918000000); the per-series materialize then runs back under
// withTenant({tenantId}) inside the engine, so every write still passes RLS.

import type { FastifyBaseLogger } from 'fastify';
import { prisma } from '@sparx/db';
import { materializeSeries } from '@sparx/scheduling';

const SERIES_LOCK_KEY = 4242_4247;
const DEFAULT_INTERVAL_MS = 600_000; // every 10 min — series roll slowly
const LEAD_SECONDS = 2_592_000; // top up a series when within 30 days of its horizon
const SCAN_LIMIT = 50;

interface DueSeries {
  id: string;
  tenant_id: string;
}

export interface SeriesTickResult {
  acquired: boolean;
  processed: number;
  created: number;
  errors: number;
}

export async function runSeriesMaterializationTick(
  logger: FastifyBaseLogger
): Promise<SeriesTickResult> {
  const lock = await prisma.$queryRaw<{ acquired: boolean }[]>`
    SELECT pg_try_advisory_lock(${SERIES_LOCK_KEY}::int) AS acquired
  `;
  if (!lock[0]?.acquired) return { acquired: false, processed: 0, created: 0, errors: 0 };

  try {
    const due = await prisma.$queryRaw<DueSeries[]>`
      SELECT id, tenant_id FROM find_due_booking_series(${LEAD_SECONDS}::int, ${SCAN_LIMIT}::int)
    `;
    if (due.length === 0) return { acquired: true, processed: 0, created: 0, errors: 0 };
    logger.info({ count: due.length }, 'series-tick: extending due booking series');

    let processed = 0;
    let created = 0;
    let errors = 0;
    for (const row of due) {
      try {
        const result = await materializeSeries(row.tenant_id, row.id);
        processed += 1;
        created += result.created.length;
      } catch (err) {
        errors += 1;
        logger.warn(
          { tenantId: row.tenant_id, seriesId: row.id, err },
          'series-tick: materialize failed'
        );
      }
    }
    return { acquired: true, processed, created, errors };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${SERIES_LOCK_KEY}::int)`;
  }
}

export function startSeriesMaterializationLoop(
  logger: FastifyBaseLogger,
  intervalMs: number = DEFAULT_INTERVAL_MS
): () => void {
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  const tick = async (): Promise<void> => {
    if (stopped) return;
    try {
      await runSeriesMaterializationTick(logger);
    } catch (err) {
      logger.error({ err }, 'series-tick: tick threw — will retry next interval');
    }
    if (stopped) return;
    timer = setTimeout(() => void tick(), intervalMs);
  };

  timer = setTimeout(() => void tick(), intervalMs);
  logger.info({ intervalMs }, 'series-tick: loop started');

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    logger.info('series-tick: loop stopped');
  };
}
