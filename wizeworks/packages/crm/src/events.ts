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
  // Deal attach/detach — emitted when orders or billing documents (quotes) are
  // linked to a deal
  | 'crm.deal.order_attached'
  | 'crm.deal.order_detached'
  | 'crm.deal.document_attached'
  | 'crm.deal.document_detached'
  // Invoicing — authored billing documents (docs/87 §13). This is the ONE
  // quote/estimate/invoice/receipt entity; a stage transition is exactly the
  // kind of event a tenant automation rule gates ("when a Repair Order reaches
  // Approved, email the customer"). These reach the automation fan-in +
  // webhook fan-out through the standard CRM-bus bridge.
  | 'crm.billing_document.created'
  | 'crm.billing_document.stage_changed'
  | 'crm.billing_document.finalized'
  | 'crm.billing_document.paid'
  | 'crm.billing_document.voided'
  | 'crm.billing_document.converted'
  // The object registry (docs/144 §3). A schema change is worth an event
  // because it invalidates cached property lists in every open workbench pane
  // and every AI client that read the object's shape.
  | 'crm.object_def.created'
  | 'crm.object_def.updated'
  | 'crm.object_def.archived'
  // Rows of a tenant-invented object. Named generically (`record`, with the
  // object key in the payload) rather than per-object, because the whole point
  // of a custom object is that we do not know its name at build time.
  | 'crm.record.created'
  | 'crm.record.updated'
  | 'crm.record.deleted'
  // E-sign (docs/144 §12). Three separate topics rather than one with a status,
  // because a business wants to be told about them differently: a request going
  // out is routine, a signature is worth a notification, and a DECLINE is the
  // one somebody should ring about today. One topic would make all three the
  // same automation with a condition on it.
  //
  // No token ever rides these. A bus message is logged, retried and
  // dead-lettered; a signing link inside one is a signing link in a log file.
  | 'crm.document.signature_requested'
  | 'crm.document.signed'
  | 'crm.document.declined'
  // A meeting was booked through a rep's personal link (docs/144 §12). Distinct
  // from the scheduling module's own booking events: those say an appointment
  // exists, this says a SALES conversation was booked with a named person, which
  // is what a sequence or a task rule wants to fire on.
  | 'crm.meeting.booked'
  // A tenant-declared property changed value on ANY object. The automation
  // engine's `crm.property.changed` trigger (docs/144 §9) keys off this; the
  // payload carries the object key, the record id and which properties moved.
  | 'crm.property.changed'
  // Relationships (docs/144 §6). Worth an event because "a decision maker was
  // added to this deal" is a thing a business wants to act on — notify the rep,
  // start a sequence — and because the panel on any open pane showing the other
  // record is now stale.
  | 'crm.association.added'
  | 'crm.association.removed'
  // The engagement spine (docs/144 §5). `engagement.received` is the one a
  // business most wants to act on — a customer replied — and the one the
  // automation engine's "they answered" trigger keys off.
  | 'crm.engagement.sent'
  | 'crm.engagement.received'
  | 'crm.engagement.logged'
  // Service requests (docs/144 §7). The two SLA topics are the ones a business
  // most wants to act on and the reason the clock is worth storing at all: an
  // automation that pages the shift lead when an urgent request is 80% of the
  // way through its promise is the difference between a due date and a system.
  | 'crm.ticket.created'
  | 'crm.ticket.updated'
  | 'crm.ticket.assigned'
  | 'crm.ticket.stage_changed'
  | 'crm.ticket.resolved'
  | 'crm.ticket.sla.warning'
  | 'crm.ticket.sla.breached';

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
