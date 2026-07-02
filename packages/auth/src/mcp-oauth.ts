// MCP OAuth access-token verification — the resource-server side (docs/07 §5).
//
// The resource server (api-mcp) receives an opaque 32-char access token as a
// Bearer credential and must resolve it to a tenant + scopes. We do NOT use
// Better Auth's `auth.api.getMcpSession` for this: that helper does a bare
// row lookup and — critically — DOES NOT CHECK EXPIRY, so an expired token
// would authenticate forever. Instead we run one atomic query (as sparx_owner,
// the only role that can read these RLS-fenced tables) that enforces every
// gate at once:
//   • the token exists,
//   • it has not expired,
//   • its client has not been disabled/revoked, and
//   • resolves the owning user's tenant.
// Mirrors verifyApiKey's shape so the MCP transport treats all three auth
// paths (internal JWT, sk_live_ API key, OAuth token) uniformly.

import { authPrisma } from './prisma';

export interface VerifiedMcpOAuth {
  tenantId: string;
  userId: string;
  /** Space-split granted scopes (the platform MCP vocabulary the user picked
   *  at consent, plus OIDC framing scopes). */
  scopes: string[];
  /** The OAuth client this token was issued to — recorded as the audit actor. */
  clientId: string;
}

interface Row {
  tenant_id: string;
  user_id: string;
  scopes: string;
  client_id: string;
}

/** Resolve an MCP OAuth access token to its tenant + scopes, or null if the
 *  token is unknown, expired, or its client is disabled. `now()` is evaluated
 *  in Postgres so there is no app-vs-DB clock skew. */
export async function verifyMcpOAuthToken(accessToken: string): Promise<VerifiedMcpOAuth | null> {
  if (!accessToken) return null;

  const rows = await authPrisma.$queryRaw<Row[]>`
    SELECT u.tenant_id, t.user_id, t.scopes, t.client_id
      FROM oauth_access_tokens t
      JOIN users u              ON u.id = t.user_id
      JOIN oauth_applications a ON a.client_id = t.client_id
     WHERE t.access_token = ${accessToken}
       AND t.access_token_expires_at > now()
       AND a.disabled = false
     LIMIT 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    tenantId: row.tenant_id,
    userId: row.user_id,
    scopes: row.scopes.split(' ').filter(Boolean),
    clientId: row.client_id,
  };
}
