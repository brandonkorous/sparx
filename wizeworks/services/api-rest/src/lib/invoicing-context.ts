// Bridge between Fastify auth context and the invoicing services' ServiceContext.
//
// The invoicing module (docs/87) lives on the CRM customer spine, so its
// services reuse @wizeworks/crm's ServiceContext. Routes gate on the dedicated
// `invoicing` module flag (not `crm`) — a tenant can bill without running the
// full CRM surface, and vice versa.

import type { FastifyRequest } from 'fastify';
import type { ServiceContext } from '@wizeworks/crm';
import { isModuleEnabled } from '@wizeworks/auth';
import { requireAuth } from '@wizeworks/api-core/auth';
import { moduleDisabled } from '@wizeworks/api-core/errors';

export function toInvoicingContext(request: FastifyRequest): ServiceContext {
  const auth = requireAuth(request);
  return { tenantId: auth.tenantId, userId: auth.actorId };
}

/** Throws MODULE_DISABLED (→ 404 envelope) if the caller's tenant doesn't have
 *  the invoicing module active. Pairs with requireAuth — call once per handler
 *  before any service call. */
export async function requireInvoicingModule(request: FastifyRequest): Promise<void> {
  const auth = requireAuth(request);
  const enabled = await isModuleEnabled(auth.tenantId, 'invoicing');
  if (!enabled) throw moduleDisabled('invoicing');
}
