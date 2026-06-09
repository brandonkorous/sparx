// Catalog sync handler — triggered by dropship.supplier.sync_started.
// Fetches the supplier from the DB, constructs the right adapter, runs
// syncCatalog(), and upserts every yielded product into dropship_products.

import type { Logger } from 'pino';
import { withTenant, type TxClient } from '@sparx/db';
import { createPublisher, publishEvent, type PublisherLogger } from '@sparx/events';
import { createAdapter } from '@sparx/dropship';

type AnyTx = TxClient & Record<string, any>;

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
  const supplier = await withTenant({ tenantId } as any, async (tx) => {
    return (tx as AnyTx).dropshipSupplier.findFirst({
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
  } catch (err: any) {
    log.error({ supplierId, type: supplier.type, err: err?.message }, 'no adapter for type');
    await withTenant({ tenantId } as any, async (tx) => {
      await (tx as AnyTx).dropshipSupplier.update({
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
        await withTenant({ tenantId } as any, async (tx) => {
          await (tx as AnyTx).dropshipProduct.upsert({
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
              variants: product.variants as any,
              costPriceCents: product.variants[0]?.costPriceCents ?? 0,
              msrpCents: product.variants[0]?.msrpCents ?? null,
              raw: product.raw as any,
            },
            update: {
              title: product.title,
              description: product.description,
              images: product.imageUrls,
              variants: product.variants as any,
              costPriceCents: product.variants[0]?.costPriceCents ?? 0,
              msrpCents: product.variants[0]?.msrpCents ?? null,
              raw: product.raw as any,
              updatedAt: new Date(),
            },
          });
        });
        synced++;
      } catch (err: any) {
        log.warn(
          { supplierId, supplierProductId: product.supplierProductId, err: err?.message },
          'dropship sync: upsert failed for product — skipping'
        );
        failed++;
      }
    }

    await withTenant({ tenantId } as any, async (tx) => {
      await (tx as AnyTx).dropshipSupplier.update({
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
  } catch (err: any) {
    log.error({ supplierId, err: err?.message }, 'dropship sync failed');
    await withTenant({ tenantId } as any, async (tx) => {
      await (tx as AnyTx).dropshipSupplier.update({
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
      { supplierId, error: err?.message ?? 'unknown' },
      log
    );
  }
}
