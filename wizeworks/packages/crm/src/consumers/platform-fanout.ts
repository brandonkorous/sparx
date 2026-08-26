// CRM bus → platform bus fan-out.
//
// CRM domain events are published on the CRM bus (`publishCrmEvent`, events.ts),
// which fans out to webhooks + Google Pub/Sub. The in-process consumers (the
// segment evaluator, the scoring evaluator) subscribe to the *platform* bus
// (platform-bus.ts) — a SEPARATE bus. So a `crm.customer.updated` published by a
// service never reaches the evaluator subscribed to that topic in-process: its
// crm.* triggers would be dead. (Only order.* crosses, because order services
// publish on the platform bus directly.)
//
// This publisher closes that gap: it wraps the active CRM publisher and, after
// delegating (preserving the Pub/Sub + webhook chain), re-publishes onto the
// platform bus every crm.* event that something in this process actually
// subscribes to.
//
// THE SUBSCRIPTIONS ARE THE LIST, and they have to be, because a second list
// beside them goes stale silently. This used to hold a hand-kept `FORWARD_TOPICS`
// set with a comment reading "keep in sync with the evaluator's watched topics",
// and it named `crm.segment.*` and `crm.deal.*` as the long tail nothing consumes
// locally. Both later grew real subscribers — the segment evaluator's fill-a-new-
// segment pass and the whole of deal scoring — and neither was added here. Seven
// live topics were dropped on the floor by a bridge whose comment said they were
// unwanted, which is why every one of a shop's groups sat at "No members yet"
// while the rule builder counted matches beside it.
//
// Asking the bus costs a Map lookup, which is the same lookup `publish` does to
// find no subscriber — so the old set was not buying the dispatch it claimed to
// save. What it bought was a way to be wrong.
//
// Installed by registerCrmConsumers (it targets the same bus the consumers were
// wired to), so it's active in every process that runs consumers — prod services
// and tests alike — and torn down with them.

import crypto from 'node:crypto';

import { getPublisher, setPublisher, type CrmEvent, type Publisher } from '../events';
import type { PlatformEventBus } from './platform-bus';

class PlatformBusFanoutPublisher implements Publisher {
  constructor(
    private readonly inner: Publisher,
    private readonly bus: PlatformEventBus
  ) {}

  async publish(event: CrmEvent): Promise<void> {
    // Delegate first so the webhook + Pub/Sub side effects run regardless of
    // whether anything consumes the event in-process.
    await this.inner.publish(event);
    if (!this.bus.consumes(event.topic)) return;
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

/** Wrap the active CRM publisher so crm.* events with an in-process subscriber
 *  also dispatch onto `bus`. Returns a teardown that restores the previous
 *  publisher. Idempotent per install/teardown pair — registerCrmConsumers owns
 *  the lifecycle. */
export function installPlatformBusFanout(bus: PlatformEventBus): () => void {
  const prior = getPublisher();
  setPublisher(new PlatformBusFanoutPublisher(prior, bus));
  return () => setPublisher(prior);
}
