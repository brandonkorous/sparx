// Shopper MCP OAuth access-token verification — the resource-server side
// (docs/113 customer tier). Mirrors the operator `verifyMcpOAuthToken`.
//
// The site MCP resource server ALWAYS knows its store (per-site host), so this
// runs inside withTenant(knownTenant) and RLS scopes every read: the signing
// keys, the registered resources and the consents are all that store's own.
//
// On Better Auth 1.7 the customer provider issues a SIGNED JWT (typ `at+jwt`,
// EdDSA, kid = a customer_jwks row) whenever the authorize request named the
// store's MCP server, which every MCP client does. The gates, in order:
//
//   1. the signature verifies against THIS store's key set, with the algorithm
//      that key was made for (a token signed by another store's key finds no
//      key under RLS and is refused before anything else is read);
//   2. it is an access token (`typ: at+jwt`), not an ID token, and unexpired;
//   3. its audience is a resource this store registered (customer_oauth_
//      resources, written at authorize time by registerStoreResource), and its
//      issuer is that resource's store: `<origin of aud>/v1/public/auth`;
//   4. the shopper's approval still exists and predates the token, and the
//      client is enabled. A self-contained token would otherwise keep working
//      until it expires after the connection is removed.
//
// A token minted WITHOUT a resource is opaque and stored as a SHA-256 hash;
// that is how every 1.6 customer token worked, so it is still accepted when the
// stored row is live (unexpired, unrevoked, bound to a shopper, client enabled).

import { createHash } from 'node:crypto';
import { withTenant } from '@wizeworks/db';
import {
  decodeProtectedHeader,
  errors as joseErrors,
  importJWK,
  jwtVerify,
  type JWK,
  type JWTPayload,
} from 'jose';

export interface VerifiedCustomerMcp {
  tenantId: string;
  /** The Better Auth customer user (tenant-wide identity) the token acts as. */
  userId: string;
  /** Granted scopes (the shopper MCP vocabulary + OIDC framing). */
  scopes: string[];
  /** The OAuth client the token was issued to — recorded as the audit actor. */
  clientId: string;
}

/** The customer instance's basePath: a store's issuer is its origin + this. */
export const CUSTOMER_AUTH_BASE_PATH = '/v1/public/auth';

/** One store's view of the OAuth tables (every read already tenant-scoped). */
export interface CustomerMcpStore {
  findSigningKey(kid: string): Promise<{ publicKey: string; alg: string | null } | null>;
  /** Which of `identifiers` are enabled resources of this store. */
  findResources(identifiers: string[]): Promise<string[]>;
  /** True when the client is enabled and the shopper approved it at or before
   *  `issuedAt`. */
  hasConsent(args: { userId: string; clientId: string; issuedAt: Date }): Promise<boolean>;
  /** A live opaque access token by its stored hash. */
  findOpaqueToken(
    hash: string
  ): Promise<{ userId: string; clientId: string; scopes: string[] } | null>;
}

const CLOCK_TOLERANCE_SECONDS = 5;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jwsHeader(token: string): { kid: string; alg: string; typ: string } | null {
  if (token.split('.').length !== 3) return null;
  try {
    const header = decodeProtectedHeader(token);
    if (typeof header.kid !== 'string' || typeof header.alg !== 'string') return null;
    return {
      kid: header.kid,
      alg: header.alg,
      typ: typeof header.typ === 'string' ? header.typ : '',
    };
  } catch {
    return null;
  }
}

function isAccessTokenType(typ: string): boolean {
  const t = typ.toLowerCase();
  return t === 'at+jwt' || t === 'application/at+jwt';
}

function audiences(aud: JWTPayload['aud']): string[] {
  if (typeof aud === 'string') return [aud];
  return Array.isArray(aud) ? aud : [];
}

/** The issuer a store's tokens carry, from the store resource they are for. */
function issuerFor(resource: string): string | null {
  try {
    return `${new URL(resource).origin}${CUSTOMER_AUTH_BASE_PATH}`;
  } catch {
    return null;
  }
}

/** Verify a shopper access token against one store's tables. Null for anything
 *  that fails a gate; never throws on a bad token. */
export async function verifyCustomerMcpTokenWith(
  tenantId: string,
  token: string,
  store: CustomerMcpStore,
  now: Date = new Date()
): Promise<VerifiedCustomerMcp | null> {
  if (!token) return null;

  const header = jwsHeader(token);
  if (!header) {
    const hash = createHash('sha256').update(token).digest('base64url');
    const row = await store.findOpaqueToken(hash);
    return row ? { tenantId, ...row } : null;
  }

  if (!isAccessTokenType(header.typ)) return null;
  const key = await store.findSigningKey(header.kid);
  if (!key) return null;
  const alg = key.alg ?? 'EdDSA';
  if (header.alg !== alg) return null;

  let payload: JWTPayload;
  try {
    const publicKey = await importJWK(JSON.parse(key.publicKey) as JWK, alg);
    ({ payload } = await jwtVerify(token, publicKey, {
      algorithms: [alg],
      currentDate: now,
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
      requiredClaims: ['sub', 'iat', 'exp', 'iss', 'aud'],
    }));
  } catch (err) {
    if (err instanceof joseErrors.JOSEError || err instanceof SyntaxError) return null;
    throw err;
  }

  const registered = await store.findResources(audiences(payload.aud));
  const resource = registered.find((r) => issuerFor(r) === payload.iss);
  if (!resource) return null;

  const userId = payload.sub;
  const clientId =
    typeof payload.client_id === 'string'
      ? payload.client_id
      : typeof payload.azp === 'string'
        ? payload.azp
        : null;
  if (!userId || !UUID.test(userId) || !clientId || typeof payload.iat !== 'number') return null;
  // `iat` is whole seconds and the consent row keeps milliseconds, so the token
  // counts as issued at the END of its second: one minted in the same second as
  // the approval is not "before" it.
  const issuedAt = new Date((payload.iat + 1) * 1000 - 1);
  if (!(await store.hasConsent({ userId, clientId, issuedAt }))) {
    return null;
  }

  const scope = typeof payload.scope === 'string' ? payload.scope : '';
  return { tenantId, userId, clientId, scopes: scope.split(' ').filter(Boolean) };
}

/** The production store: the tenant's customer_* tables under RLS. */
export function prismaCustomerMcpStore(tenantId: string): CustomerMcpStore {
  return {
    findSigningKey: (kid) =>
      UUID.test(kid)
        ? withTenant({ tenantId }, async (tx) => {
            const rows = await tx.$queryRaw<{ public_key: string; alg: string | null }[]>`
              SELECT public_key, alg FROM customer_jwks WHERE id = ${kid}::uuid LIMIT 1
            `;
            const row = rows[0];
            return row ? { publicKey: row.public_key, alg: row.alg } : null;
          })
        : Promise.resolve(null),

    findResources: (identifiers) =>
      identifiers.length === 0
        ? Promise.resolve([])
        : withTenant({ tenantId }, async (tx) => {
            const rows = await tx.$queryRaw<{ identifier: string }[]>`
              SELECT identifier FROM customer_oauth_resources
               WHERE identifier = ANY (${identifiers})
                 AND disabled = false
            `;
            return rows.map((r) => r.identifier);
          }),

    hasConsent: ({ userId, clientId, issuedAt }) =>
      withTenant({ tenantId }, async (tx) => {
        const rows = await tx.$queryRaw<{ id: string }[]>`
          SELECT c.id
            FROM customer_oauth_consents c
            JOIN customer_oauth_clients a ON a.client_id = c.client_id
           WHERE c.user_id = ${userId}::uuid
             AND c.client_id = ${clientId}
             AND a.disabled = false
             AND c.created_at <= ${issuedAt}
           LIMIT 1
        `;
        return rows.length > 0;
      }),

    findOpaqueToken: (hash) =>
      withTenant({ tenantId }, async (tx) => {
        const rows = await tx.$queryRaw<{ user_id: string; client_id: string; scopes: string[] }[]>`
          SELECT t.user_id, t.client_id, t.scopes
            FROM customer_oauth_access_tokens t
            JOIN customer_oauth_clients a ON a.client_id = t.client_id
           WHERE t.token = ${hash}
             AND t.expires_at > now()
             AND t.revoked IS NULL
             AND t.user_id IS NOT NULL
             AND a.disabled = false
           LIMIT 1
        `;
        const row = rows[0];
        return row ? { userId: row.user_id, clientId: row.client_id, scopes: row.scopes } : null;
      }),
  };
}

/** Resolve a shopper MCP OAuth access token to its user + scopes within the
 *  known store tenant, or null if it fails any gate above. */
export function verifyCustomerMcpToken(
  tenantId: string,
  accessToken: string
): Promise<VerifiedCustomerMcp | null> {
  return verifyCustomerMcpTokenWith(tenantId, accessToken, prismaCustomerMcpStore(tenantId));
}
