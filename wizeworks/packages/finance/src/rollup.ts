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

/** The UTC day containing `date`, as the half-open range every query below uses. */
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
 * Recompute every site's profit row for one UTC day, and write them.
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
  const { start, end } = utcDayRange(day);

  const run = async (client: TxClient): Promise<RecomputedDay[]> => {
    const revenue = new Map<string, number>();
    const cogs = new Map<string, number>();
    const fees = new Map<string, number>();
    const costOfSale = new Map<string, number>();
    const labor = new Map<string, number>();
    const operating = new Map<string, number>();
    const expenseTotal = new Map<string, number>();
    const allocated = new Map<string, number>();

    /* Revenue — read from the rollups that already own it, so Finance and the
     * commerce/invoicing surfaces can never disagree about what came in. */
    const [commerceRows, invoicingRows] = await Promise.all([
      client.rollupCommerceDailyRevenue.findMany({ where: { bucket } }),
      client.rollupInvoicingDailyCollected.findMany({ where: { bucket } }),
    ]);
    for (const row of commerceRows) addTo(revenue, row.propertyId, Number(row.netCents));
    for (const row of invoicingRows) addTo(revenue, row.propertyId, Number(row.collectedCents));

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
          .filter((m) => m.referenceType === 'order' && m.referenceId)
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
        movement.referenceType === 'order' && movement.referenceId
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
      where: { incurredAt: { gte: start, lt: end }, deletedAt: null },
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
      where: { expense: { incurredAt: { gte: start, lt: end }, deletedAt: null } },
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
): Promise<ProfitFigures> {
  return withTenant({ tenantId }, async (tx) => {
    const rows = await tx.rollupFinanceDailyProfit.findMany({
      where: {
        bucket: { gte: utcMidnight(from), lte: utcMidnight(to) },
        ...(propertyId !== undefined ? { propertyId } : {}),
      },
    });

    return computeProfit({
      revenueCents: sum(rows, (r) => r.revenueCents),
      cogsCents: sum(rows, (r) => r.cogsCents),
      feeCents: sum(rows, (r) => r.feeCents),
      costOfSaleCents: sum(rows, (r) => r.costOfSaleCents),
      laborCents: sum(rows, (r) => r.laborCents),
      operatingCents: sum(rows, (r) => r.operatingCents),
      unallocatedCents: sum(rows, (r) => r.unallocatedCents),
    });
  });
}

function sum<T>(rows: T[], pick: (row: T) => bigint): number {
  return rows.reduce((total, row) => total + Number(pick(row)), 0);
}
