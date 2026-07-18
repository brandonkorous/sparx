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

/** Like requireCrmModule, but also passes for a B2B tenant without CRM.
 *
 *  B2B ACCOUNTS are a B2B-module concept that happens to live under the /v1/crm
 *  URL namespace — the same mis-scoping orders had. B2B requires Commerce, NOT
 *  CRM (packages/modules/src/index.ts REQUIRES graph), so a tenant on B2B +
 *  Commerce could not read their own accounts at all: the /b2b/orders Account
 *  filter came back empty for exactly the tenant it exists to serve.
 *
 *  Applied to the READ routes only. Creating/editing an account stays
 *  crm-exclusive, matching the pre-existing behavior — widening writes is a
 *  larger call than unblocking a filter. */
export async function requireCrmOrB2bModule(request: FastifyRequest): Promise<void> {
  const auth = requireAuth(request);
  if (await isModuleEnabled(auth.tenantId, 'crm')) return;
  if (await isModuleEnabled(auth.tenantId, 'b2b')) return;
  throw moduleDisabled('crm');
}
