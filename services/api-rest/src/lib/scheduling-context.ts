import type { FastifyRequest } from 'fastify';
import { isModuleEnabled } from '@sparx/auth';
import { requireAuth } from '@sparx/api-core/auth';
import { moduleDisabled } from '@sparx/api-core/errors';

export interface SchedulingContext {
  tenantId: string;
  userId: string;
}

export function toSchedulingContext(request: FastifyRequest): SchedulingContext {
  const auth = requireAuth(request);
  return { tenantId: auth.tenantId, userId: auth.actorId };
}

/** Gate every scheduling route on the `scheduling` module flag (locked decision
 *  #6: a disabled module returns a clean 404-style MODULE_DISABLED, never rows). */
export async function requireSchedulingModule(request: FastifyRequest): Promise<void> {
  const auth = requireAuth(request);
  const enabled = await isModuleEnabled(auth.tenantId, 'scheduling');
  if (!enabled) throw moduleDisabled('scheduling');
}
