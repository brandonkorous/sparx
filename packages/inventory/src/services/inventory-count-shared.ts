// Inventory counts (docs/100 P4) — shared row shapes, query includes, the
// per-tenant number allocator, the cost-basis lookup, and the detail loader.
// Split out so the CRUD/lines module (./inventory-counts) and the lifecycle
// module (./inventory-count-lifecycle) share one serializer + detail shape.

import { Prisma } from '@sparx/db';
import type { TxClient } from '@sparx/db';

import { InventoryNotFoundError } from '../errors';

// ─── Row shapes ────────────────────────────────────────────────────────────────

export interface InventoryCountLineRow {
  id: string;
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  /**
   * What we thought was here, snapshotted when the line was made.
   *
   * NULL on a BLIND count that is still being counted — not zero, and not
   * omitted from the type. Blind counting only works if the number never
   * reaches the person holding the shelf, and a field typed `number` is a field
   * somebody eventually renders. It comes back at review, which is the moment
   * the variance is supposed to be looked at.
   */
  expectedQuantity: number | null;
  countedQuantity: number | null;
  /** counted − expected, null until counted, and null while a blind count is open. */
  variance: number | null;
  /** Cost basis for the variance value column (avg → unit → variant cost). */
  unitCostCents: number | null;
  /** The actual corrective delta the ledger applied on post (counted − live). */
  appliedDelta: number | null;
  movementId: string | null;
  note: string | null;
}

export interface InventoryCountRow {
  id: string;
  number: string;
  warehouseId: string;
  warehouseName: string | null;
  warehouseCode: string | null;
  type: 'cycle' | 'full';
  /**
   * What the count COVERS (docs/146 Phase 2). Load-bearing for the reader, not
   * decorative: it is what decides whether an item absent from the sheet means
   * "zero" or "not in scope" — a correction or a catastrophe.
   */
  scope: 'location' | 'zone' | 'bin';
  binId: string | null;
  binCode: string | null;
  zoneName: string | null;
  /** Expected quantities are withheld from the counter until review. */
  isBlind: boolean;
  status: 'counting' | 'review' | 'approved' | 'posted' | 'cancelled';
  note: string | null;
  approvalThresholdCents: number;
  requiresApproval: boolean;
  varianceValueCents: number;
  lineCount: number;
  countedLineCount: number;
  startedAt: string;
  countedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  postedAt: string | null;
  createdAt: string;
}

export interface InventoryCountDetail extends InventoryCountRow {
  lines: InventoryCountLineRow[];
}

const WAREHOUSE = { select: { name: true, code: true } };

export const LIST_INCLUDE = {
  warehouse: WAREHOUSE,
  lines: { select: { countedQuantity: true } },
} satisfies Prisma.InventoryCountInclude;

export const DETAIL_INCLUDE = {
  warehouse: WAREHOUSE,
  lines: {
    orderBy: { createdAt: 'asc' },
    include: {
      variant: { select: { sku: true, costCents: true, product: { select: { title: true } } } },
    },
  },
} satisfies Prisma.InventoryCountInclude;

type CountWithLineFlags = Prisma.InventoryCountGetPayload<{ include: typeof LIST_INCLUDE }>;
type CountWithLines = Prisma.InventoryCountGetPayload<{ include: typeof DETAIL_INCLUDE }>;

// ─── Helpers ───────────────────────────────────────────────────────────────────

export async function nextCountNumber(tx: TxClient, tenantId: string): Promise<string> {
  const count = await tx.inventoryCount.count({ where: { tenantId } });
  return `CNT-${(count + 1).toString().padStart(6, '0')}`;
}

export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

/**
 * Per-variant cost basis for a warehouse — the moving-average on the level,
 * falling back to the level's last unit cost. The caller fills the final
 * fallback (the variant's catalog cost) at serialize time.
 */
export async function costBasisFor(
  tx: TxClient,
  warehouseId: string,
  variantIds: string[]
): Promise<Map<string, number | null>> {
  if (variantIds.length === 0) return new Map();
  const levels = await tx.inventoryLevel.findMany({
    where: { warehouseId, variantId: { in: variantIds } },
    select: { variantId: true, avgCostCents: true, unitCostCents: true },
  });
  const map = new Map<string, number | null>();
  for (const l of levels) map.set(l.variantId, l.avgCostCents ?? l.unitCostCents ?? null);
  return map;
}

export async function loadCountDetail(tx: TxClient, id: string): Promise<InventoryCountDetail> {
  const row = await tx.inventoryCount.findFirst({ where: { id }, include: DETAIL_INCLUDE });
  if (!row) throw new InventoryNotFoundError('InventoryCount', id);
  const costBasis = await costBasisFor(
    tx,
    row.warehouseId,
    row.lines.map((l) => l.variantId)
  );
  // A shelf-scoped count is meaningless without the shelf's name on it. Fetched
  // separately rather than through a relation because the count carries a bare
  // `bin_id` column; one indexed lookup on a detail read is not worth a schema
  // change to avoid.
  const bin = row.binId
    ? await tx.inventoryBin.findUnique({ where: { id: row.binId }, select: { code: true } })
    : null;
  return serializeDetail(row, costBasis, bin?.code ?? null);
}

// ─── Serializers ─────────────────────────────────────────────────────────────

export function serializeRow(
  r: CountWithLineFlags,
  binCode: string | null = null
): InventoryCountRow {
  return {
    id: r.id,
    number: r.number,
    warehouseId: r.warehouseId,
    warehouseName: r.warehouse?.name ?? null,
    warehouseCode: r.warehouse?.code ?? null,
    type: r.type as InventoryCountRow['type'],
    scope: r.scope as InventoryCountRow['scope'],
    binId: r.binId,
    binCode,
    zoneName: r.zoneName,
    isBlind: r.isBlind,
    status: r.status as InventoryCountRow['status'],
    note: r.note,
    approvalThresholdCents: r.approvalThresholdCents,
    requiresApproval: r.requiresApproval,
    varianceValueCents: r.varianceValueCents,
    lineCount: r.lines.length,
    countedLineCount: r.lines.filter((l) => l.countedQuantity !== null).length,
    startedAt: r.startedAt.toISOString(),
    countedAt: r.countedAt?.toISOString() ?? null,
    approvedAt: r.approvedAt?.toISOString() ?? null,
    approvedBy: r.approvedBy,
    postedAt: r.postedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

export function serializeDetail(
  r: CountWithLines,
  costBasis: Map<string, number | null>,
  binCode: string | null = null
): InventoryCountDetail {
  const base = serializeRow(
    {
      ...r,
      lines: r.lines.map((l) => ({ countedQuantity: l.countedQuantity })),
    },
    binCode
  );

  // The blind gate. Withheld only while the count is OPEN: once it is submitted
  // for review the counting is done, the numbers are frozen, and hiding the
  // variance from the person who has to approve it would be theatre.
  const withhold = r.isBlind && r.status === 'counting';

  return {
    ...base,
    lines: r.lines.map((l) => ({
      id: l.id,
      variantId: l.variantId,
      variantSku: l.variant?.sku ?? null,
      productTitle: l.variant?.product?.title ?? null,
      expectedQuantity: withhold ? null : l.expectedQuantity,
      countedQuantity: l.countedQuantity,
      variance:
        withhold || l.countedQuantity === null ? null : l.countedQuantity - l.expectedQuantity,
      unitCostCents: costBasis.get(l.variantId) ?? l.variant?.costCents ?? null,
      appliedDelta: l.appliedDelta,
      movementId: l.movementId,
      note: l.note,
    })),
  };
}
