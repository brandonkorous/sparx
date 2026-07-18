// Bridge between Fastify auth context and @sparx/crm's ServiceContext.
//
// Every CRM service function takes `(ctx: ServiceContext, args)`. The REST
// transport wraps each handler with `requireCrmModule(request)` (which also
// runs requireAuth) and `toCrmContext(request)` to derive that ctx — keeping
// the routes vanishingly thin per decision #7 (one service, three transports).

import type { FastifyRequest } from 'fastify';
import type { ServiceContext } from '@sparx/crm';
import { isModuleEnabled } from '@sparx/auth';
import { requireAuth } from '@sparx/api-core/auth';
import { moduleDisabled } from '@sparx/api-core/errors';

export function toCrmContext(request: FastifyRequest): ServiceContext {
  const auth = requireAuth(request);
  return { tenantId: auth.tenantId, userId: auth.actorId };
}

/** Throws MODULE_DISABLED (→ 404 envelope) if the caller's tenant doesn't
 *  have CRM active. Pairs with requireAuth — call it once per CRM handler
 *  before any service call. */
export async function requireCrmModule(request: FastifyRequest): Promise<void> {
  const auth = requireAuth(request);
  const enabled = await isModuleEnabled(auth.tenantId, 'crm');
  if (!enabled) throw moduleDisabled('crm');
}

// Orders used to ride on a requireCrmOrCommerceModule gate here, back when they
// lived at /v1/crm/orders. They now have their own top-level root — see
// lib/order-context.ts (requireOrderAccess, gated on Commerce OR B2B OR CRM).
// Every route in this namespace is genuinely CRM-exclusive, so requireCrmModule
// is the only gate this file needs.
