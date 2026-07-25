import type { EventType } from '@sparx/api-core/pubsub';

/**
 * A domain event the service asks its caller to publish once the mutation has
 * committed. The service stays free of publisher plumbing — no Fastify logger, no
 * Pub/Sub client — so REST emits it with `request.log` and MCP with a console
 * logger, while the decision of WHAT to emit lives in one place. Mirrors the
 * `LifecycleResult` contract the social extraction returns.
 */
export interface PendingEvent {
  type: EventType;
  payload: Record<string, unknown>;
}
