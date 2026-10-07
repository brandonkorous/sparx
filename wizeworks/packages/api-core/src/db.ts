// Database access helpers for route handlers.
//
// Every tenant-scoped query MUST go through `withRequestTenant` so the
// `app.tenant_id` GUC is set inside the transaction and Row Level Security
// enforces isolation. Talking to the bare `prisma` client from a route is
// a bug — RLS policies are FORCE'd, so an un-scoped query silently returns
// zero rows rather than leaking, but the error is mysterious. This helper
// makes the right thing the easy thing.
//
// PLATFORM_TENANT_ID is the sentinel tenant id that owns built-in content
// types; the `content_types` RLS policy exposes those rows to every tenant
// implicitly, so routes don't usually need to switch to it.

import { withTenant, type TxClient } from '@wizeworks/db';
import { PLATFORM_TENANT_ID } from '@wizeworks/cms-schemas';
import type { FastifyRequest } from 'fastify';
import { requireAuth } from './auth.js';

export { PLATFORM_TENANT_ID };

export function withRequestTenant<T>(
  request: FastifyRequest,
  fn: (tx: TxClient) => Promise<T>
): Promise<T> {
  const auth = requireAuth(request);
  return withTenant({ tenantId: auth.tenantId, userId: auth.actorId }, fn);
}

// Sentinel-tenant variant — used by the boot-time upsert of BUILT_IN_CONTENT
// _TYPES and by background workers that need to read platform-owned data.
// Should not be used inside a request handler.

export function withPlatformTenant<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
  return withTenant({ tenantId: PLATFORM_TENANT_ID }, fn);
}

/**
 * Run `fn` against the signed-in person's OWN user row, in their home business.
 *
 * A person's row belongs to the business they signed up under (`users.tenant_id`)
 * and RLS lets that row be written only from there. Someone who joined another
 * business works inside it, where the row is readable (they are a member) but not
 * writable: every save of their own settings (the tour, consent, view defaults,
 * notification choices) failed with a 500. Gillett's service manager, Mike, could
 * not dismiss his welcome tour (sparx persona issue 122).
 *
 * The home business is read from the row itself, never taken from the request,
 * so this reaches no row but the caller's own.
 */
export async function withOwnUserRow<T>(
  request: FastifyRequest,
  fn: (tx: TxClient, userId: string) => Promise<T>
): Promise<T> {
  const auth = requireAuth(request);
  const userId = auth.actorId;
  if (!userId) throw new Error('withOwnUserRow needs a signed-in person, not an API key.');
  const home = await withTenant({ tenantId: auth.tenantId, userId }, (tx) =>
    tx.user.findUnique({ where: { id: userId }, select: { tenantId: true } })
  );
  const tenantId = home?.tenantId ?? auth.tenantId;
  return withTenant({ tenantId, userId }, (tx) => fn(tx, userId));
}
