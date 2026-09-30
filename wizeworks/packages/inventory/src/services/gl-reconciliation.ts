// Stock versus the books (docs/146 Phase 10.9).
//
// The question an accountant asks every year end and nobody can answer: your
// system says the stock is worth £182,400 and my inventory account says
// £176,905 — where is the £5,495?
//
// ── Why sparx can answer it and an inventory system usually cannot ───────────
//
// Because the gap is almost never an error. It is four or five perfectly
// ordinary timing differences that a stock system knows about and a ledger does
// not, and the reconciliation is worth having precisely because it names them
// instead of leaving somebody to find them by hand:
//
//   goods received, not yet invoiced   on your shelf, no supplier bill yet.
//                                      Your books have not seen it.
//   invoiced, not yet received         billed, not on the shelf. Your books
//                                      have, and you have not.
//   stock that is not yours            consigned goods are in the building and
//                                      are not your asset. If the books value
//                                      them, that is the whole difference.
//   priced by you, not bought here     counted onto the shelf with a cost price
//                                      typed against the product. Every other
//                                      stock screen values it; this walk, which
//                                      only knows what was PURCHASED, does not.
//   units nobody costed                counted stock with no purchase behind
//                                      it and no cost price either. sparx values
//                                      it at nothing, honestly; an opening
//                                      journal may not have.
//   in transit between your locations  shipped from one and not booked into the
//                                      other.
//
// ── Where the ledger figure comes from, and why it can be null ───────────────
//
// sparx keeps no general ledger and never will (docs/148 §1), so the inventory
// account's balance is something sparx must be TOLD — typed from a trial
// balance, or imported through an accounting connection. Both land in
// `inventory_gl_snapshots`. When there is no figure, `ledgerValueCents` is NULL
// and the unexplained difference is NULL with it. It is not zero. A
// reconciliation that reports a zero difference because it has nothing to
// compare against is the single most dangerous number this phase could produce.

import { calendarDate, calendarDateOrNull } from '../calendar-date';
import { withTenant } from '@wizeworks/db';

import type { ServiceContext } from '../errors';

import { valuationAsOf } from './cost-reports';
import { reconciliationWords, type ReconciliationLine } from './gl-reconciliation-lines.js';

// The words on every row live next door, as a pure function, so the copy has a
// test that does not need a database. See `gl-reconciliation-lines.ts`.
export type {
  ReconciliationLine,
  ReconciliationLineKind,
  ReconciliationMeasurement,
} from './gl-reconciliation-lines.js';

export interface GlReconciliationReport {
  asOf: string;
  currency: string;
  /**
   * What the PURCHASE ledger says the stock is worth at `asOf`.
   *
   * On its own this is NOT the figure the valuation screen shows, and a version
   * of this comment claiming it was is how an $870 gap went unnamed on Juniper
   * Row. The valuation screen also honours a cost price typed against a product;
   * this walk only knows what was bought. The `priced_not_purchased` line is the
   * bridge, so `sparxValueCents + explainedCents` IS the number the business
   * reads, which is what has to be true for the reconciliation to mean anything.
   */
  sparxValueCents: number;
  /** What their books say. Null when nobody has told us. */
  ledgerValueCents: number | null;
  /** The account the ledger figure came from, and when it was taken. */
  ledgerAccountName: string | null;
  ledgerAsOf: string | null;
  ledgerSource: string | null;
  /** Sum of the timing differences below. */
  explainedCents: number;
  /** ledger − (sparx + explained). Null without a ledger figure. Zero here is
   *  the good outcome and means it reconciles exactly. */
  unexplainedCents: number | null;
  lines: ReconciliationLine[];
  /** True when there is nothing to reconcile against yet, so the surface can
   *  ask for the figure rather than showing a broken-looking report. */
  awaitingLedgerFigure: boolean;
}

export interface GlReconciliationFilter {
  asOf: Date;
  /** Reserved for a future period view — the report is a point-in-time
   *  statement today, and a range would imply a movement reconciliation, which
   *  is a different (and larger) thing. */
  from?: Date;
}

interface TimingRow {
  grni_cents: bigint;
  inr_cents: bigint;
  grni_lines: bigint;
  inr_lines: bigint;
}

/**
 * Reconcile sparx's stock value against the inventory account in the books.
 */
export async function glReconciliationReport(
  ctx: ServiceContext,
  filter: GlReconciliationFilter
): Promise<GlReconciliationReport> {
  const asOf = filter.asOf;
  const valuation = await valuationAsOf(ctx, { asOf, take: 1 });

  return withTenant(ctx, async (tx) => {
    // ── Received-but-not-invoiced, and its mirror ──────────────────────────
    //
    // Compared per PURCHASE-ORDER LINE, because that is the only grain where
    // both sides exist. A supplier who delivers in two drops and bills once has
    // no discrepancy at the line level and two at the document level, and a
    // reconciliation that reported two would send somebody looking for an error
    // that is not there.
    const [timing] = await tx.$queryRaw<TimingRow[]>`
      WITH received AS (
        SELECT grl.purchase_order_line_id AS pol_id,
               SUM(grl.quantity_received *
                   COALESCE(grl.landed_unit_cost_cents, grl.base_unit_cost_cents,
                            grl.unit_cost_cents))::bigint AS value_cents
        FROM inventory_goods_receipt_lines grl
        JOIN inventory_goods_receipts gr ON gr.id = grl.goods_receipt_id
        WHERE grl.tenant_id = ${ctx.tenantId}::uuid
          AND gr.received_at <= ${asOf}
        GROUP BY grl.purchase_order_line_id
      ), billed AS (
        SELECT sbl.purchase_order_line_id AS pol_id,
               SUM(sbl.amount_cents)::bigint AS value_cents
        FROM inventory_supplier_bill_lines sbl
        JOIN inventory_supplier_bills sb ON sb.id = sbl.supplier_bill_id
        WHERE sbl.tenant_id = ${ctx.tenantId}::uuid
          AND sbl.purchase_order_line_id IS NOT NULL
          AND sb.billed_at <= ${asOf}
          AND sb.status <> 'canceled'
        GROUP BY sbl.purchase_order_line_id
      ), paired AS (
        SELECT COALESCE(r.pol_id, b.pol_id) AS pol_id,
               COALESCE(r.value_cents, 0) - COALESCE(b.value_cents, 0) AS diff_cents
        FROM received r
        FULL OUTER JOIN billed b ON b.pol_id = r.pol_id
      )
      SELECT
        COALESCE(SUM(diff_cents) FILTER (WHERE diff_cents > 0), 0)::bigint  AS grni_cents,
        COALESCE(SUM(-diff_cents) FILTER (WHERE diff_cents < 0), 0)::bigint AS inr_cents,
        COUNT(*) FILTER (WHERE diff_cents > 0)::bigint                      AS grni_lines,
        COUNT(*) FILTER (WHERE diff_cents < 0)::bigint                      AS inr_lines
      FROM paired
    `;

    // ── Stock in the building that is not the tenant's asset ───────────────
    //
    // Current, not as-of: ownership is a property of the level and is not
    // versioned, so this is honest only for a recent `asOf`. Said so in the
    // description rather than silently applied to a year-old date.
    const [nonOwned] = await tx.$queryRaw<{ value_cents: bigint; levels: bigint }[]>`
      SELECT COALESCE(SUM(
               l.on_hand * COALESCE(l.avg_cost_cents, l.unit_cost_cents, v.cost_cents, 0)
             ), 0)::bigint AS value_cents,
             COUNT(*)::bigint AS levels
      FROM inventory_levels l
      JOIN commerce_product_variants v ON v.id = l.variant_id AND v.deleted_at IS NULL
      WHERE l.tenant_id = ${ctx.tenantId}::uuid
        AND l.ownership <> 'owned'
        AND l.on_hand > 0
    `;

    // ── Stock the owner priced, but never bought through us ────────────────
    //
    // The walk above values what the LEDGERS paid for. A shop stocks its shelves
    // on day one by counting what it already had, and a count cannot know a
    // price — so those units get a cost layer worth nothing. The owner may still
    // have told us what they cost, by typing a cost price against the product,
    // and every other stock screen on the platform honours that figure.
    //
    // Without this line the reconciliation starts from a number the business has
    // never seen: Juniper Row reads $1,837.92 on "Cost to keep" and on the
    // valuation screen, and this walk makes it $967.92. The $870.00 between them
    // is ordinary and explainable, which is exactly what this screen is for, so
    // it is NAMED here rather than left to surface as an unexplained difference
    // the moment somebody types their trial balance in.
    //
    // Current, not as-of, for the same reason the consignment line above is:
    // a cost price is a single current figure with no history to walk back.
    const [pricedOnly] = await tx.$queryRaw<
      { value_cents: bigint; levels: bigint; units: bigint }[]
    >`
      SELECT COALESCE(SUM(l.on_hand * COALESCE(l.avg_cost_cents, l.unit_cost_cents, v.cost_cents)), 0)::bigint
               AS value_cents,
             COUNT(*)::bigint AS levels,
             COALESCE(SUM(l.on_hand), 0)::bigint AS units
      FROM inventory_levels l
      JOIN commerce_product_variants v ON v.id = l.variant_id AND v.deleted_at IS NULL
      JOIN inventory_warehouses w ON w.id = l.warehouse_id AND w.deleted_at IS NULL
      WHERE l.tenant_id = ${ctx.tenantId}::uuid
        AND l.ownership = 'owned'
        AND l.on_hand > 0
        AND COALESCE(l.avg_cost_cents, l.unit_cost_cents, v.cost_cents) > 0
        AND NOT EXISTS (
          SELECT 1 FROM inventory_cost_layers cl
          WHERE cl.tenant_id = l.tenant_id
            AND cl.variant_id = l.variant_id
            AND cl.warehouse_id = l.warehouse_id
            AND cl.unit_cost_cents <> 0
        )
    `;

    // ── Stock in transit between the tenant's own locations ────────────────
    const [inTransit] = await tx.$queryRaw<{ value_cents: bigint; lines: bigint }[]>`
      SELECT COALESCE(SUM(
               tl.quantity * COALESCE(l.avg_cost_cents, l.unit_cost_cents, v.cost_cents, 0)
             ), 0)::bigint AS value_cents,
             COUNT(*)::bigint AS lines
      FROM inventory_transfer_lines tl
      JOIN inventory_transfers t ON t.id = tl.transfer_id
      JOIN commerce_product_variants v ON v.id = tl.variant_id
      LEFT JOIN inventory_levels l
        ON l.variant_id = tl.variant_id AND l.warehouse_id = t.from_warehouse_id
      WHERE tl.tenant_id = ${ctx.tenantId}::uuid
        AND t.status = 'in_transit'
        AND t.shipped_at <= ${asOf}
    `;

    // ── What their books say ───────────────────────────────────────────────
    const snapshot = await tx.inventoryGlSnapshot.findFirst({
      where: { asOf: { lte: asOf } },
      orderBy: [{ asOf: 'desc' }, { createdAt: 'desc' }],
    });

    // Units the cost layers cannot price, LESS the ones the line above already
    // explained — otherwise the same eighteen garments are reported twice, once
    // as money found and once as money unknown.
    const pricedOnlyCents = Number(pricedOnly?.value_cents ?? 0);
    const pricedOnlyUnits = Number(pricedOnly?.units ?? 0);
    const uncostedUnits = Math.max(0, valuation.uncostedUnits - pricedOnlyUnits);
    const grniCents = Number(timing?.grni_cents ?? 0);
    const inrCents = Number(timing?.inr_cents ?? 0);
    const nonOwnedCents = Number(nonOwned?.value_cents ?? 0);
    const inTransitCents = Number(inTransit?.value_cents ?? 0);

    const { lines, explainedCents, unexplainedCents } = reconciliationWords({
      totalUnits: valuation.totalUnits,
      totalValueCents: valuation.totalValueCents,
      grniCents,
      grniLines: Number(timing?.grni_lines ?? 0),
      inrCents,
      inrLines: Number(timing?.inr_lines ?? 0),
      nonOwnedCents,
      nonOwnedItems: Number(nonOwned?.levels ?? 0),
      pricedOnlyCents,
      pricedOnlyItems: Number(pricedOnly?.levels ?? 0),
      uncostedUnits,
      inTransitCents,
      inTransitLines: Number(inTransit?.lines ?? 0),
      ledger: snapshot
        ? {
            accountName: snapshot.accountName,
            balanceCents: snapshot.balanceCents,
            source: snapshot.source,
          }
        : null,
    });
    const ledgerValueCents = snapshot?.balanceCents ?? null;

    return {
      asOf: calendarDate(asOf),
      currency: snapshot?.currency ?? valuation.currency,
      sparxValueCents: valuation.totalValueCents,
      ledgerValueCents,
      ledgerAccountName: snapshot?.accountName ?? null,
      ledgerAsOf: calendarDateOrNull(snapshot?.asOf),
      ledgerSource: snapshot?.source ?? null,
      explainedCents,
      unexplainedCents,
      lines,
      awaitingLedgerFigure: snapshot === null,
    };
  });
}

// ─── Recording what the accountant says ──────────────────────────────────────

export interface RecordGlSnapshotInput {
  asOf: Date;
  accountName: string;
  accountCode?: string | null;
  balanceCents: number;
  currency?: string;
  source?: 'manual' | 'quickbooks_online' | 'xero';
  connectionId?: string | null;
  note?: string | null;
}

export interface GlSnapshotRow {
  id: string;
  asOf: string;
  accountName: string;
  accountCode: string | null;
  balanceCents: number;
  currency: string;
  source: string;
  note: string | null;
  capturedBy: string | null;
  createdAt: string;
}

/**
 * Record the inventory account's balance at a date.
 *
 * Upserts on (date, account): a second reading of the same account on the same
 * day is a correction, and two contradictory rows would make the reconciliation
 * depend on which one it happened to read.
 */
export async function recordGlSnapshot(
  ctx: ServiceContext,
  input: RecordGlSnapshotInput
): Promise<GlSnapshotRow> {
  return withTenant(ctx, async (tx) => {
    const existing = await tx.inventoryGlSnapshot.findFirst({
      where: { asOf: input.asOf, accountName: input.accountName },
      select: { id: true },
    });

    const data = {
      accountCode: input.accountCode ?? null,
      balanceCents: Math.trunc(input.balanceCents),
      currency: input.currency ?? 'USD',
      source: input.source ?? 'manual',
      connectionId: input.connectionId ?? null,
      capturedBy: ctx.userId ?? null,
      note: input.note ?? null,
    };

    const row = existing
      ? await tx.inventoryGlSnapshot.update({ where: { id: existing.id }, data })
      : await tx.inventoryGlSnapshot.create({
          data: {
            tenantId: ctx.tenantId,
            asOf: input.asOf,
            accountName: input.accountName,
            ...data,
          },
        });

    return toSnapshotRow(row);
  });
}

export async function listGlSnapshots(
  ctx: ServiceContext,
  filter: { take?: number } = {}
): Promise<GlSnapshotRow[]> {
  const take = Math.min(filter.take ?? 50, 200);
  return withTenant(ctx, async (tx) => {
    const rows = await tx.inventoryGlSnapshot.findMany({
      orderBy: [{ asOf: 'desc' }, { createdAt: 'desc' }],
      take,
    });
    return rows.map(toSnapshotRow);
  });
}

function toSnapshotRow(row: {
  id: string;
  asOf: Date;
  accountName: string;
  accountCode: string | null;
  balanceCents: number;
  currency: string;
  source: string;
  note: string | null;
  capturedBy: string | null;
  createdAt: Date;
}): GlSnapshotRow {
  return {
    id: row.id,
    asOf: calendarDate(row.asOf),
    accountName: row.accountName,
    accountCode: row.accountCode,
    balanceCents: row.balanceCents,
    currency: row.currency,
    source: row.source,
    note: row.note,
    capturedBy: row.capturedBy,
    createdAt: row.createdAt.toISOString(),
  };
}
