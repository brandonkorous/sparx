// The movement / audit-log read path (docs/100 P4, docs/99 D5) — a filterable,
// paginated view over the `inventory_movements` ledger. Read-only: the ledger is
// append-only and written solely by `applyMovement`; this module surfaces "who
// moved this stock, when, why, and by how much" for the compliance/audit UI.
// No new tables — every mutation already records a row here.

import { withTenant } from '@wizeworks/db';
import type { Prisma } from '@wizeworks/db';

import type { ServiceContext } from '../errors';

export interface MovementRow {
  id: string;
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  warehouseId: string;
  warehouseName: string | null;
  warehouseCode: string | null;
  /** Signed change to on-hand. */
  delta: number;
  /** Running on-hand AFTER this movement (cheap point-in-time audit). */
  balanceAfter: number | null;
  reason: string;
  referenceType: string | null;
  referenceId: string | null;
  actorType: string;
  actorId: string | null;
  source: string | null;
  note: string | null;
  unitCostCents: number | null;
  createdAt: string;
}

export interface ListMovementsFilter {
  /** Free-text over the moving item: its variant SKU, variant name, or product
   *  title. Case-insensitive `contains`. */
  q?: string;
  variantId?: string;
  /**
   * Every movement for ONE product, across all of its variants, in a single
   * request.
   *
   * Exists for the same reason `listInventory`'s `productId` does: a
   * product-scoped stock view showing "what happened to this product's stock"
   * otherwise has to issue one request per variant and merge the pages in the
   * browser — which on a 40-variant product is 40 round trips that still cannot
   * be ordered correctly, because each page is only the newest 50 of ITS OWN
   * variant.
   */
  productId?: string;
  warehouseId?: string;
  reason?: string;
  actorType?: string;
  actorId?: string;
  referenceType?: string;
  referenceId?: string;
  /** Inclusive ISO bounds on createdAt. */
  from?: string;
  to?: string;
  take?: number;
  skip?: number;
}

const INCLUDE = {
  variant: { select: { sku: true, title: true, product: { select: { title: true } } } },
  warehouse: { select: { name: true, code: true } },
} satisfies Prisma.InventoryMovementInclude;

type MovementWithRefs = Prisma.InventoryMovementGetPayload<{ include: typeof INCLUDE }>;

export async function listMovements(
  ctx: ServiceContext,
  filter: ListMovementsFilter = {}
): Promise<{ items: MovementRow[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    // Scope `tenant_id` explicitly (not just via RLS): the local `sparx_owner` is a
    // SUPERUSER and BYPASSES RLS, so a tenant-wide scan would leak other tenants'
    // rows in tests; defense-in-depth in prod (where `sparx_app` enforces RLS too).
    const where: Prisma.InventoryMovementWhereInput = {
      tenantId: ctx.tenantId,
      ...buildWhere(filter),
    };
    const [rows, total] = await Promise.all([
      tx.inventoryMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(filter.take ?? 50, 250),
        skip: filter.skip ?? 0,
        include: INCLUDE,
      }),
      tx.inventoryMovement.count({ where }),
    ]);
    return { items: rows.map(serializeMovement), total };
  });
}

function buildWhere(filter: ListMovementsFilter): Prisma.InventoryMovementWhereInput {
  const createdAt =
    filter.from || filter.to
      ? {
          ...(filter.from ? { gte: new Date(filter.from) } : {}),
          ...(filter.to ? { lte: new Date(filter.to) } : {}),
        }
      : undefined;
  // Both `productId` and free-text `q` narrow through the same `variant`
  // relation (the ledger row carries a variant, and the variant carries the
  // product), so they are composed into ONE `variant` filter — two separate
  // `variant:` keys on the object would have the second silently overwrite the
  // first.
  const variant: Prisma.ProductVariantWhereInput = {
    ...(filter.productId ? { productId: filter.productId } : {}),
    ...(filter.q
      ? {
          OR: [
            { sku: { contains: filter.q, mode: 'insensitive' } },
            { title: { contains: filter.q, mode: 'insensitive' } },
            { product: { title: { contains: filter.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
  return {
    ...(filter.variantId ? { variantId: filter.variantId } : {}),
    ...(Object.keys(variant).length > 0 ? { variant } : {}),
    ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
    ...(filter.reason ? { reason: filter.reason } : {}),
    ...(filter.actorType ? { actorType: filter.actorType } : {}),
    ...(filter.actorId ? { actorId: filter.actorId } : {}),
    ...(filter.referenceType ? { referenceType: filter.referenceType } : {}),
    ...(filter.referenceId ? { referenceId: filter.referenceId } : {}),
    ...(createdAt ? { createdAt } : {}),
  };
}

// ─── Export (docs/146 Phase 1) ─────────────────────────────────────────────────
//
// The audit trail is only an audit trail if it can leave the building — an
// accountant, an insurer, and a marketplace dispute all want the rows, not a
// screenshot of page one. The export takes the SAME filter as the list, so what
// someone exports is exactly what they were looking at; a filter set that the
// export quietly ignores is how "we exported to Excel and the numbers didn't
// match" becomes a support ticket.

/** Cap on one export. Above this the answer is a narrower date range, not a
 *  bigger file: a million-row synchronous CSV times out the request and helps
 *  nobody. The header row states the cap when it is hit, so a truncated export
 *  can never be mistaken for a complete one. */
const EXPORT_MAX_ROWS = 50_000;

export interface MovementExport {
  csv: string;
  rows: number;
  /** True when the result was capped — the caller must surface this. */
  truncated: boolean;
}

const EXPORT_COLUMNS = [
  'movement_id',
  'occurred_at',
  'sku',
  'product',
  'warehouse_code',
  'warehouse',
  'reason',
  'delta',
  'balance_after',
  'unit_cost_cents',
  'actor_type',
  'actor_id',
  'source',
  'reference_type',
  'reference_id',
  'note',
] as const;

/** RFC-4180 quoting. Everything is quoted rather than only the fields that need
 *  it: a SKU containing a comma and one that does not should not produce
 *  differently-shaped rows, because that difference is what breaks naive parsers
 *  halfway down a file. */
function csvCell(value: string | number | null): string {
  if (value === null) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

export async function exportMovements(
  ctx: ServiceContext,
  filter: ListMovementsFilter = {}
): Promise<MovementExport> {
  const rows = await withTenant(ctx, async (tx) =>
    tx.inventoryMovement.findMany({
      where: { tenantId: ctx.tenantId, ...buildWhere(filter) },
      orderBy: { createdAt: 'desc' },
      take: EXPORT_MAX_ROWS + 1,
      include: INCLUDE,
    })
  );

  const truncated = rows.length > EXPORT_MAX_ROWS;
  const body = (truncated ? rows.slice(0, EXPORT_MAX_ROWS) : rows).map(serializeMovement);

  const lines = [
    EXPORT_COLUMNS.join(','),
    ...body.map((m) =>
      [
        csvCell(m.id),
        csvCell(m.createdAt),
        csvCell(m.variantSku),
        csvCell(m.productTitle),
        csvCell(m.warehouseCode),
        csvCell(m.warehouseName),
        csvCell(m.reason),
        csvCell(m.delta),
        csvCell(m.balanceAfter),
        csvCell(m.unitCostCents),
        csvCell(m.actorType),
        csvCell(m.actorId),
        csvCell(m.source),
        csvCell(m.referenceType),
        csvCell(m.referenceId),
        csvCell(m.note),
      ].join(',')
    ),
  ];

  return { csv: `${lines.join('\r\n')}\r\n`, rows: body.length, truncated };
}

function serializeMovement(m: MovementWithRefs): MovementRow {
  return {
    id: m.id,
    variantId: m.variantId,
    variantSku: m.variant?.sku ?? null,
    productTitle: m.variant?.product?.title ?? m.variant?.title ?? null,
    warehouseId: m.warehouseId,
    warehouseName: m.warehouse?.name ?? null,
    warehouseCode: m.warehouse?.code ?? null,
    delta: m.delta,
    balanceAfter: m.balanceAfter,
    reason: m.reason,
    referenceType: m.referenceType,
    referenceId: m.referenceId,
    actorType: m.actorType,
    actorId: m.actorId,
    source: m.source,
    note: m.note,
    unitCostCents: m.unitCostCents,
    createdAt: m.createdAt.toISOString(),
  };
}
