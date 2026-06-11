// CRM Pub/Sub event publisher.
//
// Per locked decision #6, the consumer side (subscriptions) only registers
// for tenants with CRM active. The publisher side is unconditional — any
// CRM service can emit, and routing happens downstream (in the worker /
// Pub/Sub topic configuration).
//
// Phase 1 ships a noop-with-logging publisher; Phase 2+ swaps to a real
// Google Pub/Sub client behind the same interface. Keeping this abstract
// lets unit tests inject a recording publisher and assert emissions
// without standing up Pub/Sub. The contract is intentionally minimal —
// {tenantId, topic, payload, dedupeKey?} — so swapping transports later
// doesn't require a service-layer rewrite.

export interface CrmEvent {
  /** Tenant the event belongs to. Routed to that tenant's consumers only. */
  tenantId: string;
  /** Pub/Sub topic name (e.g. "crm.customer.created", "deal.stage_changed"). */
  topic: CrmTopic;
  /** Structured payload — must be JSON-serializable. */
  payload: Record<string, unknown>;
  /** Optional idempotency key — consumers deduplicate against this. */
  dedupeKey?: string;
  /** Wall-clock time the event occurred; defaults to now. */
  occurredAt?: Date;
}

// Canonical topic list — kept in sync with docs/11 §7 and docs/06 §8.
// Adding a new topic here triggers the rest of the platform (email module,
// webhook dispatcher) to start receiving it.
export type CrmTopic =
  | 'crm.customer.created'
  | 'crm.customer.updated'
  | 'crm.customer.merged'
  | 'crm.customer.deleted'
  // A marketing opt-in (newsletter block / checkout opt-in). Distinct from
  // `.created` so the email module can route only consenting contacts to an
  // audience without re-checking gdpr_consent on every customer write.
  | 'crm.customer.subscribed'
  | 'crm.b2b_account.created'
  | 'crm.b2b_account.updated'
  | 'crm.pipeline.created'
  | 'crm.pipeline.updated'
  | 'crm.deal.created'
  | 'crm.deal.updated'
  | 'crm.deal.stage_changed'
  | 'crm.deal.closed'
  | 'crm.activity.recorded'
  | 'crm.task.created'
  | 'crm.task.updated'
  | 'crm.task.completed'
  | 'crm.segment.created'
  | 'crm.segment.updated'
  | 'crm.segment.entered' // emitted by Phase 4 segment evaluator
  | 'crm.segment.exited' // emitted by Phase 4 segment evaluator
  // Quote lifecycle
  | 'crm.quote.created'
  | 'crm.quote.submitted'
  | 'crm.quote.accepted'
  | 'crm.quote.declined'
  | 'crm.quote.expired'
  // Deal attach/detach — emitted when orders or quotes are linked to a deal
  | 'crm.deal.order_attached'
  | 'crm.deal.order_detached'
  | 'crm.deal.quote_attached'
  | 'crm.deal.quote_detached'
  // Invoicing — authored billing documents (docs/87 §13). A stage transition is
  // exactly the kind of event a tenant automation rule gates ("when a Repair
  // Order reaches Approved, email the customer"). These reach the automation
  // fan-in + webhook fan-out through the standard CRM-bus bridge.
  | 'crm.billing_document.created'
  | 'crm.billing_document.stage_changed'
  | 'crm.billing_document.finalized'
  | 'crm.billing_document.paid'
  | 'crm.billing_document.voided';

export interface Publisher {
  publish(event: CrmEvent): Promise<void>;
}

// Default publisher — logs and discards. Replaced via setPublisher() once
// the Pub/Sub worker is wired (Phase 2). Tests inject RecordingPublisher.
class LoggingPublisher implements Publisher {
  publish(event: CrmEvent): Promise<void> {
    // Intentional console.log — this is the wire boundary, not application
    // code. Swap to a structured logger when one lands.

    console.log(
      '[crm-event]',
      JSON.stringify({
        tenantId: event.tenantId,
        topic: event.topic,
        payload: event.payload,
        dedupeKey: event.dedupeKey,
        occurredAt: (event.occurredAt ?? new Date()).toISOString(),
      })
    );
    return Promise.resolve();
  }
}

let activePublisher: Publisher = new LoggingPublisher();

/** Replace the active publisher. Tests pass a recording instance; the
 *  worker bootstrap passes the real Pub/Sub-backed implementation. */
export function setPublisher(publisher: Publisher): void {
  activePublisher = publisher;
}

/** Read the active publisher. Used by `installCrmWebhookFanout` to wrap
 *  whatever was already installed without dropping it. */
export function getPublisher(): Publisher {
  return activePublisher;
}

/** Publish an event through the active publisher. Service-layer functions
 *  call this after their DB write commits (in practice: after the
 *  `withTenant` callback returns) so we never emit an event for a write
 *  that rolled back. */
export async function publishCrmEvent(event: CrmEvent): Promise<void> {
  await activePublisher.publish(event);
}

// Recording publisher for tests — exported so consumers can wire it
// directly without importing from a test-only path.
export class RecordingPublisher implements Publisher {
  readonly events: CrmEvent[] = [];
  publish(event: CrmEvent): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
  clear(): void {
    this.events.length = 0;
  }
}
