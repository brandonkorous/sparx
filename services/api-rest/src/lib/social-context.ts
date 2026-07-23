import type { FastifyRequest } from 'fastify';
import { isModuleEnabled } from '@sparx/auth';
import { requireAuth } from '@sparx/api-core/auth';
import { moduleDisabled } from '@sparx/api-core/errors';

// Social posting is its own free, standalone module (docs/133 §1) — gated on `social`,
// NOT folded into commerce the way channels are.

export interface SocialContext {
  tenantId: string;
  userId: string;
}

export function toSocialContext(request: FastifyRequest): SocialContext {
  const auth = requireAuth(request);
  return { tenantId: auth.tenantId, userId: auth.actorId };
}

export async function requireSocialModule(request: FastifyRequest): Promise<void> {
  const auth = requireAuth(request);
  const enabled = await isModuleEnabled(auth.tenantId, 'social');
  if (!enabled) throw moduleDisabled('social');
}
