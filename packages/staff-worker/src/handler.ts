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
import {
  commissionForDeal,
  commissionForOrder,
  deriveLaborForPeriod,
  deriveLaborForRoster,
  monthPeriod,
} from '@sparx/staff';

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

/**
 * A sale that may have earned somebody a commission.
 *
 * PAID, not placed — a commission on an unpaid order is a promise, and paying
 * out of a promise funds staff from cash the business has not received.
 * `order.refunded` recomputes rather than reverses: the calculator reduces the
 * basis proportionally and `recordCommission` upserts, so the row moves to the
 * new figure instead of a second correcting row appearing beside it.
 *
 * The payload is deliberately just the id. Every figure is re-read from the
 * order inside the calculation, because an event's snapshot of a total is stale
 * the moment a refund lands, and a commission computed from a stale total is a
 * payment nobody can reconcile.
 */
const OrderMoneyEvent = z.object({
  type: z.enum(['order.paid', 'order.refunded']),
  tenantId: z.string().uuid(),
  data: z.object({ orderId: z.string().uuid() }),
});

/** A deal reached a `won` stage. Published on the platform bus by the api-rest
 *  route that moves a deal, because `crm.deal.stage_changed` rides the CRM bus
 *  and never reaches an in-process consumer here. */
const DealWonEvent = z.object({
  type: z.literal('crm.deal.won'),
  tenantId: z.string().uuid(),
  data: z.object({ dealId: z.string().uuid() }),
});

const StaffEvent = z.union([TimeApprovedEvent, OrderMoneyEvent, DealWonEvent]);
export type StaffEvent = z.infer<typeof StaffEvent>;

/** Just the labour payload. `StaffEvent['data']` is now a union of three shapes,
 *  so the period resolver has to name the one it actually reads — otherwise it
 *  claims to accept an order id and then asks it for a date range. */
type TimeApprovedData = z.infer<typeof TimeApprovedEvent>['data'];

export function parseEvent(raw: unknown): StaffEvent | null {
  const result = StaffEvent.safeParse(raw);
  return result.success ? result.data : null;
}

export interface StaffHandlerOutcome {
  outcome: 'derived' | 'skipped' | 'commissioned';
  tenantId: string;
  people: number;
  expenses: number;
  totalCents: number;
  /** Why a sale earned nothing, when it earned nothing. Carried rather than
   *  swallowed because "no attribution" and "no commission rate" are both
   *  ordinary and are fixed in completely different places. */
  commission?: string;
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

function resolvePeriod(data: TimeApprovedData): { from: Date; to: Date } {
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

/** Nothing derived, nothing earned — the shape every non-labour path returns. */
function nothing(tenantId: string, commission: string): StaffHandlerOutcome {
  return {
    outcome: 'skipped',
    tenantId,
    people: 0,
    expenses: 0,
    totalCents: 0,
    unpricedMinutes: 0,
    commission,
  };
}

/** The commission outcome, in the handler's shape. Shared by the order and deal
 *  paths because the only thing that differs between them is which id was read. */
function commissioned(tenantId: string, amountCents: number): StaffHandlerOutcome {
  return {
    outcome: 'commissioned',
    tenantId,
    people: 1,
    expenses: 0,
    totalCents: amountCents,
    unpricedMinutes: 0,
    commission: 'recorded',
  };
}

export async function handle(event: StaffEvent, logger: Logger): Promise<StaffHandlerOutcome> {
  // Dispatched on a POSITIVE match per branch rather than by elimination. The
  // three payloads are a plain `z.union`, not a discriminated one, so narrowing
  // by ruling members out does not reach the labour branch — it would still
  // believe `event.data` might be `{ orderId }` and refuse to read a period off
  // it. Matching each shape by its own type keeps every branch's payload exact.
  if (event.type === 'staff.time.approved') return handleTimeApproved(event, logger);
  if (event.type === 'crm.deal.won') return handleDealWon(event, logger);
  return handleOrderMoney(event, logger);
}

async function handleOrderMoney(
  event: Extract<StaffEvent, { data: { orderId: string } }>,
  logger: Logger
): Promise<StaffHandlerOutcome> {
  const { tenantId } = event;
  {
    const result = await commissionForOrder(tenantId, event.data.orderId);
    logger.info({ tenantId, orderId: event.data.orderId, ...result }, 'staff commission on order');
    if (result.outcome !== 'recorded') return nothing(tenantId, result.outcome);
    return commissioned(tenantId, result.amountCents ?? 0);
  }
}

async function handleDealWon(
  event: Extract<StaffEvent, { type: 'crm.deal.won' }>,
  logger: Logger
): Promise<StaffHandlerOutcome> {
  const { tenantId } = event;
  const result = await commissionForDeal(tenantId, event.data.dealId);
  logger.info({ tenantId, dealId: event.data.dealId, ...result }, 'staff commission on deal');
  if (result.outcome !== 'recorded') return nothing(tenantId, result.outcome);
  return commissioned(tenantId, result.amountCents ?? 0);
}

async function handleTimeApproved(
  event: Extract<StaffEvent, { type: 'staff.time.approved' }>,
  logger: Logger
): Promise<StaffHandlerOutcome> {
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
