// MCP OAuth access-token verification — the resource-server side (docs/07 §5).
//
// On Better Auth 1.7 the MCP provider issues SIGNED JWT access tokens (typ
// `at+jwt`, EdDSA, key id = the `jwks` row) whenever the request names a
// resource, and every MCP client names ours (the provider also applies it as
// the default for registered clients). api-mcp receives that token as a Bearer
// credential and must resolve it to a tenant + scopes. Every gate is enforced
// here, in this order:
//
//   1. the signature verifies against OUR key set (read from `jwks`, never from
//      a URL the token names), with the algorithm that key was made for;
//   2. it is an access token (`typ: at+jwt`), not an ID token;
//   3. it was issued by THIS brand's authorization server for THIS brand's MCP
//      server (`iss` + `aud`, passed in by the caller from the request's host,
//      so a token for one brand's server is refused at the other's);
//   4. it has not expired (jose, with a small clock tolerance);
//   5. the person's approval still exists and predates the token, and the
//      client is not disabled. This is what makes "Disconnect" in AI
//      Connections immediate: the access token is self-contained and would
//      otherwise keep working until it expires, so a token whose consent row is
//      gone, or was minted before the current consent was given, is refused;
//   6. the owning user's tenant is resolved (users.tenant_id).
//
// A token minted without a resource is OPAQUE and stored as a SHA-256 hash; it
// is accepted only when that stored row lists our server among its resources,
// so a token meant for the provider's own userinfo endpoint is never a key to
// the MCP server.
//
// The DB reads run as sparx_owner via authPrisma, the only role that can read
// these RLS-fenced tables. They sit behind `McpOAuthStore` so the verification
// logic is tested with real keys and real signatures and no database.

import { createHash } from 'node:crypto';
import {
  decodeProtectedHeader,
  errors as joseErrors,
  importJWK,
  jwtVerify,
  type JWK,
  type JWTPayload,
} from 'jose';

import { authPrisma } from './prisma';

export interface VerifiedMcpOAuth {
  tenantId: string;
  userId: string;
  /** Granted scopes (the platform MCP vocabulary the user approved, plus OIDC
   *  framing scopes). */
  scopes: string[];
  /** The OAuth client this token was issued to — recorded as the audit actor. */
  clientId: string;
}

/** Who must have issued the token and for which resource. */
export interface McpOAuthExpectation {
  /** The authorization server's issuer identifier (the brand's account origin). */
  issuer: string;
  /** The MCP server's resource identifier (RFC 8707). */
  audience: string;
}

export interface McpOAuthStore {
  /** A signing key by its id, as the jwt() plugin stored it. */
  findSigningKey(kid: string): Promise<{ publicKey: string; alg: string | null } | null>;
  /** The user's tenant when the client is enabled and holds a consent from that
   *  user given at or before `issuedAt`; otherwise null. */
  findConsentedTenant(args: {
    userId: string;
    clientId: string;
    issuedAt: Date;
  }): Promise<string | null>;
  /** A live opaque access token by its stored hash, if it was issued for
   *  `audience`. */
  findOpaqueToken(
    hash: string,
    audience: string
  ): Promise<{ tenantId: string; userId: string; clientId: string; scopes: string[] } | null>;
}

/** Seconds of clock skew tolerated on `exp`/`iat`/`nbf`. */
const CLOCK_TOLERANCE_SECONDS = 5;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The key id + algorithm on a compact JWS, or null if it is not one. */
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

/** RFC 9068 §4: `at+jwt`, optionally with the `application/` prefix. */
function isAccessTokenType(typ: string): boolean {
  const t = typ.toLowerCase();
  return t === 'at+jwt' || t === 'application/at+jwt';
}

function audiences(aud: JWTPayload['aud']): string[] {
  if (typeof aud === 'string') return [aud];
  return Array.isArray(aud) ? aud : [];
}

function hashOpaque(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

/** Verify an MCP OAuth access token against `expected` using `store`. Null for
 *  anything that fails any gate; never throws on a bad token. */
export async function verifyMcpOAuthTokenWith(
  token: string,
  expected: McpOAuthExpectation,
  store: McpOAuthStore,
  now: Date = new Date()
): Promise<VerifiedMcpOAuth | null> {
  if (!token) return null;

  const header = jwsHeader(token);
  if (!header) {
    const row = await store.findOpaqueToken(hashOpaque(token), expected.audience);
    return row ? { ...row } : null;
  }

  if (!isAccessTokenType(header.typ)) return null;
  const key = await store.findSigningKey(header.kid);
  if (!key) return null;
  // The algorithm comes from OUR key row, never from the token, so a token
  // cannot pick a weaker one (alg confusion). Rows written before the column
  // existed default to the jwt() plugin's EdDSA.
  const alg = key.alg ?? 'EdDSA';
  if (header.alg !== alg) return null;

  let payload: JWTPayload;
  try {
    const jwk = JSON.parse(key.publicKey) as JWK;
    const publicKey = await importJWK(jwk, alg);
    ({ payload } = await jwtVerify(token, publicKey, {
      algorithms: [alg],
      issuer: expected.issuer,
      audience: expected.audience,
      currentDate: now,
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
      requiredClaims: ['sub', 'iat', 'exp'],
    }));
  } catch (err) {
    if (err instanceof joseErrors.JOSEError || err instanceof SyntaxError) return null;
    throw err;
  }

  if (!audiences(payload.aud).includes(expected.audience)) return null;
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
  const tenantId = await store.findConsentedTenant({
    userId,
    clientId,
    issuedAt: new Date((payload.iat + 1) * 1000 - 1),
  });
  if (!tenantId) return null;

  const scope = typeof payload.scope === 'string' ? payload.scope : '';
  return { tenantId, userId, clientId, scopes: scope.split(' ').filter(Boolean) };
}

/** The production store: the staff instance's tables, read as sparx_owner. */
export const prismaMcpOAuthStore: McpOAuthStore = {
  async findSigningKey(kid) {
    if (!UUID.test(kid)) return null;
    const rows = await authPrisma.$queryRaw<{ public_key: string; alg: string | null }[]>`
      SELECT public_key, alg FROM jwks WHERE id = ${kid}::uuid LIMIT 1
    `;
    const row = rows[0];
    return row ? { publicKey: row.public_key, alg: row.alg } : null;
  },

  async findConsentedTenant({ userId, clientId, issuedAt }) {
    const rows = await authPrisma.$queryRaw<{ tenant_id: string }[]>`
      SELECT u.tenant_id
        FROM oauth_consents c
        JOIN users u         ON u.id = c.user_id
        JOIN oauth_clients a ON a.client_id = c.client_id
       WHERE c.user_id = ${userId}::uuid
         AND c.client_id = ${clientId}
         AND a.disabled = false
         AND c.created_at <= ${issuedAt}
       LIMIT 1
    `;
    return rows[0]?.tenant_id ?? null;
  },

  async findOpaqueToken(hash, audience) {
    const rows = await authPrisma.$queryRaw<
      { tenant_id: string; user_id: string; client_id: string; scopes: string[] }[]
    >`
      SELECT u.tenant_id, t.user_id, t.client_id, t.scopes
        FROM oauth_access_tokens t
        JOIN users u         ON u.id = t.user_id
        JOIN oauth_clients a ON a.client_id = t.client_id
       WHERE t.token = ${hash}
         AND t.expires_at > now()
         AND t.revoked IS NULL
         AND a.disabled = false
         AND ${audience} = ANY (t.resources)
       LIMIT 1
    `;
    const row = rows[0];
    return row
      ? {
          tenantId: row.tenant_id,
          userId: row.user_id,
          clientId: row.client_id,
          scopes: row.scopes,
        }
      : null;
  },
};

/** Resolve an MCP OAuth access token to its tenant + scopes, or null if it is
 *  invalid, expired, for another server, or its connection was revoked. */
export function verifyMcpOAuthToken(
  token: string,
  expected: McpOAuthExpectation
): Promise<VerifiedMcpOAuth | null> {
  return verifyMcpOAuthTokenWith(token, expected, prismaMcpOAuthStore);
}
