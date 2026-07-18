// Bridge between Fastify auth context and the order service layer.
//
// Orders are a SHARED SPINE, not a module-owned record: they are produced by
// Commerce checkout or B2B PO checkout, and read by CRM as customer history.
// That's why they live at the top-level /v1/orders root rather than under any
// one module's namespace — a module prefix would imply an ownership (and a
// charge) that doesn't hold. Commerce, B2B, and CRM are separately billed; a
// tenant paying for ANY ONE of them must be able to reach their own orders.
//
// The dashboard mirrors this with three separate page routes (/commerce/orders,
// /b2b/orders, /crm/orders) — three lenses on this one API root, each with its
// own columns, filters, and panels.
//
// NOTE: the order services still live in @sparx/crm for historical reasons,
// which is why the context type is imported from there. @sparx/commerce already
// depends on them (checkout, subscriptions, shipping), so the package
// dependency currently runs backwards. Relocating them to @sparx/commerce is a
// separate refactor — it risks a commerce↔crm cycle and is deliberately NOT
// bundled into the URL move.

import type { FastifyRequest } from 'fastify';
import type { ServiceContext } from '@sparx/crm';
import { isModuleEnabled } from '@sparx/auth';
import { requireAuth } from '@sparx/api-core/auth';
import { moduleDisabled } from '@sparx/api-core/errors';

/** Derive the service context for an order handler. */
export function toOrderContext(request: FastifyRequest): ServiceContext {
  const auth = requireAuth(request);
  return { tenantId: auth.tenantId, userId: auth.actorId };
}

/** Modules that grant access to the shared order surface, in the precedence
 *  order the dashboard uses to resolve a module-agnostic order link. B2B
 *  requires Commerce in the dependency graph, but it is listed explicitly so
 *  the gate documents its own intent rather than relying on that coupling. */
const ORDER_MODULES = ['commerce', 'b2b', 'crm'] as const;

/** Throws MODULE_DISABLED (→ 404 envelope) unless the caller's tenant has at
 *  least one of Commerce / B2B / CRM active. Pairs with requireAuth — call it
 *  once per order handler before any service call.
 *
 *  Reports `commerce` as the disabled module because Commerce is the primary
 *  producer of orders and the module a tenant would activate to get them. */
export async function requireOrderAccess(request: FastifyRequest): Promise<void> {
  const auth = requireAuth(request);
  for (const module of ORDER_MODULES) {
    if (await isModuleEnabled(auth.tenantId, module)) return;
  }
  throw moduleDisabled('commerce');
}
