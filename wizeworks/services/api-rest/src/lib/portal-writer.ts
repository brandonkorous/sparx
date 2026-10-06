// Who may CHANGE something on a trade account in the customer portal (sparx
// persona issue 086).
//
// A connected app (a customer MCP bearer) signs in with the scopes the customer
// granted it, and the only B2B scope there is, `b2b:read`, says read. Sending
// or answering a quote can place an order; building a quote request sends work
// to the business; Order again and saved carts fill a cart. None of that is
// reading, so every portal route that changes something takes a first-party
// website session. The fleet routes (b2b-portal-fleet.ts) follow the same rule.
//
// Reads are untouched: a connected app keeps every portal read `b2b:read`
// grants.

import type { FastifyRequest } from 'fastify';
import { forbidden } from '@wizeworks/api-core/errors';
import type { CustomerAuthContext } from '@wizeworks/customer-auth';

import { requireCustomer, type ResolvedCustomer } from './customer-session.js';

/** A first-party website session carries no scopes; a connected app always
 *  carries some. */
export function isWebsiteSession(customer: Pick<ResolvedCustomer, 'scopes'>): boolean {
  return customer.scopes === null;
}

/** The signed-in customer, when they are signed in on the website; 403 for a
 *  connected app. Returns the per-site customer id. */
export async function requirePortalWriter(
  request: FastifyRequest,
  ctx: CustomerAuthContext
): Promise<string> {
  const customer = await requireCustomer(request, ctx, 'b2b:read');
  if (!isWebsiteSession(customer)) {
    throw forbidden(
      'A connected app can read this account but cannot order, change a cart or send a request on it. Sign in on the website to do that.'
    );
  }
  return customer.customerId;
}
