// Partner Program + Bootcamp business events (docs/114 §B.9). Every activation /
// referral / commission / payout / bootcamp-lifecycle path publishes through here
// onto Bus A (@sparx/events → Google Pub/Sub), so future automation + analytics +
// notification consumers have one canonical stream. Mirrors scheduling-events.ts.
// publishEvent never throws — a Pub/Sub hiccup must not fail the request.

import { createPublisher, publishEvent, type EventType, type PublisherLogger } from '@sparx/events';

const logger: PublisherLogger = {
  info: (obj, msg) => console.info(msg ?? '', obj),
  warn: (obj, msg) => console.warn(msg ?? '', obj),
  error: (obj, msg) => console.error(msg ?? '', obj),
};

const publisher = createPublisher({ logger });

export async function publishPartnerEvent(
  type: EventType,
  tenantId: string,
  actorId: string | null,
  data: Record<string, unknown>
): Promise<void> {
  await publishEvent(publisher, type, tenantId, actorId, data, logger);
}
