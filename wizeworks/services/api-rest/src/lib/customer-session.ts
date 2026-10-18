// Shared storefront customer-session plumbing (docs/27 v2, docs/113 §5). Resolves
// the signed-in shopper for the active site from EITHER:
//   1. the sparx_customer_session cookie (the storefront browser session), or
//   2. an `Authorization: Bearer <token>` customer MCP OAuth access token (a
//      shopper's LLM client — the storefront-MCP customer tier).
// Both resolve to the Better Auth user → the per-site `customers` membership
// (docs/58). Bearer sessions additionally carry the token's GRANTED SCOPES, which
// gate which customer routes the client may reach — fail-closed: a bearer can ONLY
// reach routes that explicitly declare a required scope.

import type { FastifyReply, FastifyRequest } from 'fastify';

import {
  ensureMembership,
  getCustomerSession,
  verifyCustomerMcpToken,
  type AwaitingConfirmation,
  type CustomerAuthContext,
  type EnsureMembershipNames,
  type EnsureMembershipResult,
} from '@wizeworks/customer-auth';
import { customerService } from '@wizeworks/crm';
import { withTenant } from '@wizeworks/db';
import { ApiError, forbidden, unauthorized } from '@wizeworks/api-core/errors';

import { resolvePublicPropertyId } from './property.js';

/** The raw request Cookie header — passed to Better Auth's getSession verbatim so
 *  IT resolves the session cookie name (which carries a `__Secure-` prefix in
 *  production; reconstructing `name=value` from a fixed name would miss it). */
function cookieHeader(request: FastifyRequest): string | undefined {
  const header = request.headers.cookie;
  return header && header.length > 0 ? header : undefined;
}

/** The `Authorization: Bearer <token>` credential, if present. */
function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header || typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
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
  /** Granted OAuth scopes when the request authenticated with a bearer token;
   *  `null` for a first-party cookie session (full account access). */
  scopes: ReadonlySet<string> | null;
}

/**
 * Find or create the per-site membership for a login, and TELL the platform when
 * that made somebody new or changed somebody it already had.
 *
 * Every route that resolves a login to a customer row goes through here, never
 * through `ensureMembership` directly. That one only writes; it lives in a
 * package that cannot reach the CRM bus. Called bare, a sign-up wrote the row and
 * stopped, so the search worker, the groups, the scores and "Welcome new
 * customers" never heard of the person: a buyer who registered on a wholesale
 * business's website was in the customer list and still missing from the
 * console's search box ten minutes later (sparx persona issue 086).
 *
 * `ensureMembership` has committed by the time it returns, so announcing here is
 * already after the commit.
 *
 *   - created: they made an account, so `crm.customer.created`. That is the
 *     event the welcome email answers, and the welcome email was written for
 *     exactly this person ("Thanks for joining").
 *   - adopted: a guest or imported row now carries their login, maybe a site and
 *     a name too. Somebody already known, changed, so `crm.customer.updated`.
 *   - neither: an ordinary signed-in request. Nothing happened, so nothing is said.
 */
export async function ensureAnnouncedMembership(
  ctx: CustomerAuthContext,
  propertyId: string | null,
  userId: string,
  email: string,
  names: EnsureMembershipNames,
  emailVerified: boolean
): Promise<EnsureMembershipResult | AwaitingConfirmation> {
  const result = await ensureMembership(ctx, propertyId, userId, email, names, emailVerified);
  if (result.awaitingConfirmation) return result;
  if (result.created) {
    await customerService.announceCustomer(ctx.tenantId, 'crm.customer.created', {
      id: result.customerId,
      type: 'retail',
      email,
    });
  } else if (result.adopted) {
    await customerService.announceCustomer(ctx.tenantId, 'crm.customer.updated', {
      id: result.customerId,
    });
  }
  return result;
}

/** What a request's login resolves to on this site: the membership, nobody, or a
 *  login that must confirm its email before the record under it is theirs. */
type Resolution = ResolvedCustomer | 'awaiting-confirmation' | null;

/** The answer a route gets for a login that has not confirmed the email a guest
 *  record sits under (sparx persona issue 329). `details.reason` lets the site
 *  say "check your email" rather than "sign in again". */
export function emailUnconfirmed(): ApiError {
  return new ApiError(
    'FORBIDDEN',
    'Confirm your email to open your account here. We sent you a link.',
    { reason: 'email_unconfirmed' }
  );
}

/** Adopt a resolved (userId, email) into the per-site membership + return it. */
async function toMembership(
  ctx: CustomerAuthContext,
  request: FastifyRequest,
  userId: string,
  email: string,
  scopes: ReadonlySet<string> | null,
  emailVerified: boolean
): Promise<Resolution> {
  const propertyId = await activeProperty(request, ctx.tenantId);
  const result = await ensureAnnouncedMembership(ctx, propertyId, userId, email, {}, emailVerified);
  if (result.awaitingConfirmation) return 'awaiting-confirmation';
  return { customerId: result.customerId, userId, scopes };
}

/**
 * Resolve the signed-in customer for the active site, or null when not signed in.
 * Cookie session wins; otherwise a customer MCP OAuth bearer (verified with expiry
 * + client-enabled + tenant-scoping via RLS). Ensures the per-site membership
 * exists (docs/58 D6 recognition).
 */
export async function optionalCustomer(
  request: FastifyRequest,
  ctx: CustomerAuthContext
): Promise<ResolvedCustomer | null> {
  const resolved = await resolveCustomer(request, ctx);
  return resolved === 'awaiting-confirmation' ? null : resolved;
}

async function resolveCustomer(
  request: FastifyRequest,
  ctx: CustomerAuthContext
): Promise<Resolution> {
  const session = await getCustomerSession(ctx, cookieHeader(request));
  if (session) {
    return toMembership(ctx, request, session.userId, session.email, null, session.emailVerified);
  }

  const token = bearerToken(request);
  if (token) {
    const verified = await verifyCustomerMcpToken(ctx.tenantId, token);
    if (verified) {
      // The token carries no email; the membership is resolved by (property,
      // authUserId) — ensureMembership adopts/creates by userId, so a null email
      // only matters for a brand-new membership (rare: a shopper who authorized an
      // MCP client before ever visiting this site). Load it from the user row.
      // A connected assistant was authorized from a signed-in account on this
      // site, so its membership already exists and resolves by login. A login
      // with no membership yet is not handed a guest record through a token
      // either: the same confirmation rule holds.
      const { email, emailVerified } = await customerUserEmail(ctx, verified.userId);
      return toMembership(
        ctx,
        request,
        verified.userId,
        email,
        new Set(verified.scopes),
        emailVerified
      );
    }
  }
  return null;
}

/** The Better Auth user's email (for a fresh membership on a bearer-first visit).
 *  RLS-scoped read of the tenant-scoped customer_users table. */
async function customerUserEmail(
  ctx: CustomerAuthContext,
  userId: string
): Promise<{ email: string; emailVerified: boolean }> {
  const row = await withTenant(ctx, (tx) =>
    tx.customerUser.findUnique({
      where: { id: userId },
      select: { email: true, emailVerified: true },
    })
  );
  return { email: row?.email ?? '', emailVerified: row?.emailVerified === true };
}

/**
 * Resolve the signed-in customer, enforcing an optional required scope. Throws 401
 * when unauthenticated. For a BEARER session: throws 403 unless the token's grant
 * includes `requiredScope` — and, fail-closed, throws 403 for ANY bearer on a route
 * that declares no scope (a bearer may only reach explicitly-exposed routes). A
 * cookie session always passes (full first-party access).
 */
export async function requireCustomer(
  request: FastifyRequest,
  ctx: CustomerAuthContext,
  requiredScope?: string
): Promise<ResolvedCustomer> {
  const resolved = await resolveCustomer(request, ctx);
  if (resolved === 'awaiting-confirmation') throw emailUnconfirmed();
  if (!resolved) throw unauthorized('Session expired. Please sign in again.');
  if (resolved.scopes !== null) {
    if (!requiredScope) {
      throw forbidden('This action is not available to a connected assistant.');
    }
    if (!resolved.scopes.has(requiredScope)) {
      throw forbidden(`Insufficient scope: this action requires "${requiredScope}".`);
    }
  }
  return resolved;
}

/** As requireCustomer, but returns just the per-site membership id (the shape the
 *  route handlers consume). */
export async function requireCustomerId(
  request: FastifyRequest,
  ctx: CustomerAuthContext,
  requiredScope?: string
): Promise<string> {
  return (await requireCustomer(request, ctx, requiredScope)).customerId;
}

/** Relay Better Auth's Set-Cookie header(s) onto the Fastify reply (sign-in /
 *  sign-up / sign-out set the session cookie inside Better Auth). */
export function relaySetCookies(reply: FastifyReply, setCookies: string[]): void {
  if (setCookies.length > 0) reply.header('set-cookie', setCookies);
}
