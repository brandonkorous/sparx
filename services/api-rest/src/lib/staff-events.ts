// Staff event publishing (docs/149 §6).
//
// BEST-EFFORT, like every other publisher wrapper here: `publishEvent` swallows
// its own transport failures, so a broker hiccup never fails the request that
// approved a timesheet. The one consequence that matters is that the labour
// deriver runs late rather than never — the next approval in that period
// re-derives the whole span and upserts over the same expense.

import { createPublisher, publishEvent, type EventType, type PublisherLogger } from '@sparx/events';

const logger: PublisherLogger = {
  info: (obj, msg) => console.info(msg ?? '', obj),
  warn: (obj, msg) => console.warn(msg ?? '', obj),
  error: (obj, msg) => console.error(msg ?? '', obj),
};

const publisher = createPublisher({ logger });

export async function publishStaffEvent(
  type: EventType,
  tenantId: string,
  actorId: string | null,
  data: Record<string, unknown>
): Promise<void> {
  await publishEvent(publisher, type, tenantId, actorId, data, logger);
}
