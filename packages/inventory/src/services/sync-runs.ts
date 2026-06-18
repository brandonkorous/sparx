// Sync-health reads + the unmapped-SKU review queue (docs/100 P5 Tier C).
//
// The ingest funnel (feed-ingest.ts) WRITES sync runs + the unmapped queue; this
// is the READ + resolve side the dashboard's connection detail / sync-health panel
// uses: list a source's recent runs, the health rollup, the pending-unmapped queue
// (with a suggested variant when an external SKU matches one of ours by SKU), and
// the two queue actions — map an unmapped SKU to a (variant, warehouse) (which
// mints a link + clears the row) or ignore it.
//
// Broad-scan reads scope `tenantId` explicitly: the local `sparx_owner` is a
// SUPERUSER that bypasses RLS, so a tenant-wide count can otherwise leak other
// tenants' rows in tests (defense-in-depth; prod is fine via `sparx_app`).

import { withTenant } from '@sparx/db';
import type { Prisma, TxClient } from '@sparx/db';
import type { CreateSourceLinkInput, MapUnmappedSkuInput } from '@sparx/commerce-schemas';

import { InventoryConflictError, InventoryNotFoundError } from '../errors';
import type { ServiceContext } from '../errors';

import { setSafetyBufferOnTx } from './levels';

export interface SyncRunRow {
  id: string;
  trigger: string;
  status: string;
  rowsTotal: number;
  rowsMatched: number;
  rowsChanged: number;
  rowsUnchanged: number;
  rowsUnmatched: number;
  rowsSkipped: number;
  rowsStale: number;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface UnmappedSkuRow {
  id: string;
  externalSku: string;
  externalLocation: string | null;
  lastQuantity: number;
  seenCount: number;
  status: string;
  firstSeenAt: string;
  lastSeenAt: string;
  // A variant whose SKU equals this external SKU, when one exists — powers the
  // one-click "map to suggested" in the queue UI.
  suggestedVariantId: string | null;
  suggestedVariantSku: string | null;
  suggestedProductTitle: string | null;
}

export interface SyncHealth {
  sourceId: string;
  status: string;
  lastSyncAt: string | null;
  latestRun: SyncRunRow | null;
  recentRuns: SyncRunRow[];
  pendingUnmappedCount: number;
  activeLinkCount: number;
  /** Active links whose external SKU stopped appearing in full-snapshot syncs. */
  staleLinkCount: number;
}

export interface ListSyncRunsFilter {
  sourceId: string;
  take?: number;
  skip?: number;
}

export interface ListUnmappedFilter {
  sourceId: string;
  status?: string;
  take?: number;
  skip?: number;
}

type RunRecord = Prisma.InventorySyncRunGetPayload<Record<string, never>>;

function serializeRun(r: RunRecord): SyncRunRow {
  return {
    id: r.id,
    trigger: r.trigger,
    status: r.status,
    rowsTotal: r.rowsTotal,
    rowsMatched: r.rowsMatched,
    rowsChanged: r.rowsChanged,
    rowsUnchanged: r.rowsUnchanged,
    rowsUnmatched: r.rowsUnmatched,
    rowsSkipped: r.rowsSkipped,
    rowsStale: r.rowsStale,
    error: r.error,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
  };
}

export async function listSyncRuns(
  ctx: ServiceContext,
  filter: ListSyncRunsFilter
): Promise<{ rows: SyncRunRow[]; total: number }> {
  const take = Math.min(Math.max(filter.take ?? 20, 1), 100);
  const skip = Math.max(filter.skip ?? 0, 0);
  const where: Prisma.InventorySyncRunWhereInput = {
    tenantId: ctx.tenantId,
    sourceId: filter.sourceId,
  };

  const { rows, total } = await withTenant(ctx, async (tx) => {
    const [records, count] = await Promise.all([
      tx.inventorySyncRun.findMany({ where, orderBy: { startedAt: 'desc' }, take, skip }),
      tx.inventorySyncRun.count({ where }),
    ]);
    return { rows: records.map(serializeRun), total: count };
  });
  return { rows, total };
}

export async function getSyncHealth(ctx: ServiceContext, sourceId: string): Promise<SyncHealth> {
  return withTenant(ctx, async (tx) => {
    const source = await tx.inventorySource.findFirst({
      where: { id: sourceId, tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true, status: true, lastSyncAt: true },
    });
    if (!source) throw new InventoryNotFoundError('InventorySource', sourceId);

    const [recent, pendingUnmappedCount, activeLinkCount, staleLinkCount] = await Promise.all([
      tx.inventorySyncRun.findMany({
        where: { tenantId: ctx.tenantId, sourceId },
        orderBy: { startedAt: 'desc' },
        take: 8,
      }),
      tx.inventoryUnmappedSku.count({
        where: { tenantId: ctx.tenantId, sourceId, status: 'pending' },
      }),
      tx.inventorySourceLink.count({
        where: { tenantId: ctx.tenantId, sourceId, status: 'active' },
      }),
      tx.inventorySourceLink.count({
        where: { tenantId: ctx.tenantId, sourceId, status: 'active', isStale: true },
      }),
    ]);

    const recentRuns = recent.map(serializeRun);
    return {
      sourceId: source.id,
      status: source.status,
      lastSyncAt: source.lastSyncAt ? source.lastSyncAt.toISOString() : null,
      latestRun: recentRuns[0] ?? null,
      recentRuns,
      pendingUnmappedCount,
      activeLinkCount,
      staleLinkCount,
    };
  });
}

export async function listUnmappedSkus(
  ctx: ServiceContext,
  filter: ListUnmappedFilter
): Promise<{ rows: UnmappedSkuRow[]; total: number }> {
  const take = Math.min(Math.max(filter.take ?? 100, 1), 500);
  const skip = Math.max(filter.skip ?? 0, 0);
  const where: Prisma.InventoryUnmappedSkuWhereInput = {
    tenantId: ctx.tenantId,
    sourceId: filter.sourceId,
    status: filter.status ?? 'pending',
  };

  return withTenant(ctx, async (tx) => {
    const [records, total] = await Promise.all([
      tx.inventoryUnmappedSku.findMany({
        where,
        orderBy: [{ status: 'asc' }, { lastSeenAt: 'desc' }],
        take,
        skip,
      }),
      tx.inventoryUnmappedSku.count({ where }),
    ]);

    // One lookup for all candidate SKUs → suggested variant by exact SKU match.
    const skus = [...new Set(records.map((r) => r.externalSku))];
    const variants = skus.length
      ? await tx.productVariant.findMany({
          where: { tenantId: ctx.tenantId, sku: { in: skus } },
          select: { id: true, sku: true, product: { select: { title: true } } },
        })
      : [];
    const bySku = new Map(variants.map((v) => [v.sku, v]));

    const rows: UnmappedSkuRow[] = records.map((r) => {
      const match = bySku.get(r.externalSku);
      return {
        id: r.id,
        externalSku: r.externalSku,
        externalLocation: r.externalLocation,
        lastQuantity: r.lastQuantity,
        seenCount: r.seenCount,
        status: r.status,
        firstSeenAt: r.firstSeenAt.toISOString(),
        lastSeenAt: r.lastSeenAt.toISOString(),
        suggestedVariantId: match?.id ?? null,
        suggestedVariantSku: match?.sku ?? null,
        suggestedProductTitle: match?.product.title ?? null,
      };
    });
    return { rows, total };
  });
}

interface CreateLinkData {
  sourceId: string;
  variantId: string;
  warehouseId: string;
  externalSku: string;
  externalLocation: string | null;
  externalUom?: string | null;
  unitsPerExternal?: number;
  safetyBuffer?: number;
}

/**
 * Mint a source mapping (link) inside an existing tx. Enforces the conflict rules
 * (docs/28 §6): the source must exist, the variant/warehouse must exist, ONE source
 * per variant (a variant already claimed by a different source is rejected), and no
 * duplicate (external SKU, location) on the source. UoM fields land on the link; a
 * provided safety buffer is written to the (variant, warehouse) level.
 */
async function createSourceLinkOnTx(
  tx: TxClient,
  ctx: ServiceContext,
  data: CreateLinkData
): Promise<{ linkId: string }> {
  const source = await tx.inventorySource.findFirst({
    where: { id: data.sourceId, tenantId: ctx.tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!source) throw new InventoryNotFoundError('InventorySource', data.sourceId);

  const variant = await tx.productVariant.findFirst({
    where: { id: data.variantId, tenantId: ctx.tenantId },
    select: { id: true },
  });
  if (!variant) throw new InventoryNotFoundError('ProductVariant', data.variantId);
  const warehouse = await tx.warehouse.findFirst({
    where: { id: data.warehouseId, tenantId: ctx.tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!warehouse) throw new InventoryNotFoundError('Warehouse', data.warehouseId);

  // One source per variant — a variant already linked from a DIFFERENT source can't
  // be claimed here (the same source may map it across warehouses).
  const claimedElsewhere = await tx.inventorySourceLink.findFirst({
    where: {
      tenantId: ctx.tenantId,
      variantId: data.variantId,
      status: 'active',
      sourceId: { not: data.sourceId },
    },
    select: { id: true },
  });
  if (claimedElsewhere) {
    throw new InventoryConflictError(
      'This item is already linked to another inventory source — one source per item.'
    );
  }

  const dup = await tx.inventorySourceLink.findFirst({
    where: {
      tenantId: ctx.tenantId,
      sourceId: data.sourceId,
      externalSku: data.externalSku,
      externalLocation: data.externalLocation,
    },
    select: { id: true },
  });
  if (dup) {
    throw new InventoryConflictError('A link already exists for this SKU/location on this source');
  }

  const link = await tx.inventorySourceLink.create({
    data: {
      tenantId: ctx.tenantId,
      sourceId: data.sourceId,
      variantId: data.variantId,
      warehouseId: data.warehouseId,
      externalSku: data.externalSku,
      externalLocation: data.externalLocation,
      ...(data.externalUom !== undefined ? { externalUom: data.externalUom } : {}),
      ...(data.unitsPerExternal !== undefined ? { unitsPerExternal: data.unitsPerExternal } : {}),
    },
    select: { id: true },
  });

  if (data.safetyBuffer !== undefined) {
    await setSafetyBufferOnTx(tx, ctx, {
      variantId: data.variantId,
      warehouseId: data.warehouseId,
      safetyBuffer: data.safetyBuffer,
    });
  }

  return { linkId: link.id };
}

/** Create a source mapping by hand (the SKU-mappings panel + the links route). */
export async function createSourceLink(
  ctx: ServiceContext,
  sourceId: string,
  input: CreateSourceLinkInput
): Promise<{ linkId: string }> {
  return withTenant(ctx, (tx) =>
    createSourceLinkOnTx(tx, ctx, {
      sourceId,
      variantId: input.variantId,
      warehouseId: input.warehouseId,
      externalSku: input.externalSku,
      externalLocation: input.externalLocation,
      externalUom: input.externalUom ?? null,
      unitsPerExternal: input.unitsPerExternal,
      safetyBuffer: input.safetyBuffer,
    })
  );
}

/** Bind an unmapped external SKU to a (variant, warehouse): mints an
 *  InventorySourceLink (so the next sync matches it) and clears the queue row. */
export async function mapUnmappedSku(
  ctx: ServiceContext,
  unmappedId: string,
  input: MapUnmappedSkuInput
): Promise<{ linkId: string }> {
  return withTenant(ctx, async (tx) => {
    const unmapped = await tx.inventoryUnmappedSku.findFirst({
      where: { id: unmappedId, tenantId: ctx.tenantId },
    });
    if (!unmapped) throw new InventoryNotFoundError('InventoryUnmappedSku', unmappedId);

    const result = await createSourceLinkOnTx(tx, ctx, {
      sourceId: unmapped.sourceId,
      variantId: input.variantId,
      warehouseId: input.warehouseId,
      externalSku: unmapped.externalSku,
      externalLocation: unmapped.externalLocation,
      externalUom: input.externalUom ?? null,
      unitsPerExternal: input.unitsPerExternal,
      safetyBuffer: input.safetyBuffer,
    });
    await tx.inventoryUnmappedSku.delete({ where: { id: unmapped.id } });
    return result;
  });
}

/** Suppress an unmapped SKU so it stops surfacing in the queue. A later feed that
 *  reports it again bumps the row's quantity/seenCount but keeps it `ignored`. */
export async function ignoreUnmappedSku(ctx: ServiceContext, unmappedId: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const unmapped = await tx.inventoryUnmappedSku.findFirst({
      where: { id: unmappedId, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!unmapped) throw new InventoryNotFoundError('InventoryUnmappedSku', unmappedId);
    await tx.inventoryUnmappedSku.update({
      where: { id: unmapped.id },
      data: { status: 'ignored', updatedAt: new Date() },
    });
  });
}
