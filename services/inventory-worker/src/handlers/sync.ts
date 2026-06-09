// Handles inventory.source.sync_started events.
//
// For each active link tied to the source, we:
//   1. Fetch the external feed (CSV or API — only CSV supported in Ph2).
//   2. Parse the rows and match each one to an InventorySourceLink by
//      (external_sku, external_location).
//   3. Upsert stock_levels for (tenant, variant, location).
//   4. Mark the source lastSyncAt and emit inventory.source.sync_completed.
//
// On error: log + emit inventory.source.error, then re-throw so Cloud Run
// retries the message.

import type { Logger } from 'pino';
import { withTenant } from '@sparx/db';
import { publishEvent, createPublisher, type PublisherLogger } from '@sparx/events';
import { parseCsvInventory } from '../csv.js';
import { env } from '../env.js';

const pubLogger: PublisherLogger = {
  info: (obj, msg) => console.info(msg ?? '', obj),
  warn: (obj, msg) => console.warn(msg ?? '', obj),
  error: (obj, msg) => console.error(msg ?? '', obj),
};
const publisher = createPublisher({ projectId: env.GCP_PROJECT_ID, logger: pubLogger });

export interface SyncStartedPayload {
  tenantId: string;
  sourceId: string;
  userId?: string | null;
}

export async function handleSyncStarted(payload: SyncStartedPayload, log: Logger): Promise<void> {
  const { tenantId, sourceId } = payload;

  log.info({ tenantId, sourceId }, 'inventory-worker: sync started');

  const source = await withTenant({ tenantId }, async (tx) => {
    return tx.inventorySource.findUniqueOrThrow({ where: { id: sourceId } });
  });

  if (source.status === 'paused' || source.deletedAt) {
    log.info({ sourceId }, 'inventory-worker: source is paused/deleted — skipping');
    return;
  }

  try {
    if (source.type === 'csv') {
      const cfg =
        typeof source.config === 'object' && source.config !== null && !Array.isArray(source.config)
          ? (source.config as Record<string, unknown>)
          : {};
      await syncCsvSource(source.id, cfg, tenantId, log);
    } else {
      log.warn({ type: source.type }, 'inventory-worker: unsupported source type — skipping');
    }

    await withTenant({ tenantId }, async (tx) => {
      await tx.inventorySource.update({
        where: { id: sourceId },
        data: { lastSyncAt: new Date(), status: 'active', updatedAt: new Date() },
      });
    });

    await publishEvent(
      publisher,
      'inventory.source.sync_completed',
      tenantId,
      payload.userId ?? null,
      { sourceId, syncedAt: new Date().toISOString() },
      pubLogger
    );

    log.info({ tenantId, sourceId }, 'inventory-worker: sync completed');
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log.error({ tenantId, sourceId, err: errMsg }, 'inventory-worker: sync failed');

    await withTenant({ tenantId }, async (tx) => {
      await tx.inventorySource.update({
        where: { id: sourceId },
        data: { status: 'error', updatedAt: new Date() },
      });
    }).catch(() => undefined);

    await publishEvent(
      publisher,
      'inventory.source.error',
      tenantId,
      payload.userId ?? null,
      { sourceId, error: errMsg },
      pubLogger
    ).catch(() => undefined);

    throw err;
  }
}

async function syncCsvSource(
  sourceId: string,
  config: Record<string, unknown>,
  tenantId: string,
  log: Logger
): Promise<void> {
  const csvUrl = typeof config.csvUrl === 'string' ? config.csvUrl : undefined;
  if (!csvUrl) {
    throw new Error(`inventory-worker: CSV source ${sourceId} has no csvUrl in config`);
  }

  log.info({ sourceId, csvUrl }, 'inventory-worker: fetching CSV');

  const res = await fetch(csvUrl, {
    signal: AbortSignal.timeout(30_000),
    headers: { Accept: 'text/csv,text/plain,*/*' },
  });
  if (!res.ok) throw new Error(`CSV fetch failed: ${res.status} ${csvUrl}`);
  const csvText = await res.text();

  const rows = parseCsvInventory(csvText, log);
  log.info({ sourceId, rowCount: rows.length }, 'inventory-worker: parsed rows');

  if (rows.length === 0) return;

  // Load all active links for this source in one query.
  interface LinkRecord {
    id: string;
    variantId: string;
    locationId: string;
    externalSku: string;
    externalLocation: string | null;
  }

  const links = await withTenant({ tenantId }, async (tx) => {
    return tx.inventorySourceLink.findMany({
      where: { tenantId, sourceId, status: 'active' },
      select: {
        id: true,
        variantId: true,
        locationId: true,
        externalSku: true,
        externalLocation: true,
      },
    });
  });

  // Build lookup: "sku|location" → link (null location = wildcard match on sku only)
  const linkMap = new Map<string, LinkRecord>();
  for (const link of links) {
    const key =
      link.externalLocation !== null
        ? `${link.externalSku}|${link.externalLocation}`
        : link.externalSku;
    linkMap.set(key, link);
  }

  let upserted = 0;
  let unmatched = 0;

  for (const row of rows) {
    const exactKey =
      row.externalLocation !== null
        ? `${row.externalSku}|${row.externalLocation}`
        : row.externalSku;
    const link = linkMap.get(exactKey) ?? linkMap.get(row.externalSku);

    if (!link) {
      unmatched++;
      log.debug(
        { sku: row.externalSku, location: row.externalLocation },
        'inventory-worker: no link for SKU — skipping'
      );
      continue;
    }

    const available = Math.max(0, row.quantity);
    await withTenant({ tenantId }, async (tx) => {
      // Upsert by (tenantId, variantId, locationId).
      // We set onHand and available; allocated is managed separately by order events.
      const existing = await tx.stockLevel.findFirst({
        where: { tenantId, variantId: link.variantId, locationId: link.locationId },
        select: { id: true, allocated: true },
      });

      if (existing) {
        const alloc = Number(existing.allocated ?? 0);
        await tx.stockLevel.update({
          where: { id: existing.id },
          data: {
            onHand: row.quantity,
            available: Math.max(0, row.quantity - alloc),
            updatedAt: new Date(),
          },
        });
      } else {
        await tx.stockLevel.create({
          data: {
            tenantId,
            variantId: link.variantId,
            locationId: link.locationId,
            onHand: row.quantity,
            allocated: 0,
            available,
          },
        });
      }
    });

    upserted++;
  }

  log.info({ sourceId, upserted, unmatched }, 'inventory-worker: stock levels updated');
}
