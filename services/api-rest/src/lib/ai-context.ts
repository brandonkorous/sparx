// Bridge between Fastify auth context and the AI module's tenant scope.
//
// Mirrors chat-context.ts: the AI reporting routes derive a tenant-scoped
// context from the JWT (toAiContext) after asserting the `ai` module is active
// (requireAiModule). The MCP server is the first-class AI surface; these helpers
// gate the dashboard-facing /v1/ai/* reads on the same `ai` flag the MCP service
// enforces.

import type { FastifyRequest } from 'fastify';
import type { TenantContext } from '@sparx/db';
import { isModuleEnabled } from '@sparx/auth';
import { requireAuth } from '@sparx/api-core/auth';
import { moduleDisabled } from '@sparx/api-core/errors';

export function toAiContext(request: FastifyRequest): TenantContext {
  const auth = requireAuth(request);
  return { tenantId: auth.tenantId, userId: auth.actorId };
}

/** 404 (via MODULE_DISABLED) if the caller's tenant hasn't activated AI. */
export async function requireAiModule(request: FastifyRequest): Promise<void> {
  const auth = requireAuth(request);
  const enabled = await isModuleEnabled(auth.tenantId, 'ai');
  if (!enabled) throw moduleDisabled('ai');
}
