// Shared gates for /v1/staff/* (docs/149).
//
// Two of them, and the second is the one worth reading.

import type { FastifyRequest } from 'fastify';
import { isModuleEnabled } from '@wizeworks/auth';
import { requireAuth, requireRole, type AuthContext } from '@wizeworks/api-core/auth';
import { moduleDisabled } from '@wizeworks/api-core/errors';

/**
 * Staff is a billable module, so EVERY route here gates on it — unlike finance,
 * which splits into a free money-in half and a billable money-out half. There is
 * no equivalent split: a roster is not a lens over data another module produced,
 * it is the module's own record.
 */
export async function requireStaffModule(request: FastifyRequest): Promise<void> {
  const auth = requireAuth(request);
  const enabled = await isModuleEnabled(auth.tenantId, 'staff');
  if (!enabled) throw moduleDisabled('staff');
}

/**
 * The pay gate — `admin` or higher.
 *
 * What a colleague earns, what their contract says, and what commission they
 * took are not roster facts. Every other module in the platform treats `viewer`
 * as "may read everything in this module", and that default is wrong exactly
 * once: here. A dispatcher who needs the schedule and a bookkeeper who needs the
 * wage total are both `editor` in most tenants, and only one of them should be
 * able to open a salary.
 *
 * So the split runs through this file rather than through each route's judgement:
 * hours, shifts, time off and certifications answer to the ordinary
 * viewer/editor ladder; rates, personnel documents, commissions and the costed
 * timesheet answer to this.
 */
export function requirePayAccess(request: FastifyRequest): AuthContext {
  return requireRole(request, 'admin');
}

/** True when the caller may see money. Used to decide whether a person's rate
 *  history rides along on their detail read, rather than forcing the surface to
 *  make a second call it may not be allowed to make. */
export function canSeePay(auth: AuthContext): boolean {
  return auth.role === 'admin' || auth.role === 'owner';
}
