// MCP OAuth connection management (docs/07 §5) — the tenant-facing view of
// "which AI assistants are connected, and the kill switch to cut them off".
//
// The OAuth tables are NOT tenant-scoped (a client self-registers via public
// DCR before any tenant is known), so we scope every query transitively through
// the token's owning user (users.tenant_id) and run as sparx_owner via
// authPrisma — the only role permitted to read these RLS-fenced tables. This
// mirrors listApiKeys/revokeApiKey.

import { authPrisma } from './prisma';

export interface RegisteredMcpClient {
  clientId: string;
  name: string | null;
  /** Exact-match redirect URI allowlist (DCR-registered). */
  redirectUrls: string[];
  /** 'public' (PKCE) | 'web' (confidential) | … */
  type: string;
  disabled: boolean;
}

/** Look up a DCR-registered client by its client_id — used by the consent page
 *  to render who is asking and to validate the redirect URI. Returns null if
 *  unknown. */
export async function getRegisteredMcpClient(
  clientId: string
): Promise<RegisteredMcpClient | null> {
  if (!clientId) return null;
  const rows = await authPrisma.$queryRaw<
    {
      client_id: string;
      name: string | null;
      redirect_urls: string;
      type: string;
      disabled: boolean;
    }[]
  >`
    SELECT client_id, name, redirect_urls, type, disabled
      FROM oauth_applications
     WHERE client_id = ${clientId}
     LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    clientId: row.client_id,
    name: row.name,
    redirectUrls: row.redirect_urls.split(',').filter(Boolean),
    type: row.type,
    disabled: row.disabled,
  };
}

export interface McpConnectionSummary {
  clientId: string;
  clientName: string | null;
  /** Union of scopes across this connection's tokens for the tenant. */
  scopes: string[];
  /** How many live token pairs this client holds for the tenant. */
  tokenCount: number;
  /** First time this client was authorized for the tenant. */
  firstAuthorizedAt: Date;
  /** Most recent authorization/refresh. */
  lastAuthorizedAt: Date;
  /** Latest access-token expiry across the connection's tokens. */
  accessExpiresAt: Date;
}

interface ListRow {
  client_id: string;
  client_name: string | null;
  token_count: number;
  first_authorized_at: Date;
  last_authorized_at: Date;
  access_expires_at: Date;
  scope_strings: string[];
}

/** List the tenant's connected MCP OAuth clients (those with at least one
 *  non-expired refresh token — i.e. still live). Ordered newest-first. */
export async function listMcpConnections(tenantId: string): Promise<McpConnectionSummary[]> {
  const rows = await authPrisma.$queryRaw<ListRow[]>`
    SELECT a.client_id,
           a.name                             AS client_name,
           count(t.id)::int                   AS token_count,
           min(t.created_at)                  AS first_authorized_at,
           max(t.created_at)                  AS last_authorized_at,
           max(t.access_token_expires_at)     AS access_expires_at,
           array_agg(DISTINCT t.scopes)       AS scope_strings
      FROM oauth_access_tokens t
      JOIN users u              ON u.id = t.user_id
      JOIN oauth_applications a ON a.client_id = t.client_id
     WHERE u.tenant_id = ${tenantId}::uuid
       AND a.disabled = false
       AND t.refresh_token_expires_at > now()
     GROUP BY a.client_id, a.name
     ORDER BY max(t.created_at) DESC
  `;

  return rows.map((r) => {
    const scopes = new Set<string>();
    for (const s of r.scope_strings ?? []) {
      for (const scope of s.split(' ')) if (scope) scopes.add(scope);
    }
    return {
      clientId: r.client_id,
      clientName: r.client_name,
      scopes: [...scopes],
      tokenCount: r.token_count,
      firstAuthorizedAt: r.first_authorized_at,
      lastAuthorizedAt: r.last_authorized_at,
      accessExpiresAt: r.access_expires_at,
    };
  });
}

/** Revoke a connection: delete every token this client holds for THIS tenant's
 *  users (a shared client keeps other tenants' tokens). Returns the count
 *  removed. The client registration row is left intact — harmless without a
 *  token, and a fresh authorization must pass consent again. */
export async function revokeMcpConnection(tenantId: string, clientId: string): Promise<number> {
  const deleted = await authPrisma.$executeRaw`
    DELETE FROM oauth_access_tokens t
     USING users u
     WHERE t.user_id = u.id
       AND u.tenant_id = ${tenantId}::uuid
       AND t.client_id = ${clientId}
  `;
  return deleted;
}
