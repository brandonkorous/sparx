// Partner Program + Bootcamp business events (docs/114 §B.9). Every activation /
// referral / commission / payout / bootcamp-lifecycle path publishes through here
// onto Bus A (@wizeworks/events → Google Pub/Sub), so future automation + analytics +
// notification consumers have one canonical stream. Mirrors scheduling-events.ts.
// publishEvent never throws — a Pub/Sub hiccup must not fail the request.

import {
  createPublisher,
  publishEvent,
  type EmailSendPayload,
  type EventType,
  type PublisherLogger,
} from '@wizeworks/events';

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

/** Publish an `email.send` from a partner-program service function (which have no
 *  request logger). Best-effort like every other emit here — `publishEvent` swallows
 *  its own failures so a mail hiccup never fails the partner write. */
export async function publishPartnerEmail(
  tenantId: string,
  actorId: string | null,
  payload: { to: string; template: EmailSendPayload['template']; props: Record<string, unknown> }
): Promise<void> {
  await publishEvent(publisher, 'email.send', tenantId, actorId, payload, logger);
}

/** Integer cents → localized currency string, for partner-earnings emails. */
export function formatPartnerMoney(cents: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}
