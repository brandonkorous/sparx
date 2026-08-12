// Job profitability (docs/148 §5) — which pieces of work actually made money.
//
// This is the screen that justifies the module. The daily rollup answers "did the
// business make money"; this answers "on WHAT", which is the question that changes
// behaviour — a shop learns to stop quoting the job that loses on every unit.
//
// Same discipline as the rollup: nothing here is materialised. Revenue, cost of
// goods and channel fees are read from their owners at query time, and the only
// thing this module contributes is the allocated slice of its own ledger. A job's
// margin therefore cannot drift from the order it describes.
//
// REVENUE BASIS IS PART OF THE ANSWER. An order knows what it actually collected.
// A booking does not — scheduling stores no collected amount, so the best available
// figure is the service's list price, which is an ASSUMPTION about a discount that
// may have been given. Every row says which one it is (`revenueBasis`) and the
// surface prints it, because a list-price margin quietly mixed in with collected
// ones is a number that misleads exactly the person relying on it.

import { withTenant } from '@sparx/db';

export type JobType = 'order' | 'booking';

/** Where a row's revenue figure came from — see the file header. */
export type RevenueBasis =
  /** Real money: the order total, less refunds. */
  | 'collected'
  /** The service's list price. What it SHOULD have been, absent a discount. */
  | 'list_price';

export interface JobProfit {
  type: JobType;
  id: string;
  /** What a person calls this job: an order number, or the service booked. */
  label: string;
  customerName: string | null;
  propertyId: string | null;
  occurredAt: Date;
  currency: string;
  revenueCents: number;
  revenueBasis: RevenueBasis;
  /** Cost of the goods consumed, from the inventory movement ledger. */
  cogsCents: number;
  /** What a marketplace kept. Zero for a job that never touched one. */
  feeCents: number;
  /** Ledger spend pinned to this job — parts bought for it, a subcontractor. */
  allocatedCents: number;
  marginCents: number;
  /**
   * Margin as a share of revenue, or NULL when there is no revenue to divide by.
   *
   * Not zero. A job with £0 revenue and £80 of cost has no meaningful margin
   * RATE, and rendering "0%" would rank it as merely break-even next to a job
   * that genuinely broke even. The surface prints an em-dash and sorts by the
   * cash figure instead.
   */
  marginRate: number | null;
}

/** What a job cost and what it therefore kept — pure, so it is tested without a
 *  database and cannot drift between the two row builders below. */
export function jobMargin(input: {
  revenueCents: number;
  cogsCents: number;
  feeCents: number;
  allocatedCents: number;
}): { costCents: number; marginCents: number; marginRate: number | null } {
  const costCents = input.cogsCents + input.feeCents + input.allocatedCents;
  const marginCents = input.revenueCents - costCents;
  return {
    costCents,
    marginCents,
    // NOT zero when there is no revenue — see the `marginRate` doc above.
    marginRate: input.revenueCents > 0 ? marginCents / input.revenueCents : null,
  };
}

export interface JobProfitQuery {
  from: Date;
  to: Date;
  propertyId?: string | null;
  /** Which kinds of work to include. Default: both. */
  types?: readonly JobType[];
  /** Worst-first is the useful default — the losses are the actionable end. */
  sort?: 'margin_asc' | 'margin_desc' | 'revenue_desc' | 'recent';
  limit?: number;
}

/** Decimal(12,2) → cents. Exact for a two-place column: the double error on
 *  `x * 100` is orders of magnitude below the 0.5 that `round` needs to be
 *  wrong. (This is NOT true of free-text money, which is why the CSV importer
 *  parses digits as a string instead.) */
function toCents(value: { toString(): string } | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Math.round(Number(value) * 100);
}

const DEFAULT_LIMIT = 100;

/**
 * Rank the period's jobs by what each one made.
 *
 * Deliberately bounded: this reads per-job detail rather than a rollup, so it is
 * a "top/bottom N" screen, not an export. The accounting export (§6) is the path
 * for everything.
 */
export async function jobProfitability(
  tenantId: string,
  query: JobProfitQuery
): Promise<JobProfit[]> {
  const types = query.types ?? (['order', 'booking'] as const);
  const limit = query.limit ?? DEFAULT_LIMIT;
  const wantsOrders = types.includes('order');
  const wantsBookings = types.includes('booking');

  return withTenant({ tenantId }, async (tx) => {
    const siteFilter =
      query.propertyId !== undefined && query.propertyId !== null
        ? { propertyId: query.propertyId }
        : {};

    /* The orders in the window, with the revenue and fee they already carry. */
    const orders = wantsOrders
      ? await tx.order.findMany({
          where: {
            placedAt: { gte: query.from, lte: query.to },
            // A cancelled order is not a job anyone did — including it would
            // rank a row whose costs were never incurred.
            status: { notIn: ['cancelled'] },
            ...siteFilter,
          },
          select: {
            id: true,
            orderNumber: true,
            propertyId: true,
            placedAt: true,
            currency: true,
            total: true,
            refundTotal: true,
            channelFeeCents: true,
            customer: { select: { firstName: true, lastName: true, email: true } },
          },
          // Bounded before the per-job joins below. Newest first so a truncated
          // window is at least a coherent recent one.
          orderBy: [{ placedAt: 'desc' }, { id: 'desc' }],
          take: limit * 4,
        })
      : [];

    /* Completed bookings only. A requested-but-not-yet-happened appointment has
     * no margin to report, and a no-show's costs belong to the day, not the job. */
    const bookings = wantsBookings
      ? await tx.booking.findMany({
          where: {
            startAt: { gte: query.from, lte: query.to },
            status: 'completed',
            deletedAt: null,
            ...siteFilter,
          },
          select: {
            id: true,
            propertyId: true,
            startAt: true,
            service: { select: { name: true, priceCents: true } },
            customer: { select: { firstName: true, lastName: true, email: true } },
          },
          orderBy: [{ startAt: 'desc' }, { id: 'desc' }],
          take: limit * 4,
        })
      : [];

    const orderIds = orders.map((o) => o.id);
    const bookingIds = bookings.map((b) => b.id);
    const allIds = [...orderIds, ...bookingIds];
    if (allIds.length === 0) return [];

    /* Cost of goods per order, from the movement ledger — the same signed column
     * the daily rollup sums, so a job's COGS and the day's COGS come from one
     * source. Bookings consume stock through their order, if they have one; a
     * booking with no order simply has no goods cost. */
    const movements =
      orderIds.length > 0
        ? await tx.inventoryMovement.findMany({
            where: {
              referenceType: 'order',
              referenceId: { in: orderIds },
              costConsumedCents: { not: null },
            },
            select: { referenceId: true, costConsumedCents: true },
          })
        : [];
    const cogsById = new Map<string, number>();
    for (const m of movements) {
      if (!m.referenceId) continue;
      cogsById.set(m.referenceId, (cogsById.get(m.referenceId) ?? 0) + (m.costConsumedCents ?? 0));
    }

    /* This module's own contribution: ledger spend pinned to each job. */
    const allocations = await tx.financeExpenseAllocation.findMany({
      where: {
        targetType: { in: [...types] },
        targetId: { in: allIds },
        expense: { deletedAt: null },
      },
      select: { targetType: true, targetId: true, amountCents: true },
    });
    const allocatedById = new Map<string, number>();
    for (const a of allocations) {
      const key = `${a.targetType}:${a.targetId}`;
      allocatedById.set(key, (allocatedById.get(key) ?? 0) + a.amountCents);
    }

    const rows: JobProfit[] = [];

    for (const order of orders) {
      const revenueCents = toCents(order.total) - toCents(order.refundTotal);
      const cogsCents = cogsById.get(order.id) ?? 0;
      const feeCents = order.channelFeeCents ?? 0;
      const allocatedCents = allocatedById.get(`order:${order.id}`) ?? 0;
      const { marginCents, marginRate } = jobMargin({
        revenueCents,
        cogsCents,
        feeCents,
        allocatedCents,
      });
      rows.push({
        type: 'order',
        id: order.id,
        label: order.orderNumber,
        customerName: personName(order.customer),
        propertyId: order.propertyId,
        occurredAt: order.placedAt,
        currency: order.currency,
        revenueCents,
        revenueBasis: 'collected',
        cogsCents,
        feeCents,
        allocatedCents,
        marginCents,
        marginRate,
      });
    }

    for (const booking of bookings) {
      const revenueCents = booking.service.priceCents;
      const allocatedCents = allocatedById.get(`booking:${booking.id}`) ?? 0;
      const { marginCents, marginRate } = jobMargin({
        revenueCents,
        cogsCents: 0,
        feeCents: 0,
        allocatedCents,
      });
      rows.push({
        type: 'booking',
        id: booking.id,
        label: booking.service.name,
        customerName: personName(booking.customer),
        propertyId: booking.propertyId,
        occurredAt: booking.startAt,
        // Scheduling prices are tenant-currency; there is no per-booking currency
        // column to read, and inventing one per row would imply a precision the
        // data does not have.
        currency: 'USD',
        revenueCents,
        revenueBasis: 'list_price',
        cogsCents: 0,
        feeCents: 0,
        allocatedCents,
        marginCents,
        marginRate,
      });
    }

    sortJobs(rows, query.sort ?? 'margin_asc');
    return rows.slice(0, limit);
  });
}

function personName(
  person: { firstName: string | null; lastName: string | null; email: string | null } | null
): string | null {
  if (!person) return null;
  // An EMPTY name falls through to the email, so `??` is wrong here — a contact
  // with both names null joins to '', which is not nullish but is not a name.
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
  if (name !== '') return name;
  return person.email ?? null;
}

/** In place — the caller owns the array and slices it straight after. */
export function sortJobs(rows: JobProfit[], sort: NonNullable<JobProfitQuery['sort']>): void {
  switch (sort) {
    case 'margin_desc':
      rows.sort((a, b) => b.marginCents - a.marginCents);
      return;
    case 'revenue_desc':
      rows.sort((a, b) => b.revenueCents - a.revenueCents);
      return;
    case 'recent':
      rows.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
      return;
    case 'margin_asc':
    default:
      rows.sort((a, b) => a.marginCents - b.marginCents);
  }
}
