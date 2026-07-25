import type { FastifyRequest } from 'fastify';
import { isModuleEnabled } from '@sparx/auth';
import { requireAuth } from '@sparx/api-core/auth';
import { moduleDisabled } from '@sparx/api-core/errors';
import type { SocialContext } from '@sparx/social/service';

// Social posting is its own free, standalone module (docs/133 §1) — gated on `social`,
// NOT folded into commerce the way channels are.
//
// `SocialContext` (the pure {tenantId, userId} the service runs under) now lives in
// @sparx/social so REST + MCP share it; re-exported here so route imports of
// `./social-context.js` are unchanged. The Fastify request→context helpers stay here
// (the package must not depend on Fastify).

export type { SocialContext };

export function toSocialContext(request: FastifyRequest): SocialContext {
  const auth = requireAuth(request);
  return { tenantId: auth.tenantId, userId: auth.actorId };
}

export async function requireSocialModule(request: FastifyRequest): Promise<void> {
  const auth = requireAuth(request);
  const enabled = await isModuleEnabled(auth.tenantId, 'social');
  if (!enabled) throw moduleDisabled('social');
}
