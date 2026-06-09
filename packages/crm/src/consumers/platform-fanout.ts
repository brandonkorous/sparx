// CRM bus → platform bus fan-out.
//
// CRM domain events are published on the CRM bus (`publishCrmEvent`, events.ts),
// which fans out to webhooks + Google Pub/Sub. The in-process consumers (the
// segment evaluator) subscribe to the *platform* bus (platform-bus.ts) — a
// SEPARATE bus. So a `crm.customer.updated` published by a service never reaches
// the evaluator subscribed to that topic in-process: its crm.* triggers would be
// dead. (Only order.* crosses, because order services publish on the platform bus
// directly.)
//
// This publisher closes that gap: it wraps the active CRM publisher and, after
// delegating (preserving the Pub/Sub + webhook chain), re-publishes an allowlisted
// subset of crm.* events onto the platform bus so the registered consumers receive
// them. The allowlist is exactly the topics an in-process consumer acts on — so we
// don't double-dispatch the long tail (crm.deal.*, crm.segment.*, …) that nothing
// consumes locally.
//
// Installed by registerCrmConsumers (it targets the same bus the consumers were
// wired to), so it's active in every process that runs consumers — prod services
// and tests alike — and torn down with them.

import crypto from 'node:crypto';

import { getPublisher, setPublisher, type CrmEvent, type Publisher } from '../events';
import type { PlatformEventBus } from './platform-bus';

// crm.* topics an in-process consumer (the segment evaluator) reacts to. Keep in
// sync with the evaluator's watched topics — forwarding a topic nothing consumes
// just burns a dispatch.
const FORWARD_TOPICS: ReadonlySet<string> = new Set([
  'crm.customer.updated',
  'crm.customer.subscribed',
  'crm.activity.recorded',
  'crm.b2b.account_updated',
]);

class PlatformBusFanoutPublisher implements Publisher {
  constructor(
    private readonly inner: Publisher,
    private readonly bus: PlatformEventBus
  ) {}

  async publish(event: CrmEvent): Promise<void> {
    // Delegate first so the webhook + Pub/Sub side effects run regardless of
    // whether anything consumes the event in-process.
    await this.inner.publish(event);
    if (!FORWARD_TOPICS.has(event.topic)) return;
    // The platform event id seeds the consumer dedupe key — reuse the CRM event's
    // dedupeKey so a redelivered domain event maps to one in-process processing.
    await this.bus.publish({
      id: event.dedupeKey ?? crypto.randomUUID(),
      topic: event.topic,
      tenantId: event.tenantId,
      occurredAt: event.occurredAt ?? new Date(),
      payload: event.payload,
    });
  }
}

/** Wrap the active CRM publisher so allowlisted crm.* events also dispatch onto
 *  `bus` (the in-process platform bus the consumers subscribe to). Returns a
 *  teardown that restores the previous publisher. Idempotent per install/teardown
 *  pair — registerCrmConsumers owns the lifecycle. */
export function installPlatformBusFanout(bus: PlatformEventBus): () => void {
  const prior = getPublisher();
  setPublisher(new PlatformBusFanoutPublisher(prior, bus));
  return () => setPublisher(prior);
}
