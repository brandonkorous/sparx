// Shared support types for the CMS service layer (docs/12).
//
// The service functions are TRANSPORT-AGNOSTIC — no Fastify request. Each write
// comes in two forms: a `*Tx` core that runs inside a caller-provided
// transaction (the REST route passes its `withRequestTenant` tx so the route's
// audit write stays in the same transaction), and a tx-opening wrapper the MCP
// tools call (no request, no ambient tx). Both return the same
// `{ entity, events }` shape.
//
// Events are RETURNED, not published, so the mutation logic is shared once while
// each transport emits with its own logger (route = request.log, MCP = console).
// Audit stays a route-layer concern (writeAudit needs the FastifyRequest); MCP
// calls are audited independently by api-mcp's recordToolInvocation.

import type { EventType } from '@wizeworks/events';

/** Tenant + actor identity for a CMS write. `actorId` is the acting user (staff
 *  member for the dashboard, the MCP token's user for an agent call), or null. */
export interface CmsWriteContext {
  tenantId: string;
  actorId: string | null;
}

/** A domain event the caller must publish AFTER the mutation's transaction
 *  commits. The service decides which events fire + their payloads (one source
 *  of truth); the transport supplies the logger. */
export interface CmsEmittedEvent {
  type: EventType;
  data: Record<string, unknown>;
}
