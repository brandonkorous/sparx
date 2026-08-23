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
//   units nobody costed                counted stock with no purchase behind
//                                      it. sparx values it at nothing, honestly;
//                                      an opening journal may not have.
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

import { withTenant } from '@wizeworks/db';

import type { ServiceContext } from '../errors';

import { valuationAsOf } from './cost-reports';

/** Each line either RAISES what the books should show relative to sparx, or
 *  lowers it. The sign is on `amountCents` and the direction is stated in the
 *  description, because an accountant reading a signed column with no words
 *  around it will read the sign the other way half the time. */
export type ReconciliationLineKind =
  | 'sparx_value'
  | 'goods_received_not_invoiced'
  | 'invoiced_not_received'
  | 'non_owned_stock'
  | 'uncosted_units'
  | 'in_transit'
  | 'ledger_value'
  | 'unexplained';

export interface ReconciliationLine {
  kind: ReconciliationLineKind;
  /** Written for whoever is doing the reconciling — an owner or their
   *  bookkeeper, not an engineer. */
  description: string;
  /** Signed, in the tenant's reporting currency. Null where the figure could
   *  not be established, which is different from a difference of nothing. */
  amountCents: number | null;
  /** Where the number came from: `sparx` for anything derived from the ledger,
   *  the provider slug for anything read out of their accounting system, or
   *  `accountant` for a typed figure. */
  source: string;
  /** How many underlying rows the figure covers, or the account name for the
   *  ledger line — enough to go and look. */
  reference: string | null;
}

export interface GlReconciliationReport {
  asOf: string;
  currency: string;
  /** What sparx says the stock is worth at `asOf` — the same figure the
   *  valuation screen shows, deliberately, so the reconciliation reconciles the
   *  number the business actually reads. */
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
          AND sb.status <> 'cancelled'
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

    const uncostedUnits = valuation.uncostedUnits;
    const grniCents = Number(timing?.grni_cents ?? 0);
    const inrCents = Number(timing?.inr_cents ?? 0);
    const nonOwnedCents = Number(nonOwned?.value_cents ?? 0);
    const inTransitCents = Number(inTransit?.value_cents ?? 0);

    const lines: ReconciliationLine[] = [
      {
        kind: 'sparx_value',
        description: 'What your stock is valued at here, from your deliveries and sales',
        amountCents: valuation.totalValueCents,
        source: 'sparx',
        reference: `${valuation.totalUnits} units on hand`,
      },
      {
        kind: 'goods_received_not_invoiced',
        description:
          'On your shelves with no supplier invoice yet — counted here, but not in your books until the bill arrives',
        amountCents: grniCents,
        source: 'sparx',
        reference: `${Number(timing?.grni_lines ?? 0)} order lines`,
      },
      {
        kind: 'invoiced_not_received',
        description:
          'Invoiced by a supplier but not yet booked in — your books have it, your shelves do not',
        amountCents: -inrCents,
        source: 'sparx',
        reference: `${Number(timing?.inr_lines ?? 0)} order lines`,
      },
      {
        kind: 'non_owned_stock',
        description:
          'Consigned or customer-owned stock in your building. It is left out of your value here; if your books include it, this is the difference (measured today, not at the date above — ownership is not dated)',
        amountCents: nonOwnedCents,
        source: 'sparx',
        reference: `${Number(nonOwned?.levels ?? 0)} lines`,
      },
      {
        kind: 'uncosted_units',
        description:
          uncostedUnits > 0
            ? `${uncostedUnits} units counted with no purchase behind them. They are valued at nothing here; an opening balance in your books may not have`
            : 'Every unit on hand has a cost behind it',
        // Deliberately null and not zero: the units exist and their value is
        // genuinely unknown. Reporting £0 would assert they are worthless.
        amountCents: uncostedUnits > 0 ? null : 0,
        source: 'sparx',
        reference: uncostedUnits > 0 ? `${uncostedUnits} units` : null,
      },
      {
        kind: 'in_transit',
        description: 'Shipped from one of your locations and not yet booked into the other',
        amountCents: inTransitCents,
        source: 'sparx',
        reference: `${Number(inTransit?.lines ?? 0)} transfer lines`,
      },
    ];

    const explainedCents = grniCents - inrCents + nonOwnedCents + inTransitCents;
    const ledgerValueCents = snapshot?.balanceCents ?? null;
    const unexplainedCents =
      ledgerValueCents === null
        ? null
        : ledgerValueCents - (valuation.totalValueCents + explainedCents);

    lines.push({
      kind: 'ledger_value',
      description: snapshot
        ? 'What your accounting system says the inventory account holds'
        : 'Nobody has entered what your inventory account says yet',
      amountCents: ledgerValueCents,
      source: snapshot?.source ?? 'accountant',
      reference: snapshot ? snapshot.accountName : null,
    });

    lines.push({
      kind: 'unexplained',
      description:
        unexplainedCents === null
          ? 'Cannot be worked out until your inventory account balance is entered'
          : unexplainedCents === 0
            ? 'Nothing unexplained — the two agree once the timing differences are allowed for'
            : 'Left over after every timing difference above. This is the part worth investigating',
      amountCents: unexplainedCents,
      source: 'sparx',
      reference: null,
    });

    return {
      asOf: asOf.toISOString(),
      currency: snapshot?.currency ?? valuation.currency,
      sparxValueCents: valuation.totalValueCents,
      ledgerValueCents,
      ledgerAccountName: snapshot?.accountName ?? null,
      ledgerAsOf: snapshot ? snapshot.asOf.toISOString() : null,
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
    asOf: row.asOf.toISOString(),
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
