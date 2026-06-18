import type { Logger } from 'pino';
import { handleSyncStarted, type SyncStartedPayload } from './handlers/sync.js';

export interface SparxEvent {
  type: string;
  tenantId: string;
  userId?: string | null;
  payload: unknown;
}

interface PubSubMessage {
  data?: string;
  attributes?: Record<string, string>;
  messageId: string;
}

export function parseEvent(message: PubSubMessage): SparxEvent | null {
  if (!message.data) return null;
  try {
    const decoded = Buffer.from(message.data, 'base64').toString('utf8');
    return JSON.parse(decoded) as SparxEvent;
  } catch {
    return null;
  }
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
