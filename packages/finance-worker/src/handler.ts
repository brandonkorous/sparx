// Per-message handler for the finance events (docs/148 §8).
//
// Failure handling follows the fleet convention:
//   • throw  → the message is redelivered
//   • return → the message is acked
//
// Every path here is idempotent, so a redelivery is safe by construction rather
// than by luck: recurring generation upserts on `(tenant, source_type, source_id)`
// and the rollup is a cache of a subtraction that recomputes to the same numbers.

import { z } from 'zod';
import type { Logger } from 'pino';
import { generateDueExpenses, recomputeDay, recomputeRange, utcMidnight } from '@sparx/finance';

/**
 * One event shape per thing that can make the rollup stale.
 *
 * `finance.expense.recorded` and `.allocated` both carry the DAY rather than the
 * expense: the rollup's grain is a day, and sending the day means the handler
 * needs no read to know what to invalidate.
 */
const ExpenseTouchedEvent = z.object({
  type: z.enum(['finance.expense.recorded', 'finance.expense.allocated']),
  tenantId: z.string().uuid(),
  data: z.object({
    expenseId: z.string().uuid().optional(),
    /** The expense's `incurredAt` day — the bucket that just went stale. */
    incurredAt: z.coerce.date(),
  }),
});

const RecurringDueEvent = z.object({
  type: z.literal('finance.recurring.due'),
  tenantId: z.string().uuid(),
  data: z
    .object({
      /** Generate everything owed up to this date. Defaults to today. */
      through: z.coerce.date().optional(),
    })
    .default({}),
});

const ProfitRecomputeEvent = z.object({
  type: z.literal('finance.profit.recompute'),
  tenantId: z.string().uuid(),
  data: z.object({
    from: z.coerce.date(),
    to: z.coerce.date(),
  }),
});

const FinanceEvent = z.union([ExpenseTouchedEvent, RecurringDueEvent, ProfitRecomputeEvent]);
export type FinanceEvent = z.infer<typeof FinanceEvent>;

export function parseEvent(raw: unknown): FinanceEvent | null {
  const result = FinanceEvent.safeParse(raw);
  return result.success ? result.data : null;
}

export interface FinanceHandlerOutcome {
  outcome: 'recomputed' | 'generated' | 'skipped';
  tenantId: string;
  days?: number;
  generated?: number;
  templates?: number;
}

/**
 * How far back a recompute is allowed to reach in one message.
 *
 * A range recompute walks day by day, so an unbounded `from` (a typo, a replayed
 * event with an epoch date) would sit in a loop for the life of the message and
 * block the shared worker process. Clamping is the right failure: recent days are
 * what anyone is looking at, and a genuine backfill is an ops task, not an event.
 */
const MAX_RECOMPUTE_DAYS = 400;

function clampRange(from: Date, to: Date): { from: Date; to: Date; clamped: boolean } {
  const start = utcMidnight(from);
  const end = utcMidnight(to);
  const dayMs = 24 * 60 * 60 * 1000;
  const span = Math.floor((end.getTime() - start.getTime()) / dayMs);
  if (span <= MAX_RECOMPUTE_DAYS) return { from: start, to: end, clamped: false };
  return { from: new Date(end.getTime() - MAX_RECOMPUTE_DAYS * dayMs), to: end, clamped: true };
}

export async function handle(event: FinanceEvent, logger: Logger): Promise<FinanceHandlerOutcome> {
  const { tenantId } = event;

  if (event.type === 'finance.recurring.due') {
    const through = event.data.through ?? new Date();
    const results = await generateDueExpenses(tenantId, through);
    const generated = results.reduce((sum, r) => sum + r.generated, 0);

    // Anything generated lands on a past or present day, so the rollup for those
    // days is now wrong. Recompute the span the new rows actually cover rather
    // than a fixed window — a template caught up over a quarter dirties a quarter.
    if (generated > 0) {
      await recomputeRange(tenantId, earliestGenerated(results, through), through);
    }

    logger.info({ tenantId, generated, templates: results.length }, 'finance recurring generated');
    return { outcome: 'generated', tenantId, generated, templates: results.length };
  }

  if (event.type === 'finance.profit.recompute') {
    const { from, to, clamped } = clampRange(event.data.from, event.data.to);
    if (clamped) {
      logger.warn(
        { tenantId, requestedFrom: event.data.from, from },
        `finance profit recompute clamped to the last ${MAX_RECOMPUTE_DAYS} days`
      );
    }
    const rows = await recomputeRange(tenantId, from, to);
    return { outcome: 'recomputed', tenantId, days: rows.length };
  }

  // An expense moved: exactly one day is stale.
  const rows = await recomputeDay(tenantId, event.data.incurredAt);
  logger.debug({ tenantId, day: event.data.incurredAt }, 'finance profit day recomputed');
  return { outcome: 'recomputed', tenantId, days: rows.length };
}

/** The oldest day the generator wrote to, so the recompute covers all of it. */
function earliestGenerated(
  results: readonly { generated: number; nextRunOn: Date | null }[],
  fallback: Date
): Date {
  // `nextRunOn` is the cursor AFTER generating, so it is not the earliest row —
  // but the generator only ever moves forward from a template's previous cursor,
  // and the caller's `through` bounds the far end. A year back from `through`
  // covers every realistic catch-up without an extra read per template.
  const anyGenerated = results.some((r) => r.generated > 0);
  if (!anyGenerated) return fallback;
  const yearMs = 366 * 24 * 60 * 60 * 1000;
  return new Date(utcMidnight(fallback).getTime() - yearMs);
}
