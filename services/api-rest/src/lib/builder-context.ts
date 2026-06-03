// Bridge between Fastify auth context and @sparx/builder's ServiceContext.
//
// Every Builder service function takes `(ctx: ServiceContext, args)`. The REST
// transport wraps each handler with `requireBuilderModule(request)` (which also
// runs requireAuth) and `toBuilderContext(request)` to derive that ctx — keeping
// routes vanishingly thin (one service, many transports). Mirrors
// lib/sitebuilder-context.ts.

import type { FastifyRequest } from 'fastify';
import type { ServiceContext } from '@sparx/builder';
import { isModuleEnabled } from '@sparx/auth';
import { requireAuth } from '@sparx/api-core/auth';
import { moduleDisabled } from '@sparx/api-core/errors';

export function toBuilderContext(request: FastifyRequest): ServiceContext {
  const auth = requireAuth(request);
  return { tenantId: auth.tenantId, userId: auth.actorId };
}

/** Throws MODULE_DISABLED (→ 404 envelope) if the caller's tenant doesn't have
 *  the builder module active. Pairs with requireAuth — call once per handler
 *  before any service call. */
export async function requireBuilderModule(request: FastifyRequest): Promise<void> {
  const auth = requireAuth(request);
  const enabled = await isModuleEnabled(auth.tenantId, 'builder');
  if (!enabled) throw moduleDisabled('builder');
}
