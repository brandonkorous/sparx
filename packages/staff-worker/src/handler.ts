// Per-message handler for the staff events (docs/149 §4).
//
// Failure handling follows the fleet convention:
//   • throw  → the message is redelivered
//   • return → the message is acked
//
// The one path here is idempotent by construction rather than by care: the
// labour deriver upserts on `(tenant, source_type, source_id)`, so a redelivery
// updates the same wage expense instead of doubling the month.

import { z } from 'zod';
import type { Logger } from 'pino';
import { deriveLaborForPeriod, deriveLaborForRoster, monthPeriod } from '@sparx/staff';

/**
 * Time was APPROVED. Not clocked out — approved.
 *
 * The payload carries the period rather than the entry ids, because the deriver
 * works on a period: it has to see everything approved in the span to produce
 * one expense per person, and a list of entry ids would make a partial rerun
 * silently write a partial figure.
 *
 * `staffMemberId` narrows it to one person (the usual case — a manager approving
 * one timesheet); omitting it derives the whole roster, which is what a
 * period-close does.
 */
const TimeApprovedEvent = z.object({
  type: z.literal('staff.time.approved'),
  tenantId: z.string().uuid(),
  data: z.object({
    staffMemberId: z.string().uuid().optional(),
    /** Defaults to the calendar month containing `workedOn`. */
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    /** A day inside the affected period, when the caller has an entry rather
     *  than a range — the common case from an approve button. */
    workedOn: z.coerce.date().optional(),
  }),
});

const StaffEvent = TimeApprovedEvent;
export type StaffEvent = z.infer<typeof StaffEvent>;

export function parseEvent(raw: unknown): StaffEvent | null {
  const result = StaffEvent.safeParse(raw);
  return result.success ? result.data : null;
}

export interface StaffHandlerOutcome {
  outcome: 'derived' | 'skipped';
  tenantId: string;
  people: number;
  expenses: number;
  totalCents: number;
  /** Approved minutes nobody can price. Logged rather than swallowed: this is
   *  the number that explains a wages figure looking low, and it is invisible
   *  everywhere else once the derivation has finished. */
  unpricedMinutes: number;
}

/**
 * How far a single message may reach.
 *
 * A period is normally a month. An event carrying a year-long span — a typo, a
 * replay with an epoch date — would walk the roster over hundreds of days inside
 * the shared worker process and starve every other handler in it. Clamping to
 * the last 400 days is the same backstop finance-worker uses, and for the same
 * reason: a genuine backfill is an ops task, not an event.
 */
const MAX_PERIOD_DAYS = 400;

function resolvePeriod(data: StaffEvent['data']): { from: Date; to: Date } {
  if (data.from && data.to) {
    const dayMs = 86_400_000;
    const span = Math.floor((data.to.getTime() - data.from.getTime()) / dayMs);
    if (span <= MAX_PERIOD_DAYS) return { from: data.from, to: data.to };
    return { from: new Date(data.to.getTime() - MAX_PERIOD_DAYS * dayMs), to: data.to };
  }
  // No explicit range: the calendar month containing the day that moved, which
  // is also the period `periodKey` names by its month — so the derived expense
  // lands on the same identity a period-close would produce, and the two
  // reconcile instead of creating a second row.
  return monthPeriod(data.workedOn ?? new Date());
}

export async function handle(event: StaffEvent, logger: Logger): Promise<StaffHandlerOutcome> {
  const { tenantId } = event;
  const period = resolvePeriod(event.data);

  const results = event.data.staffMemberId
    ? [
        await deriveLaborForPeriod(tenantId, {
          staffMemberId: event.data.staffMemberId,
          periodStart: period.from,
          periodEnd: period.to,
        }),
      ]
    : (await deriveLaborForRoster(tenantId, { periodStart: period.from, periodEnd: period.to }))
        .derived;

  const expenses = results.reduce((sum, r) => sum + r.expenseIds.length, 0);
  const totalCents = results.reduce((sum, r) => sum + r.totalCents, 0);
  const unpricedMinutes = results.reduce((sum, r) => sum + r.unpricedMinutes, 0);

  if (unpricedMinutes > 0) {
    // WARN, not debug. Someone worked hours this platform cannot cost, the
    // wages figure is therefore incomplete, and the only place that is visible
    // from the outside is the timesheet screen nobody may be looking at.
    logger.warn(
      { tenantId, unpricedMinutes, period },
      'staff labour derived with unpriced hours — some people have no pay rate covering this period'
    );
  }

  logger.info({ tenantId, people: results.length, expenses, totalCents }, 'staff labour derived');
  return {
    outcome: expenses > 0 ? 'derived' : 'skipped',
    tenantId,
    people: results.length,
    expenses,
    totalCents,
    unpricedMinutes,
  };
}
