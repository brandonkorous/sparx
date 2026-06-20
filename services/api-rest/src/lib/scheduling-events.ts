// Booking lifecycle events (docs/79 §16). Every create/confirm/cancel/etc. path
// — dashboard, public booking widget, and (later) MCP — publishes through here so
// the scheduling-worker has one stream to consume for confirmations, reminders,
// and the calendar-sync push. Mirrors the dropship/b2b publisher wiring.

import { createPublisher, publishEvent, type EventType, type PublisherLogger } from '@sparx/events';
import { env } from '../env.js';

const logger: PublisherLogger = {
  info: (obj, msg) => console.info(msg ?? '', obj),
  warn: (obj, msg) => console.warn(msg ?? '', obj),
  error: (obj, msg) => console.error(msg ?? '', obj),
};

const publisher = createPublisher({ projectId: env.GCP_PROJECT_ID, logger });

export async function publishBookingEvent(
  type: EventType,
  tenantId: string,
  actorId: string | null,
  data: Record<string, unknown>
): Promise<void> {
  await publishEvent(publisher, type, tenantId, actorId, data, logger);
}
