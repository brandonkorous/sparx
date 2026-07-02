// Shopper MCP OAuth access-token verification — the resource-server side
// (docs/113 customer tier). Mirrors the operator `verifyMcpOAuthToken` shape.
//
// The site MCP resource server ALWAYS knows its store (per-site host), so
// unlike the single-host operator flow this runs inside withTenant(knownTenant):
// RLS scopes the lookup, so a token issued for one store presented to another
// resolves to zero rows. We do NOT use Better Auth's getMcpSession (a bare row
// lookup that DOES NOT check expiry) — this query enforces expiry + client-
// enabled + a bound user in one atomic statement, with now() evaluated in
// Postgres so there is no app-vs-DB clock skew.

import { withTenant } from '@sparx/db';

export interface VerifiedCustomerMcp {
  tenantId: string;
  /** The Better Auth customer user (tenant-wide identity) the token acts as. */
  userId: string;
  /** Space-split granted scopes (the shopper MCP vocabulary + OIDC framing). */
  scopes: string[];
  /** The OAuth client the token was issued to — recorded as the audit actor. */
  clientId: string;
}

interface Row {
  user_id: string;
  scopes: string;
  client_id: string;
}

/** Resolve a shopper MCP OAuth access token to its user + scopes within the
 *  known store tenant, or null if unknown / expired / client disabled / no bound
 *  user. */
export function verifyCustomerMcpToken(
  tenantId: string,
  accessToken: string
): Promise<VerifiedCustomerMcp | null> {
  if (!accessToken) return Promise.resolve(null);

  return withTenant({ tenantId }, async (tx) => {
    const rows = await tx.$queryRaw<Row[]>`
      SELECT t.user_id, t.scopes, t.client_id
        FROM customer_oauth_access_tokens t
        JOIN customer_oauth_applications a ON a.client_id = t.client_id
       WHERE t.access_token = ${accessToken}
         AND t.access_token_expires_at > now()
         AND t.user_id IS NOT NULL
         AND a.disabled = false
       LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      tenantId,
      userId: row.user_id,
      scopes: row.scopes.split(' ').filter(Boolean),
      clientId: row.client_id,
    };
  });
}
