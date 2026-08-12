import type { FastifyRequest } from 'fastify';
import { isModuleEnabled } from '@sparx/auth';
import { requireAuth } from '@sparx/api-core/auth';
import { moduleDisabled } from '@sparx/api-core/errors';

export interface FinanceContext {
  tenantId: string;
  userId: string;
}

/**
 * The active-site header, narrowed to what `resolvePropertyId` accepts.
 *
 * Fastify types a header as `string | string[]` because a client may legally
 * send it twice. A repeated site header is meaningless — there is one active
 * site — so a duplicate is treated as absent rather than silently picking the
 * first, which would let a stray second header decide which business a bill
 * gets filed against.
 */
export function headerPropertyId(request: FastifyRequest): string | null {
  const header = request.headers['x-sparx-property-id'];
  return typeof header === 'string' ? header : null;
}

export function toFinanceContext(request: FastifyRequest): FinanceContext {
  const auth = requireAuth(request);
  return { tenantId: auth.tenantId, userId: auth.actorId };
}

/**
 * Gate every SPEND route on the `finance` module flag (locked decision #6: a
 * disabled module returns a clean MODULE_DISABLED, never rows).
 *
 * Note what this does NOT gate. The money-IN surfaces (payments, payouts,
 * receivables, channel breakdown) are a free view of data the tenant already
 * bought with commerce/invoicing/b2b, and they live behind their own modules'
 * routes — this gate is only for the billable half (docs/148 §2).
 */
export async function requireFinanceModule(request: FastifyRequest): Promise<void> {
  const auth = requireAuth(request);
  const enabled = await isModuleEnabled(auth.tenantId, 'finance');
  if (!enabled) throw moduleDisabled('finance');
}
