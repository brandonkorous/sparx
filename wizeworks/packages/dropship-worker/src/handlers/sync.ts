// Catalog sync handler — triggered by dropship.supplier.sync_started.
// Fetches the supplier from the DB, constructs the right adapter, runs
// syncCatalog(), and upserts every yielded product into dropship_products.

import type { Logger } from 'pino';
import type { Prisma } from '@prisma/client';
import { withTenant } from '@wizeworks/db';
import { createPublisher, publishEvent, type Publisher } from '@wizeworks/events';
import { createAdapter } from '@wizeworks/dropship';

export interface SyncStartedPayload {
  supplierId: string;
  type: string;
}

// A supplier cost that moved on this sync, keyed by the dropship product whose
// linked catalog variants need a recompute signal.
interface CostChange {
  dropshipProductId: string;
  prevCost: number | null;
  newCost: number;
}

export async function handleSyncStarted(
  payload: SyncStartedPayload,
  tenantId: string,
  log: Logger
): Promise<void> {
  const { supplierId } = payload;

  log.info({ supplierId, tenantId }, 'dropship sync started');

  // Load supplier credentials from DB.
  const supplier = await withTenant({ tenantId }, async (tx) => {
    return tx.dropshipSupplier.findFirst({
      where: { id: supplierId, tenantId, deletedAt: null },
    });
  });

  if (!supplier) {
    log.warn({ supplierId }, 'dropship sync: supplier not found or deleted — acking');
    return;
  }

  if (supplier.status === 'disconnected') {
    log.info({ supplierId }, 'dropship sync: supplier disconnected — skipping');
    return;
  }

  let adapter: ReturnType<typeof createAdapter>;
  try {
    adapter = createAdapter(supplier.type, supplier.credentials as Record<string, string>);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log.error({ supplierId, type: supplier.type, err: errMsg }, 'no adapter for type');
    await withTenant({ tenantId }, async (tx) => {
      await tx.dropshipSupplier.update({
        where: { id: supplierId },
        data: { status: 'error' },
      });
    });
    return;
  }

  let synced = 0;
  let failed = 0;
  // Supplier-cost changes detected this sync — linked catalog variants get a
  // `variant.cost.updated` after the sweep so the markup-recompute-worker can
  // re-derive prices for rules on the `supplier_cost` basis (docs/48 §8).
  const costChanges: CostChange[] = [];

  try {
    for await (const product of adapter.syncCatalog()) {
      try {
        const newCost = product.variants[0]?.costPriceCents ?? 0;
        const result = await withTenant({ tenantId }, async (tx) => {
          const existing = await tx.dropshipProduct.findUnique({
            where: {
              tenantId_supplierId_supplierProductId: {
                tenantId,
                supplierId,
                supplierProductId: product.supplierProductId,
              },
            },
            select: { costPriceCents: true },
          });
          const row = await tx.dropshipProduct.upsert({
            where: {
              tenantId_supplierId_supplierProductId: {
                tenantId,
                supplierId,
                supplierProductId: product.supplierProductId,
              },
            },
            create: {
              tenantId,
              supplierId,
              supplierProductId: product.supplierProductId,
              title: product.title,
              description: product.description,
              images: product.imageUrls,
              variants: product.variants as unknown as Prisma.InputJsonValue,
              costPriceCents: newCost,
              msrpCents: product.variants[0]?.msrpCents ?? null,
              raw: product.raw as unknown as Prisma.InputJsonValue,
            },
            update: {
              title: product.title,
              description: product.description,
              images: product.imageUrls,
              variants: product.variants as unknown as Prisma.InputJsonValue,
              costPriceCents: newCost,
              msrpCents: product.variants[0]?.msrpCents ?? null,
              raw: product.raw as unknown as Prisma.InputJsonValue,
              updatedAt: new Date(),
            },
          });
          return {
            id: row.id,
            prevCost: existing?.costPriceCents ?? null,
            isUpdate: existing != null,
          };
        });
        // Only an UPDATE that actually moved the cost matters — a freshly synced
        // product has no linked catalog variants yet.
        if (result.isUpdate && result.prevCost !== newCost) {
          costChanges.push({ dropshipProductId: result.id, prevCost: result.prevCost, newCost });
        }
        synced++;
      } catch (err: unknown) {
        log.warn(
          {
            supplierId,
            supplierProductId: product.supplierProductId,
            err: err instanceof Error ? err.message : String(err),
          },
          'dropship sync: upsert failed for product — skipping'
        );
        failed++;
      }
    }

    await withTenant({ tenantId }, async (tx) => {
      await tx.dropshipSupplier.update({
        where: { id: supplierId },
        data: { lastSyncAt: new Date(), status: 'active' },
      });
    });

    const publisher = createPublisher({
      logger: log,
    });

    // Fan out cost-change signals to linked catalog variants (docs/48 §8).
    if (costChanges.length > 0) {
      await publishVariantCostUpdates(tenantId, costChanges, publisher, log);
    }

    await publishEvent(
      publisher,
      'dropship.supplier.sync_completed',
      tenantId,
      null,
      { supplierId, synced, failed },
      log
    );

    log.info({ supplierId, synced, failed }, 'dropship sync completed');
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log.error({ supplierId, err: errMsg }, 'dropship sync failed');
    await withTenant({ tenantId }, async (tx) => {
      await tx.dropshipSupplier.update({
        where: { id: supplierId },
        data: { status: 'error' },
      });
    });
    const publisher = createPublisher({
      logger: log,
    });
    await publishEvent(
      publisher,
      'dropship.supplier.error',
      tenantId,
      null,
      { supplierId, error: errMsg },
      log
    );
  }
}

// Resolve which catalog variants are linked to the dropship products whose cost
// moved, and emit one `variant.cost.updated` (supplier_cost basis) per variant.
// A dropship product with no catalog link yields nothing — only imported products
// have real variants bound to a markup rule.
async function publishVariantCostUpdates(
  tenantId: string,
  changes: CostChange[],
  publisher: Publisher,
  log: Logger
): Promise<void> {
  const changeByDropshipProduct = new Map(changes.map((c) => [c.dropshipProductId, c]));
  const ids = [...changeByDropshipProduct.keys()];

  const { links, variants } = await withTenant({ tenantId }, async (tx) => {
    const links = await tx.dropshipProductLink.findMany({
      where: { dropshipProductId: { in: ids }, status: 'active' },
      select: { productId: true, dropshipProductId: true },
    });
    const productIds = [...new Set(links.map((l) => l.productId))];
    const variants =
      productIds.length === 0
        ? []
        : await tx.productVariant.findMany({
            where: { productId: { in: productIds }, deletedAt: null },
            select: { id: true, productId: true },
          });
    return { links, variants };
  });

  if (variants.length === 0) return;

  const dropshipByProduct = new Map(links.map((l) => [l.productId, l.dropshipProductId]));
  for (const v of variants) {
    const dropshipProductId = dropshipByProduct.get(v.productId);
    const change = dropshipProductId ? changeByDropshipProduct.get(dropshipProductId) : undefined;
    await publishEvent(
      publisher,
      'variant.cost.updated',
      tenantId,
      null,
      {
        variantId: v.id,
        productId: v.productId,
        basis: 'supplier_cost',
        prevCostCents: change?.prevCost ?? null,
        newCostCents: change?.newCost ?? null,
      },
      log
    );
  }

  log.info(
    { count: variants.length, products: ids.length },
    'published variant.cost.updated for linked variants'
  );
}
