// The inventory journal, from the ledger (docs/146 Phase 10.7–10.8).
//
// One read: every costed movement in a period, grouped by reason. The
// arithmetic that turns that into double entry is pure and lives in
// `@wizeworks/commerce-schemas/accounting`, so the entry posted to QuickBooks, the
// entry posted to Xero and the entry shown on screen before either is sent are
// literally the same object.
//
// ── This does not make sparx a bookkeeper ────────────────────────────────────
//
// docs/148 §1 makes "no general ledger, no double entry, no chart of accounts" a
// permanent product position, and nothing here softens it. No journal is stored.
// It is computed from `inventory_movements` at the moment somebody asks, handed
// over, and forgotten — which is exactly the "we hand the accountant a clean,
// mapped export for the statutory question" half of that position.
//
// ── Why the read is by REASON and not by movement ────────────────────────────
//
// An accountant wants one entry a month with five lines. The reason vocabulary
// is precisely the level of detail that maps onto accounts: `sale` is cost of
// goods, `loss` and `damage` are shrinkage, `receive` is the accrual. Anything
// finer would be four thousand lines nobody reads; anything coarser would put
// theft inside the margin.

import {
  buildInventoryJournal,
  checkJournalSendable,
  type InventoryJournal,
  type JournalGateResult,
  type JournalSourceRow,
} from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';

import type { ServiceContext } from '../errors';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface JournalPeriod {
  from?: Date;
  to?: Date;
  warehouseId?: string | null;
}

interface JournalSqlRow {
  reason: string;
  cost_cents: bigint;
  movements: bigint;
  uncosted_movements: bigint;
}

/**
 * The period's journal.
 *
 * ── Where the money on each line comes from ──────────────────────────────────
 *
 * OUTBOUND movements carry `cost_consumed_cents`, stamped at the moment the
 * stock went, so last quarter's margin does not move when this week's delivery
 * shifts the average. That column is signed and a reversal is negative, which is
 * why summing it needs no special cases.
 *
 * INBOUND movements do not carry it — a receipt's cost basis is
 * `unit_cost_cents`, and stamping the same figure twice under two names is how
 * two numbers start to disagree. So the value of a receipt is reconstructed as
 * units × the cost recorded on the movement, and a receipt with no cost recorded
 * counts toward `uncostedMovements` rather than toward the entry.
 */
export async function inventoryJournalForPeriod(
  ctx: ServiceContext,
  period: JournalPeriod = {}
): Promise<InventoryJournal> {
  const to = period.to ?? new Date();
  const from = period.from ?? new Date(to.getTime() - 30 * DAY_MS);
  const warehouse = period.warehouseId ?? null;

  return withTenant(ctx, async (tx) => {
    const rows = await tx.$queryRaw<JournalSqlRow[]>`
      SELECT m.reason,
             COALESCE(
               SUM(
                 CASE
                   -- Value leaving: the cost stamped when it left.
                   WHEN m.cost_consumed_cents IS NOT NULL THEN m.cost_consumed_cents
                   -- Value arriving: units × what the movement recorded paying.
                   WHEN m.delta > 0 AND m.unit_cost_cents IS NOT NULL
                     THEN m.delta * m.unit_cost_cents
                   ELSE 0
                 END
               ), 0
             )::bigint AS cost_cents,
             COUNT(*)::bigint AS movements,
             COUNT(*) FILTER (
               WHERE m.cost_consumed_cents IS NULL
                 AND NOT (m.delta > 0 AND m.unit_cost_cents IS NOT NULL)
             )::bigint AS uncosted_movements
      FROM inventory_movements m
      WHERE m.tenant_id = ${ctx.tenantId}::uuid
        AND m.created_at >= ${from} AND m.created_at < ${to}
        AND (${warehouse}::uuid IS NULL OR m.warehouse_id = ${warehouse}::uuid)
      GROUP BY m.reason
    `;

    const policy = await tx.costingPolicy.findFirst({ select: { baseCurrency: true } });

    // An inbound reason's cost arrives positive from the SQL above and means
    // "value entered the asset"; an outbound reason's `cost_consumed_cents` is
    // also positive and means "value left". `buildInventoryJournal` knows which
    // is which from the reason, which is why the sign is not resolved here.
    const source: JournalSourceRow[] = rows.map((row) => ({
      reason: row.reason,
      costCents: Number(row.cost_cents),
      movements: Number(row.movements),
      uncostedMovements: Number(row.uncosted_movements),
    }));

    return buildInventoryJournal({
      rows: source,
      periodStart: from,
      periodEnd: to,
      currency: policy?.baseCurrency ?? 'USD',
    });
  });
}

export interface JournalPreview {
  journal: InventoryJournal;
  gate: JournalGateResult;
  /** The reference the entry will carry in their books, so a person can search
   *  for it there. Derived from the period rather than random: a re-send of the
   *  same month must find the same entry rather than posting a second one. */
  reference: string;
  memo: string;
}

/** A stable, human-searchable reference for one period's entry. */
export function journalReference(from: Date, to: Date): string {
  const stamp = (date: Date): string => date.toISOString().slice(0, 10).replace(/-/g, '');
  return `SPARX-STOCK-${stamp(from)}-${stamp(to)}`;
}

export function journalMemo(journal: InventoryJournal): string {
  const fmt = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  return `sparx stock movement, ${fmt.format(new Date(journal.periodStart))} to ${fmt.format(
    new Date(journal.periodEnd)
  )}`;
}

/**
 * The journal plus whether it may be sent.
 *
 * `mappedRoles` comes from the connection's mapping table and
 * `booksClosedThrough` from its `sync_from_date`. Both are the caller's to
 * supply because this package must not depend on @wizeworks/finance — a business
 * with no store still runs its books, and inventory reaching into the finance
 * module would invert that.
 */
export async function previewInventoryJournal(
  ctx: ServiceContext,
  period: JournalPeriod,
  gateInput: { mappedRoles: ReadonlySet<string>; booksClosedThrough: Date | null }
): Promise<JournalPreview> {
  const journal = await inventoryJournalForPeriod(ctx, period);
  return {
    journal,
    gate: checkJournalSendable(journal, gateInput.mappedRoles, gateInput.booksClosedThrough),
    reference: journalReference(new Date(journal.periodStart), new Date(journal.periodEnd)),
    memo: journalMemo(journal),
  };
}
