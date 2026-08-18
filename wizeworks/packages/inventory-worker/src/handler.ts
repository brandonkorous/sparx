import type { Logger } from 'pino';
import { handleSyncStarted, type SyncStartedPayload } from './handlers/sync.js';

export interface SparxEvent {
  type: string;
  tenantId: string;
  userId?: string | null;
  payload: unknown;
}

/**
 * Structural check on a decoded event.
 *
 * This used to take a Pub/Sub PUSH message and base64-decode its `data` field,
 * which left the broker path round-tripping an object it already had: parse the
 * JSON, re-encode it to base64, hand it here, decode it, parse it again. There
 * is no push sender any more (see wizeworks/services/event-worker/src/http.ts), so the
 * envelope is gone and the parameter is the event itself.
 */
export function parseEvent(raw: unknown): SparxEvent | null {
  const e = raw as Partial<SparxEvent> | null | undefined;
  if (!e || typeof e.type !== 'string' || typeof e.tenantId !== 'string') return null;
  return e as SparxEvent;
}

export async function handle(event: SparxEvent, log: Logger): Promise<void> {
  switch (event.type) {
    case 'inventory.source.sync_started':
      await handleSyncStarted(event.payload as SyncStartedPayload, log);
      break;
    default:
      log.debug({ eventType: event.type }, 'inventory-worker: unhandled event type — acking');
  }
}
