// Handles inventory.source.sync_started events (CSV pull — Tier C).
//
// For the source named in the event we:
//   1. Fetch the external feed (CSV in Ph2; other tiers add adapters later).
//   2. Parse the rows and hand them to `inventoryService.ingestFeed`, the single
//      funnel that matches each row to an InventorySourceLink, reconciles matches
//      into the master `inventory_levels` through a corrective `sync` movement
//      (docs/100 P1c — not a blind overwrite, so onHand stays reconcilable to
//      Σ(movements)), queues unmatched SKUs for review, and records the run.
//   3. Emit inventory.source.sync_completed with the run summary.
//
// On error: log + emit inventory.source.error, then re-throw so Cloud Run
// retries the message.

import type { Logger } from 'pino';
import { withTenant } from '@sparx/db';
import { inventoryService } from '@sparx/inventory';
import type { FeedRow } from '@sparx/inventory';
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
  // How the sync was initiated — drives the run's trigger badge. Defaults to
  // 'manual' (today only the `/sources/:id/sync` endpoint publishes this event).
  // (Mirrors the `SyncTrigger` Zod enum without a cross-package type dep.)
  trigger?: 'manual' | 'scheduled' | 'push' | 'api';
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

  const ctx = { tenantId, ...(payload.userId ? { userId: payload.userId } : {}) };

  try {
    let summary: { rowsTotal: number; rowsChanged: number; rowsUnmatched: number } | null = null;

    if (source.type === 'csv') {
      const cfg =
        typeof source.config === 'object' && source.config !== null && !Array.isArray(source.config)
          ? (source.config as Record<string, unknown>)
          : {};
      const rows = await fetchCsvRows(sourceId, cfg, log);
      const result = await inventoryService.ingestFeed(ctx, {
        source: { id: source.id, name: source.name },
        rows,
        trigger: payload.trigger ?? 'manual',
      });
      summary = {
        rowsTotal: result.rowsTotal,
        rowsChanged: result.rowsChanged,
        rowsUnmatched: result.rowsUnmatched,
      };
      log.info({ sourceId, ...result }, 'inventory-worker: feed ingested');
    } else {
      log.warn({ type: source.type }, 'inventory-worker: unsupported source type — skipping');
    }

    await publishEvent(
      publisher,
      'inventory.source.sync_completed',
      tenantId,
      payload.userId ?? null,
      { sourceId, syncedAt: new Date().toISOString(), ...(summary ?? {}) },
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

/** Fetch + parse a CSV source's feed into normalized ingest rows. */
async function fetchCsvRows(
  sourceId: string,
  config: Record<string, unknown>,
  log: Logger
): Promise<FeedRow[]> {
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

  const parsed = parseCsvInventory(csvText, log);
  log.info({ sourceId, rowCount: parsed.length }, 'inventory-worker: parsed rows');

  return parsed.map((r) => ({
    externalSku: r.externalSku,
    externalLocation: r.externalLocation,
    quantity: r.quantity,
  }));
}
