// Catalog sync handler — triggered by dropship.supplier.sync_started.
// Fetches the supplier from the DB, constructs the right adapter, runs
// syncCatalog(), and upserts every yielded product into dropship_products.

import type { Logger } from 'pino';
import { Prisma } from '@prisma/client';
import { withTenant } from '@sparx/db';
import { createPublisher, publishEvent, type PublisherLogger } from '@sparx/events';
import { createAdapter } from '@sparx/dropship';

export interface SyncStartedPayload {
  supplierId: string;
  type: string;
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

  try {
    for await (const product of adapter.syncCatalog()) {
      try {
        await withTenant({ tenantId }, async (tx) => {
          await tx.dropshipProduct.upsert({
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
              costPriceCents: product.variants[0]?.costPriceCents ?? 0,
              msrpCents: product.variants[0]?.msrpCents ?? null,
              raw: product.raw as unknown as Prisma.InputJsonValue,
            },
            update: {
              title: product.title,
              description: product.description,
              images: product.imageUrls,
              variants: product.variants as unknown as Prisma.InputJsonValue,
              costPriceCents: product.variants[0]?.costPriceCents ?? 0,
              msrpCents: product.variants[0]?.msrpCents ?? null,
              raw: product.raw as unknown as Prisma.InputJsonValue,
              updatedAt: new Date(),
            },
          });
        });
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

    const publisher = createPublisher(log as unknown as PublisherLogger);
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
    const publisher = createPublisher(log as unknown as PublisherLogger);
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
