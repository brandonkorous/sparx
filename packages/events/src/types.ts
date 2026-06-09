// Event type registry — central list of every Pub/Sub event Sparx publishes.
// Topic name == event type (per-topic + for_each Terraform pattern), so a
// publisher with a typed `EventType` cannot accidentally publish to a topic
// that hasn't been provisioned.
//
// Adding a new event:
//   1. Add the literal to `EventType` here.
//   2. Add the topic + subscribers in terraform/envs/prod/main.tf.
//   3. terraform apply.
//   4. Define a payload interface in the consumer-side worker (and import
//      it back here only if multiple publishers share the same payload).

export type EventType =
  // Platform / tenant lifecycle
  | 'tenant.created'
  // Tenant blueprints (docs/54) — one-click marketplace template installs
  | 'template.install'
  | 'template.installed'
  | 'template.install_failed'
  // Content
  | 'content.entry.created'
  | 'content.entry.updated'
  | 'content.entry.published'
  | 'content.entry.scheduled'
  | 'content.entry.unpublished'
  | 'content.entry.deleted'
  | 'content.revision.created'
  | 'content_type.upserted'
  // Media
  | 'media.uploaded'
  | 'media.processed'
  | 'media.deleted'
  // Email
  | 'email.send'
  | 'email.domain.verified'
  // Webhooks / redirects
  | 'redirect.added'
  | 'redirect.removed'
  // ─── Commerce ───────────────────────────────────────────────────────
  // Catalog
  | 'product.created'
  | 'product.updated'
  | 'product.deleted'
  | 'variant.created'
  | 'variant.updated'
  | 'variant.deleted'
  // Inventory
  | 'inventory.adjusted'
  | 'inventory.low'
  | 'inventory.depleted'
  // Cart + checkout
  | 'cart.created'
  | 'cart.updated'
  | 'cart.abandoned'
  | 'cart.recovered'
  | 'checkout.started'
  | 'checkout.completed'
  | 'checkout.expired'
  // Orders (Commerce-side fan-out; CRM still owns the row)
  | 'order.placed'
  | 'order.paid'
  | 'order.fulfilled'
  | 'order.delivered'
  | 'order.cancelled'
  | 'order.refunded'
  | 'order.payment_failed'
  // Payment lifecycle (emitted by the Stripe webhook handler after provider
  // confirmation, so consumers get the authoritative post-Stripe signal rather
  // than the optimistic checkout-complete signal).
  | 'payment.captured'
  | 'payment.failed'
  // Subscriptions
  | 'subscription.created'
  | 'subscription.renewed'
  | 'subscription.payment_failed'
  | 'subscription.paused'
  | 'subscription.resumed'
  | 'subscription.cancelled'
  // Returns / RMA
  | 'return.requested'
  | 'return.approved'
  | 'return.received'
  | 'return.refunded'
  // Reviews + Q&A
  | 'review.submitted'
  | 'review.published'
  | 'review.flagged'
  // Provider marketplace
  | 'provider.installed'
  | 'provider.uninstalled'
  | 'provider.health_changed'
  // Gift cards + store credit
  | 'giftcard.issued'
  | 'giftcard.redeemed'
  | 'storecredit.granted'
  | 'storecredit.spent'
  // Configurator
  | 'configuration.requested'
  | 'configuration.quoted'
  | 'configuration.accepted'
  // ─── Domains (docs/24) ──────────────────────────────────────────────
  // Emitted after a successful GoDaddy purchase + DNS configuration. The
  // domain-worker subscribes to poll DNS propagation and mark the domain active.
  | 'domain.purchased'
  // ─── B2B (docs/10, docs/64 Ph2-Ph3) ────────────────────────────────────
  // Quote lifecycle notifications.
  | 'b2b.quote.submitted'
  | 'b2b.quote.responded'
  // Invoice / credit management notifications.
  | 'b2b.invoice.created'
  | 'b2b.invoice.overdue'
  | 'b2b.account.credit_hold'
  | 'b2b.account.suspended'
  // Approval workflow notifications (docs/64 B2B Ph6).
  | 'b2b.order.pending_approval'
  | 'b2b.order.approved'
  | 'b2b.order.rejected'
  // Service scheduling notifications (docs/64 B2B Ph7).
  | 'b2b.appointment.requested'
  | 'b2b.appointment.confirmed'
  | 'b2b.appointment.cancelled'
  | 'b2b.appointment.reminder'
  | 'b2b.appointment.completed'
  // ─── Dropship (docs/14, docs/64 Ph1-Ph3) ───────────────────────────────
  | 'dropship.supplier.connected'
  | 'dropship.supplier.sync_started'
  | 'dropship.supplier.sync_completed'
  | 'dropship.supplier.error'
  | 'dropship.order.route'
  | 'dropship.order.submitted'
  | 'dropship.order.shipped'
  | 'dropship.order.delivered'
  | 'dropship.order.failed'
  // ─── Universal search (docs/39) ─────────────────────────────────────
  // Generic indexing signal: any module emits this post-commit so the
  // commerce-indexer (re)projects ONE entity into the universal `entities`
  // collection. One topic serves every entity type — no per-entity topic.
  | 'search.entity.changed'
  // ─── Import / Export (docs/68) ───────────────────────────────────────
  // Emitted by api-rest when a tenant submits a CSV import job. Consumed by
  // import-worker (Cloud Run) which processes rows and updates the job row.
  | 'import.job.created';

/** Payload for `domain.purchased`. Consumed by the domain-worker to poll DNS
 *  propagation and mark the domain active once resolved (docs/24 §4 step 5). */
export interface DomainPurchasedPayload {
  /** The registered FQDN. */
  domain: string;
  /** GoDaddy order ID from the purchase API call. */
  orderId: string;
  /** The `domain_purchases.id` row inserted during the purchase flow. */
  purchaseId: string;
  /** The property this domain is attached to. */
  propertyId: string;
  /** True when configureDNS succeeded; false if DNS config failed (worker retries). */
  dnsConfigured: boolean;
}

/** Payload for `search.entity.changed`. `entityType` keys the projector
 *  registry; `op` distinguishes a reprojection from a removal. */
export interface SearchEntityChangedPayload {
  entityType: string;
  recordId: string;
  op: 'upsert' | 'delete';
}

/** Payload for `tenant.created`. Consumed by the legal-seed worker to seed a
 *  new tenant's starter legal pages + footer placements (docs/42 §3). The
 *  tenant id is on the envelope; slug/name are carried for logging + future
 *  consumers (e.g. welcome flows). */
export interface TenantCreatedPayload {
  slug: string;
  name: string;
}

export interface SparxEvent<T = unknown> {
  type: EventType;
  tenantId: string;
  actorId: string | null;
  /** ISO timestamp. */
  occurredAt: string;
  data: T;
}

// ────────────────────────────────────────────────────────────────────────
// Per-event payload contracts
//
// Payloads live here only when multiple publishers emit the same event
// (e.g. both api-rest and the dashboard publish email.send). Otherwise
// keep them inline in the publisher to avoid premature coupling.
// ────────────────────────────────────────────────────────────────────────

/**
 * Payload for `email.send`. Template-based — the worker resolves the
 * template id against @sparx/email's registry and renders before relay.
 *
 * `to` MUST be the recipient's verified address; the worker does no
 * enrichment lookup. For "send to userId" semantics, resolve at the
 * publish site.
 */
export interface EmailSendPayload {
  to: string;
  cc?: string;
  bcc?: string;
  /** Must match a registered template id in @sparx/email's TemplateSend. */
  template:
    | 'password-reset'
    | 'welcome-merchant'
    | 'domain-renewal-reminder'
    | 'order-confirmation'
    | 'shipping-confirmation'
    | 'appointment-confirmation'
    | 'appointment-reminder'
    | 'appointment-cancelled';
  /** Shape is enforced by @sparx/email's TemplateSend.props on render. */
  props: Record<string, unknown>;
  /** Optional From override; defaults to SPARX_EMAIL_FROM env in worker. */
  from?: string;
  replyTo?: string;
  /** Optional header bag (X-Tenant-Id, List-Unsubscribe, etc.). */
  headers?: Record<string, string>;
}

/** Payload for `payment.captured`. Emitted by the Stripe webhook handler
 *  after `payment_intent.succeeded`; consumers can reliably treat this as
 *  "money in hand." */
export interface PaymentCapturedPayload {
  orderId: string;
  orderNumber: string;
  paymentRef: string;
  amountCents: number;
  currency: string;
  providerSlug: string;
}

/** Payload for `payment.failed`. Emitted by the Stripe webhook handler
 *  after `payment_intent.payment_failed`; downstream can notify the
 *  customer or restore an inventory reservation. */
export interface PaymentFailedPayload {
  orderId: string | null;
  paymentRef: string;
  failureCode: string | null;
  failureMessage: string | null;
  providerSlug: string;
}

/** Payload for `import.job.created`. Consumed by import-worker (Cloud Run) to
 *  process CSV rows and write per-row results back to import_job_rows. */
export interface ImportJobCreatedPayload {
  jobId: string;
  entityType: 'products' | 'customers' | 'b2b_accounts' | 'discounts';
}
