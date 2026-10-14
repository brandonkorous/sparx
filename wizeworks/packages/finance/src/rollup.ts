// The daily profit rollup — the one number this module exists to produce.
//
// A CACHE OF A SUBTRACTION. Every input is owned somewhere else and read here:
// revenue from the commerce/invoicing rollups, cost of goods from the inventory
// movement ledger, channel fees from the orders themselves, and the three expense
// slices from this module's own ledger. Nothing is copied into `finance_expenses`
// to make this work (docs/148 §1, locked decision #3) — two sources of truth for
// one number is how a report starts disagreeing with the screen it links to.
//
// Because it is a cache, it is safe to truncate and recompute, and `recomputeDay`
// is written to be re-run for any day whose sources moved.

import { withTenant, type TxClient } from '@wizeworks/db';
import { businessDayRange } from '@wizeworks/time';
import { businessZone } from './business-clock';
import { ORDER_MOVEMENT_REFERENCE } from './stock-movements';

/* ── The arithmetic (pure, so it is tested without a database) ─────────────── */

export interface ProfitInputs {
  /** Money in, net of refunds. */
  revenueCents: number;
  /** Cost of what was sold, from the inventory movement ledger. */
  cogsCents: number;
  /** Channel/marketplace fees on the orders. */
  feeCents: number;
  /** Ledger spend filed under a `cost_of_sale` category. */
  costOfSaleCents: number;
  /** Ledger spend filed under a `labor` category. */
  laborCents: number;
  /** Ledger spend filed under an `operating` category. */
  operatingCents: number;
  /** Ledger spend tied to no job at all — the cost of being open. */
  unallocatedCents: number;
}

export interface ProfitFigures extends ProfitInputs {
  grossProfitCents: number;
  netProfitCents: number;
}

/**
 * Revenue minus what it took to earn it, in the order an owner reads it.
 *
 * GROSS is what the work itself made: revenue less the direct cost of delivering
 * it (goods, fees, and the ledger's cost-of-sale categories like parts and
 * subcontractors). NET then takes off the cost of having a business at all —
 * people, and everything under operating.
 *
 * Labour sits below the gross line rather than inside it. That is a deliberate
 * simplification: properly, a technician's hours on a job ARE cost of sale, but
 * splitting payroll between "on a job" and "in the workshop" requires timesheets
 * the platform does not have until the staff module ships (docs/149). Until then,
 * putting all labour above the line would overstate cost of sale for every
 * business whose staff also do admin. Once time entries exist, allocated labour
 * moves above the line and the residue stays here.
 */
export function computeProfit(inputs: ProfitInputs): ProfitFigures {
  const grossProfitCents =
    inputs.revenueCents - (inputs.cogsCents + inputs.feeCents + inputs.costOfSaleCents);
  const netProfitCents = grossProfitCents - (inputs.laborCents + inputs.operatingCents);
  return { ...inputs, grossProfitCents, netProfitCents };
}

/** The UTC day containing `date`, as a half-open range. The range for an
 *  expense's day, which is a DATE stored at midnight UTC; a moment (a sale, a
 *  payment, stock leaving) is read over the BUSINESS's day instead, with
 *  `businessDayRange` (sparx persona issue 174). */
export function utcDayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0)
  );
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/** Midnight-UTC date, which is what a `DATE` column round-trips as. */
export function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * The EXCLUSIVE upper bound for a range whose end is an inclusive calendar DAY.
 *
 * Every spend surface sends `?from=&to=` as `YYYY-MM-DD`, and the picker that
 * builds them says so: "Ranges are calendar-boundary DATES, not instants."
 * `z.coerce.date()` turns "2026-09-09" into midnight, so a query written
 * `lte: to` covers none of that last day at all.
 *
 * That is not a rounding error, it is a whole day missing. A shop recorded her
 * first cost at 10:37, was told "Cost recorded", and the Spending list she had
 * just used stayed at "$0.00 · 0 costs" — for "This month", whose range ends
 * TODAY. Everything she entered would have been invisible until tomorrow. The
 * accounting export carried the same bound, so the last day of every period she
 * sent her accountant was silently short.
 *
 * Filter date-only timestamp columns (`incurredAt`, a day stored at midnight
 * UTC) `gte: from, lt: endOfDayExclusive(to)`. A column holding a MOMENT (an
 * order's `placedAt`, a booking's `startAt`) is cut on the business's day edges
 * instead, with `businessDayStart` / `businessDayRange` from `@wizeworks/time`,
 * or an evening in Denver lands in the next day (sparx persona issue 174). A DAY
 * column (`bucket`) is a different case and is correctly `lte: utcMidnight(to)`,
 * because the stored values ARE midnights.
 */
export function endOfDayExclusive(date: Date): Date {
  return utcDayRange(date).end;
}

/* ── Bucketing helpers ─────────────────────────────────────────────────────── */

/** `null` is a real bucket (spend or revenue attributable to no one site), and it
 *  is NOT the same as "no bucket" — so it gets a sentinel key rather than being
 *  dropped by a `Map<string|null>` lookup that stringifies it by accident.
 *
 *  Written as an ESCAPE, not as a raw NUL byte. The literal control character sat
 *  in the source until now, which made every content search (grep, ripgrep, and
 *  the repo-wide audits built on them) classify this file as BINARY and skip it
 *  silently — a file that answers "no match" to every question is worse than one
 *  that errors. The value is byte-identical, and it never leaves this module:
 *  `keyToProperty` turns it back into `null` before anything is written. */
const UNATTRIBUTED = '\u0000unattributed';

function bucketKey(propertyId: string | null): string {
  return propertyId ?? UNATTRIBUTED;
}

function keyToProperty(key: string): string | null {
  return key === UNATTRIBUTED ? null : key;
}

function addTo(map: Map<string, number>, propertyId: string | null, cents: number): void {
  const key = bucketKey(propertyId);
  map.set(key, (map.get(key) ?? 0) + cents);
}

/* ── The recompute ─────────────────────────────────────────────────────────── */

export interface RecomputedDay extends ProfitFigures {
  propertyId: string | null;
  bucket: Date;
}

/**
 * What a payment on an invoice sold, in cents (sparx persona issue 172).
 *
 * The invoice's total carries sales tax (the state's) and core deposits (the
 * customer's until the old part comes back), so a payment counts only its
 * sales share of them: `amount × (total − tax − deposits) ÷ total`. A refund
 * takes its share off. An invoice with no total to share by counts in full.
 */
export function paymentSalesCents(payment: {
  amount: number;
  kind: string;
  documentTotal: number;
  documentTax: number;
  documentCores: number;
}): number {
  const signed = payment.kind === 'refund' ? -payment.amount : payment.amount;
  if (payment.documentTotal <= 0) return Math.round(signed * 100);
  const share = Math.min(
    Math.max(
      (payment.documentTotal - payment.documentTax - payment.documentCores) / payment.documentTotal,
      0
    ),
    1
  );
  return Math.round(signed * 100 * share);
}

/**
 * Recompute every site's profit row for one day, and write them.
 *
 * `day` is a calendar DATE (midnight UTC, as every caller passes it), and the
 * row it writes is that day on the BUSINESS's calendar. Sales, payments and
 * stock movements are moments, read over the business's midnight to midnight;
 * expenses are dates, read as written. All of it was read over the UTC day, so a
 * shop in Denver had every evening's takings filed under the next day, and the
 * last evening of a month under the next month (sparx persona issue 174).
 *
 * Recomputes ALL sites in one pass rather than taking a `propertyId`, because
 * the expensive inputs (the movement ledger, the order scan) are read per-day
 * regardless — doing them once and bucketing beats running the same scan per
 * site, and it means a site that dropped to zero still gets its row zeroed
 * rather than keeping yesterday's figure forever.
 */
export async function recomputeDay(
  tenantId: string,
  day: Date,
  tx?: TxClient
): Promise<RecomputedDay[]> {
  const bucket = utcMidnight(day);
  // An expense's day is the date written on it. Shifting it through the zone
  // would file every expense in Denver on the day before.
  const expenseDay = utcDayRange(day);

  const run = async (client: TxClient): Promise<RecomputedDay[]> => {
    // Every moment below is read over the business's day.
    const { start, end } = businessDayRange(bucket, await businessZone(client, tenantId));

    const revenue = new Map<string, number>();
    const cogs = new Map<string, number>();
    const fees = new Map<string, number>();
    const costOfSale = new Map<string, number>();
    const labor = new Map<string, number>();
    const operating = new Map<string, number>();
    const expenseTotal = new Map<string, number>();
    const allocated = new Map<string, number>();

    /* Revenue. Orders from the commerce rollup, which owns what an order SOLD
     * (`order-sales.ts`: no tax, no deposits held, no order awaiting approval),
     * so Finance and the commerce charts can never disagree about it.
     *
     * Invoices only when they did NOT come from an order, and only as they are
     * paid. An order's sale is counted the day it is placed; its invoice's
     * payment used to be added on top from the invoicing rollup, which counts
     * every payment, so a fleet order paid on account was counted twice. And a
     * payment carries the invoice's tax and deposits in proportion, so only its
     * sales share counts (sparx persona issue 172). */
    const [commerceRows, invoicePayments] = await Promise.all([
      client.rollupCommerceDailyRevenue.findMany({ where: { bucket } }),
      client.billingDocumentPayment.findMany({
        // A credit sold nothing: it took money off a bill (sparx persona issue 185).
        where: {
          receivedAt: { gte: start, lt: end },
          kind: { not: 'credit' },
          document: { orderId: null },
        },
        select: {
          amount: true,
          kind: true,
          document: {
            select: { propertyId: true, total: true, taxTotal: true, coreChargeTotal: true },
          },
        },
      }),
    ]);
    for (const row of commerceRows) addTo(revenue, row.propertyId, Number(row.netCents));
    for (const payment of invoicePayments) {
      addTo(
        revenue,
        payment.document.propertyId,
        paymentSalesCents({
          amount: Number(payment.amount),
          kind: payment.kind,
          documentTotal: Number(payment.document.total),
          documentTax: Number(payment.document.taxTotal),
          documentCores: Number(payment.document.coreChargeTotal),
        })
      );
    }

    /* Cost of goods — the signed `cost_consumed_cents` on outbound movements.
     * Summing it over a period IS period COGS: a reversal carries a negative
     * cost, so a cancelled order credits back with no special case.
     *
     * Site attribution goes through the movement's order reference. A movement
     * with no order (a loss, a damage, a manual correction) genuinely belongs to
     * no site, so it lands in the unattributed bucket rather than being
     * arbitrarily charged to the primary one. */
    const movements = await client.inventoryMovement.findMany({
      where: { createdAt: { gte: start, lt: end }, costConsumedCents: { not: null } },
      select: { referenceType: true, referenceId: true, costConsumedCents: true },
    });
    const orderIds = [
      ...new Set(
        movements
          .filter((m) => m.referenceType === ORDER_MOVEMENT_REFERENCE && m.referenceId)
          .map((m) => m.referenceId!)
      ),
    ];
    const orderSites = new Map<string, string | null>();
    if (orderIds.length > 0) {
      const orders = await client.order.findMany({
        where: { id: { in: orderIds } },
        select: { id: true, propertyId: true },
      });
      for (const order of orders) orderSites.set(order.id, order.propertyId);
    }
    for (const movement of movements) {
      const site =
        movement.referenceType === ORDER_MOVEMENT_REFERENCE && movement.referenceId
          ? (orderSites.get(movement.referenceId) ?? null)
          : null;
      addTo(cogs, site, movement.costConsumedCents ?? 0);
    }

    /* Channel fees — what a marketplace kept. Bucketed on `placedAt`, matching
     * how the commerce revenue rollup buckets the same orders, so a fee never
     * lands on a different day than the sale it was taken from.
     *
     * NOTE: payment-processor fees are NOT included, because the platform does
     * not capture them today — there is no fee column on the payment tables. The
     * honest consequence is that `feeCents` currently means channel fees only.
     * Wire processor fees in here (not into the expense ledger) when they land. */
    const feeOrders = await client.order.findMany({
      where: { placedAt: { gte: start, lt: end }, channelFeeCents: { not: null } },
      select: { propertyId: true, channelFeeCents: true },
    });
    for (const order of feeOrders) addTo(fees, order.propertyId, order.channelFeeCents ?? 0);

    /* The ledger, split by category kind. Categories are per-tenant and few
     * (~20), so one read plus a grouped sum beats a join Prisma cannot express. */
    const categories = await client.financeExpenseCategory.findMany({
      select: { id: true, kind: true },
    });
    const kindById = new Map(categories.map((c) => [c.id, c.kind]));

    const grouped = await client.financeExpense.groupBy({
      by: ['propertyId', 'categoryId'],
      where: { incurredAt: { gte: expenseDay.start, lt: expenseDay.end }, deletedAt: null },
      _sum: { amountCents: true },
    });
    for (const row of grouped) {
      const cents = row._sum.amountCents ?? 0;
      addTo(expenseTotal, row.propertyId, cents);
      switch (kindById.get(row.categoryId)) {
        case 'cost_of_sale':
          addTo(costOfSale, row.propertyId, cents);
          break;
        case 'labor':
          addTo(labor, row.propertyId, cents);
          break;
        default:
          addTo(operating, row.propertyId, cents);
      }
    }

    /* What of that spend was pinned to a job. The remainder is overhead. */
    const allocations = await client.financeExpenseAllocation.findMany({
      where: {
        expense: { incurredAt: { gte: expenseDay.start, lt: expenseDay.end }, deletedAt: null },
      },
      select: { amountCents: true, expense: { select: { propertyId: true } } },
    });
    for (const a of allocations) addTo(allocated, a.expense.propertyId, a.amountCents);

    /* Every site that appeared in ANY input needs a row — including one whose
     * only activity was a cost, which is exactly the day an owner wants to see. */
    const keys = new Set<string>([
      ...revenue.keys(),
      ...cogs.keys(),
      ...fees.keys(),
      ...expenseTotal.keys(),
    ]);
    // And every site ALREADY stored for this day, so a site whose day dropped to
    // nothing is rewritten to zero, as this function's own description promises.
    // It was not: only sites in today's inputs were written, so an order that
    // left the day (cancelled, or now awaiting approval) kept its old figure in
    // Gillett's profit beside the new zero (sparx persona issue 172).
    const stored = await client.rollupFinanceDailyProfit.findMany({
      where: { bucket },
      select: { propertyId: true },
    });
    for (const row of stored) keys.add(bucketKey(row.propertyId));
    // A day with nothing in it still gets one zero row. Without it a quiet day
    // was indistinguishable from a day never worked out, and the profit screen
    // read "never worked out" as "no money came in" (sparx persona issue 172).
    if (keys.size === 0) keys.add(UNATTRIBUTED);

    const rows: RecomputedDay[] = [];
    for (const key of keys) {
      const propertyId = keyToProperty(key);
      const figures = computeProfit({
        revenueCents: revenue.get(key) ?? 0,
        cogsCents: cogs.get(key) ?? 0,
        feeCents: fees.get(key) ?? 0,
        costOfSaleCents: costOfSale.get(key) ?? 0,
        laborCents: labor.get(key) ?? 0,
        operatingCents: operating.get(key) ?? 0,
        unallocatedCents: (expenseTotal.get(key) ?? 0) - (allocated.get(key) ?? 0),
      });

      const data = {
        revenueCents: BigInt(figures.revenueCents),
        cogsCents: BigInt(figures.cogsCents),
        feeCents: BigInt(figures.feeCents),
        laborCents: BigInt(figures.laborCents),
        costOfSaleCents: BigInt(figures.costOfSaleCents),
        operatingCents: BigInt(figures.operatingCents),
        grossProfitCents: BigInt(figures.grossProfitCents),
        netProfitCents: BigInt(figures.netProfitCents),
        unallocatedCents: BigInt(figures.unallocatedCents),
        computedAt: new Date(),
      };

      // No compound-unique upsert: the grain's unique index is NULLS NOT
      // DISTINCT (hand-SQL), which Prisma does not model, so a `where` on the
      // triple cannot address the null-property row. Find-then-write is exact.
      const existing = await client.rollupFinanceDailyProfit.findFirst({
        where: { propertyId, bucket },
      });
      if (existing) {
        await client.rollupFinanceDailyProfit.update({ where: { id: existing.id }, data });
      } else {
        await client.rollupFinanceDailyProfit.create({
          data: { tenantId, propertyId, bucket, ...data },
        });
      }

      rows.push({ ...figures, propertyId, bucket });
    }

    return rows;
  };

  return tx ? run(tx) : withTenant({ tenantId }, run);
}

/** Recompute an inclusive range, oldest first. What a backfill and the nightly
 *  reconcile both call; `recomputeDay` is the unit. */
export async function recomputeRange(
  tenantId: string,
  from: Date,
  to: Date
): Promise<RecomputedDay[]> {
  const rows: RecomputedDay[] = [];
  for (let day = utcMidnight(from); day <= utcMidnight(to); day = addDays(day, 1)) {
    rows.push(...(await recomputeDay(tenantId, day)));
  }
  return rows;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Sum a stored range into one set of figures — what the Profit surface reads for
 *  "this month" without re-deriving anything. */
export async function profitForRange(
  tenantId: string,
  from: Date,
  to: Date,
  propertyId?: string | null
): Promise<ProfitFigures & { computedAt: Date | null }> {
  return withTenant({ tenantId }, async (tx) => {
    const rows = await tx.rollupFinanceDailyProfit.findMany({
      where: {
        bucket: { gte: utcMidnight(from), lte: utcMidnight(to) },
        ...(propertyId !== undefined ? { propertyId } : {}),
      },
    });

    /**
     * WHEN these figures were worked out — null when they never have been.
     *
     * This is a cache, and it is filled ONCE A DAY: the revenue rollup at 06:00
     * UTC, the profit rollup at 06:45. Everything a shop takes or spends after
     * that is absent from this answer until tomorrow morning, or until somebody
     * presses Rebuild.
     *
     * The screen had no way to say so. Its refresh marker showed the moment the
     * BROWSER last fetched, so a page opened at 5pm read "updated just now" over
     * figures from breakfast — a freshness marker measuring the wrong thing, and
     * therefore worse than none. The column has been written on every rebuild
     * from the start (`computedAt: new Date()`) and read by nobody.
     */
    const computedAt = rows.reduce<Date | null>(
      (latest, row) => (latest === null || row.computedAt > latest ? row.computedAt : latest),
      null
    );

    const figures = computeProfit({
      revenueCents: sum(rows, (r) => r.revenueCents),
      cogsCents: sum(rows, (r) => r.cogsCents),
      feeCents: sum(rows, (r) => r.feeCents),
      costOfSaleCents: sum(rows, (r) => r.costOfSaleCents),
      laborCents: sum(rows, (r) => r.laborCents),
      operatingCents: sum(rows, (r) => r.operatingCents),
      unallocatedCents: sum(rows, (r) => r.unallocatedCents),
    });
    return { ...figures, computedAt };
  });
}

function sum<T>(rows: T[], pick: (row: T) => bigint): number {
  return rows.reduce((total, row) => total + Number(pick(row)), 0);
}
