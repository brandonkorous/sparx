// Shared storefront customer-session plumbing (docs/27 v2). Resolves the
// sparx_customer_session cookie → the Better Auth user → the per-site `customers`
// membership for the active property (docs/58). Centralised here because the
// property resolution (resolvePublicPropertyId) is an api-rest concern, while the
// identity/session lives in @sparx/customer-auth.

import type { FastifyReply, FastifyRequest } from 'fastify';

import {
  ensureMembership,
  getCustomerSession,
  type CustomerAuthContext,
} from '@sparx/customer-auth';
import { unauthorized } from '@sparx/api-core/errors';

import { resolvePublicPropertyId } from './property.js';

/** The raw request Cookie header — passed to Better Auth's getSession verbatim so
 *  IT resolves the session cookie name (which carries a `__Secure-` prefix in
 *  production; reconstructing `name=value` from a fixed name would miss it). */
function cookieHeader(request: FastifyRequest): string | undefined {
  const header = request.headers.cookie;
  return header && header.length > 0 ? header : undefined;
}

/** The active site for this request (`?property=` or the tenant's primary). */
function activeProperty(request: FastifyRequest, tenantId: string): Promise<string | null> {
  return resolvePublicPropertyId(
    tenantId,
    (request.query as { property?: string }).property ?? null
  );
}

export interface ResolvedCustomer {
  /** The per-site `customers` membership id for the active property. */
  customerId: string;
  /** The Better Auth customer user id (tenant-wide identity). */
  userId: string;
}

/**
 * Resolve the signed-in customer for the active site, or null when not signed
 * in. Ensures the per-site membership exists (docs/58 D6 recognition: a first
 * authenticated visit to a sister site creates a membership with fresh consent).
 */
export async function optionalCustomer(
  request: FastifyRequest,
  ctx: CustomerAuthContext
): Promise<ResolvedCustomer | null> {
  const session = await getCustomerSession(ctx, cookieHeader(request));
  if (!session) return null;
  const propertyId = await activeProperty(request, ctx.tenantId);
  const { customerId } = await ensureMembership(ctx, propertyId, session.userId, session.email, {});
  return { customerId, userId: session.userId };
}

/** As optionalCustomer, but throws 401 when not signed in. Returns the per-site
 *  membership id (the shape the route handlers consume). */
export async function requireCustomerId(
  request: FastifyRequest,
  ctx: CustomerAuthContext
): Promise<string> {
  const resolved = await optionalCustomer(request, ctx);
  if (!resolved) throw unauthorized('Session expired. Please sign in again.');
  return resolved.customerId;
}

/** Relay Better Auth's Set-Cookie header(s) onto the Fastify reply (sign-in /
 *  sign-up / sign-out set the session cookie inside Better Auth). */
export function relaySetCookies(reply: FastifyReply, setCookies: string[]): void {
  if (setCookies.length > 0) reply.header('set-cookie', setCookies);
}
