// Domain event publishing from api-rest (docs/149 §6).
//
// BEST-EFFORT, like every other publisher wrapper here: `publishEvent` swallows
// its own transport failures, so a broker hiccup never fails the request that
// approved a timesheet. The one consequence that matters is that the labour
// deriver runs late rather than never — the next approval in that period
// re-derives the whole span and upserts over the same expense.
//
// ONE publisher for the process, deliberately. `createPublisher` opens a broker
// connection; a second wrapper module with its own instance would double them
// for no gain. The file keeps its `staff-events` name because that is what the
// existing call sites import, but `publishDomainEvent` is the general form and
// is what anything new should use — the finance cron publishes through it too.

import {
  createPublisher,
  publishEvent,
  type EventType,
  type PublisherLogger,
} from '@wizeworks/events';

const logger: PublisherLogger = {
  info: (obj, msg) => console.info(msg ?? '', obj),
  warn: (obj, msg) => console.warn(msg ?? '', obj),
  error: (obj, msg) => console.error(msg ?? '', obj),
};

const publisher = createPublisher({ logger });

export async function publishDomainEvent(
  type: EventType,
  tenantId: string,
  actorId: string | null,
  data: Record<string, unknown>
): Promise<void> {
  await publishEvent(publisher, type, tenantId, actorId, data, logger);
}

/** @deprecated Use `publishDomainEvent` — same function, honest name. Kept so
 *  the staff routes keep reading the way they were written. */
export const publishStaffEvent = publishDomainEvent;
