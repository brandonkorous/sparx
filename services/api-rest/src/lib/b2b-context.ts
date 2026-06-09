// Bridge between Fastify auth context and the B2B service layer.
// Mirrors the pattern in crm-context.ts — service functions take
// { tenantId, userId } and routes call requireB2bModule() once per handler.

import type { FastifyRequest } from 'fastify';
import { isModuleEnabled } from '@sparx/auth';
import { requireAuth } from '@sparx/api-core/auth';
import { moduleDisabled } from '@sparx/api-core/errors';

export interface B2bContext {
  tenantId: string;
  userId: string;
}

export function toB2bContext(request: FastifyRequest): B2bContext {
  const auth = requireAuth(request);
  return { tenantId: auth.tenantId, userId: auth.actorId };
}

/** Throws MODULE_DISABLED (→ 404 envelope) when the tenant doesn't have
 *  the B2B module active. Call once per B2B route handler before service. */
export async function requireB2bModule(request: FastifyRequest): Promise<void> {
  const auth = requireAuth(request);
  const enabled = await isModuleEnabled(auth.tenantId, 'b2b');
  if (!enabled) throw moduleDisabled('b2b');
}
