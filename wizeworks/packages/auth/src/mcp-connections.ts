// MCP OAuth connection management (docs/07 §5) — the tenant-facing view of
// "which AI assistants are connected, and the kill switch to cut them off".
//
// The OAuth tables are NOT tenant-scoped (a client self-registers via public
// DCR before any tenant is known), so we scope every query transitively through
// the owning user (users.tenant_id) and run as sparx_owner via authPrisma — the
// only role permitted to read these RLS-fenced tables. This mirrors
// listApiKeys/revokeApiKey.
//
// A CONNECTION IS A CONSENT. On Better Auth 1.7 the access tokens are signed
// JWTs that are never stored, so "has a live token" cannot be the test any
// more. What exists is the person's recorded approval (oauth_consents) and the
// refresh tokens that keep it going. verifyMcpOAuthToken refuses any access
// token whose consent row is gone, so deleting the consent is what disconnects
// an assistant, immediately and including the token it is holding right now.

import { authPrisma } from './prisma';

export interface RegisteredMcpClient {
  clientId: string;
  name: string | null;
  /** Exact-match redirect URI allowlist (DCR-registered). */
  redirectUrls: string[];
  disabled: boolean;
}

/** Look up a registered client by its client_id — used by the consent page to
 *  name who is asking. Returns null if unknown. */
export async function getRegisteredMcpClient(
  clientId: string
): Promise<RegisteredMcpClient | null> {
  if (!clientId) return null;
  const rows = await authPrisma.$queryRaw<
    { client_id: string; name: string | null; redirect_uris: string[]; disabled: boolean }[]
  >`
    SELECT client_id, name, redirect_uris, disabled
      FROM oauth_clients
     WHERE client_id = ${clientId}
     LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    clientId: row.client_id,
    name: row.name,
    redirectUrls: row.redirect_uris,
    disabled: row.disabled,
  };
}

export interface McpConnectionSummary {
  clientId: string;
  clientName: string | null;
  /** Union of the scopes this tenant's people approved for the client. */
  scopes: string[];
  /** How many unexpired, unrevoked sign-ins (refresh tokens) the client holds
   *  for the tenant. */
  tokenCount: number;
  /** First time this client was approved for the tenant. */
  firstAuthorizedAt: Date;
  /** Most recent approval or token refresh. */
  lastAuthorizedAt: Date;
}

interface ListRow {
  client_id: string;
  client_name: string | null;
  scopes: string[] | null;
  first_authorized_at: Date;
  last_consent_at: Date;
  token_count: number;
  last_refresh_at: Date | null;
}

/** List the tenant's connected MCP OAuth clients: every enabled client a
 *  person in this tenant has approved. Ordered newest-first. */
export async function listMcpConnections(tenantId: string): Promise<McpConnectionSummary[]> {
  const rows = await authPrisma.$queryRaw<ListRow[]>`
    WITH consents AS (
      SELECT c.client_id,
             array_agg(DISTINCT s)                         AS scopes,
             min(c.created_at)                             AS first_authorized_at,
             max(coalesce(c.updated_at, c.created_at))     AS last_consent_at
        FROM oauth_consents c
        JOIN users u ON u.id = c.user_id
        LEFT JOIN LATERAL unnest(c.scopes) AS s ON true
       WHERE u.tenant_id = ${tenantId}::uuid
       GROUP BY c.client_id
    ),
    tokens AS (
      SELECT r.client_id,
             count(*)::int     AS token_count,
             max(r.created_at) AS last_refresh_at
        FROM oauth_refresh_tokens r
        JOIN users u ON u.id = r.user_id
       WHERE u.tenant_id = ${tenantId}::uuid
         AND r.revoked IS NULL
         AND (r.expires_at IS NULL OR r.expires_at > now())
       GROUP BY r.client_id
    )
    SELECT a.client_id,
           a.name                          AS client_name,
           k.scopes,
           k.first_authorized_at,
           k.last_consent_at,
           coalesce(t.token_count, 0)::int AS token_count,
           t.last_refresh_at
      FROM consents k
      JOIN oauth_clients a ON a.client_id = k.client_id
      LEFT JOIN tokens t   ON t.client_id = k.client_id
     WHERE a.disabled = false
     ORDER BY greatest(k.last_consent_at, coalesce(t.last_refresh_at, k.last_consent_at)) DESC
  `;

  return rows.map((r) => ({
    clientId: r.client_id,
    clientName: r.client_name,
    scopes: (r.scopes ?? []).filter((s): s is string => typeof s === 'string' && s.length > 0),
    tokenCount: r.token_count,
    firstAuthorizedAt: r.first_authorized_at,
    lastAuthorizedAt:
      r.last_refresh_at && r.last_refresh_at > r.last_consent_at
        ? r.last_refresh_at
        : r.last_consent_at,
  }));
}

/** Revoke a connection for THIS tenant's people (a shared client keeps other
 *  tenants' connections): delete their consents, refresh tokens and any opaque
 *  access tokens for the client. Returns how many consents were removed, i.e.
 *  how many people's approvals ended. The client registration row is left
 *  intact — harmless without a consent, and reconnecting asks again. */
export async function revokeMcpConnection(tenantId: string, clientId: string): Promise<number> {
  const [consents] = await authPrisma.$transaction([
    authPrisma.$executeRaw`
      DELETE FROM oauth_consents c
       USING users u
       WHERE c.user_id = u.id
         AND u.tenant_id = ${tenantId}::uuid
         AND c.client_id = ${clientId}
    `,
    // Access tokens first: an opaque one can point at a refresh token.
    authPrisma.$executeRaw`
      DELETE FROM oauth_access_tokens t
       USING users u
       WHERE t.user_id = u.id
         AND u.tenant_id = ${tenantId}::uuid
         AND t.client_id = ${clientId}
    `,
    authPrisma.$executeRaw`
      DELETE FROM oauth_refresh_tokens r
       USING users u
       WHERE r.user_id = u.id
         AND u.tenant_id = ${tenantId}::uuid
         AND r.client_id = ${clientId}
    `,
  ]);
  return consents;
}
