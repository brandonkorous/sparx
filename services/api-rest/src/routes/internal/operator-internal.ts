// Shared auth + error helpers for the operator internal seam (docs/apps/admin/
// build-plan.md §2 D6, §7). Used by every `/internal/operator/*` plugin so the
// Layer-5 shared-secret check lives in exactly ONE place — security code must not
// be duplicated across route files.

import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { prisma } from '@sparx/db';
import { INTERNAL_OPERATOR_TOKEN_HEADER, OPERATOR_ID_HEADER } from '@sparx/operator';

import { env } from '../../env.js';

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}
export function unauthorized(message: string): HttpError {
  return new HttpError(401, 'UNAUTHORIZED', message);
}
export function badRequest(message: string): HttpError {
  return new HttpError(400, 'BAD_REQUEST', message);
}
export function notFound(message: string): HttpError {
  return new HttpError(404, 'NOT_FOUND', message);
}

/** Constant-time shared-secret check, fail-closed. Throws 401 on any mismatch or
 *  when the token is unconfigured (a forgotten secret must surface loudly, never
 *  silently allow). */
export function authorizeOperator(request: FastifyRequest): void {
  const expected = env.SPARX_INTERNAL_OPERATOR_TOKEN;
  if (!expected) {
    throw unauthorized('Internal operator token is not configured.');
  }
  const provided = request.headers[INTERNAL_OPERATOR_TOKEN_HEADER];
  if (typeof provided !== 'string' || provided.length === 0) {
    throw unauthorized('Missing X-sparx-Internal-Operator-Token header.');
  }
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw unauthorized('Invalid operator token.');
  }
}

/** The operator id the admin app attributed this call to (for audit), or null. */
export function operatorIdOf(request: FastifyRequest): string | null {
  const raw = request.headers[OPERATOR_ID_HEADER];
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

/** Resolve a set of tenant ids to their name/slug in one non-RLS read (the
 *  `tenants` dispatch table). Shared by the cross-tenant operator surfaces
 *  (support search, feedback inbox) that resolve a hit's `tenant_id` to a name. */
export async function resolveTenantNames(
  ids: string[]
): Promise<Map<string, { name: string; slug: string }>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return new Map();
  const rows = await prisma.tenant.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, slug: true },
  });
  return new Map(rows.map((r) => [r.id, { name: r.name, slug: r.slug }]));
}
