// The shopper authorization server's public surface (docs/113 §5, docs/27 §6):
// discovery, and the server side of the store-branded consent page.
//
// The customer instance is the AS; api-rest mounts its handler under
// `<store-origin>/v1/public/auth/*` (Caddy routes that path to api-rest, so the
// AS lives on the store's OWN origin, where the sparx_customer_session cookie
// lives).
//
// On Better Auth 1.7 the provider owns the authorization request. When a
// shopper has to sign in or approve, `/oauth2/authorize` sends the browser to
// `<store>/account/authorize` with the whole request in the query string,
// SIGNED with the instance secret and stamped with an expiry. That signature
// is what makes the consent page safe: the client, the redirect address and the
// requested scopes are exactly what the provider validated. So the page only
// verifies it, names the client, lets the shopper choose, and hands the
// decision back to `/oauth2/consent`, which records it and finishes the flow.

import { verifyOAuthQueryParams } from '@better-auth/oauth-provider';
import { tenantStore, withTenant } from '@wizeworks/db';

import { capCustomerScopes, CUSTOMER_OIDC_BASE_SCOPES } from './mcp-scopes';
import { customerAuthSecret, getCustomerAuth } from './server';

/**
 * The provider's own discovery document for the store this request is on.
 *
 * Built by the provider from its live configuration, with the per-request base
 * URL, so `issuer` is `<store>/v1/public/auth` and every endpoint is on the
 * store's origin: the document cannot advertise anything the server does not
 * do. `headers` must carry the store's Host (api-rest passes the request's).
 */
export async function customerDiscoveryDocument(
  kind: 'oauth' | 'openid',
  headers: Headers
): Promise<unknown> {
  const auth = getCustomerAuth();
  return kind === 'openid'
    ? await auth.api.getOpenIdConfig({ headers })
    : await auth.api.getOAuthServerConfig({ headers });
}

// ─── Registered DCR client lookup ────────────────────────────────────────────

export interface RegisteredCustomerMcpClient {
  clientId: string;
  name: string | null;
  /** Exact-match redirect URI allowlist (DCR-registered). */
  redirectUrls: string[];
  disabled: boolean;
}

/** Look up a DCR-registered customer client by client_id within the tenant.
 *  Runs under RLS (customer_oauth_clients is FORCE-RLS + tenant scoped), so a
 *  client registered at another store is invisible. Null if unknown. */
export function getRegisteredCustomerMcpClient(
  tenantId: string,
  clientId: string
): Promise<RegisteredCustomerMcpClient | null> {
  if (!clientId) return Promise.resolve(null);
  return withTenant({ tenantId }, async (tx) => {
    const rows = await tx.$queryRaw<
      { client_id: string; name: string | null; redirect_uris: string[]; disabled: boolean }[]
    >`
      SELECT client_id, name, redirect_uris, disabled
        FROM customer_oauth_clients
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
  });
}

// ─── The consent request ─────────────────────────────────────────────────────

/** The signed part of a consent URL's query string: every parameter the
 *  provider listed in `ba_param`, plus `sig` and the list itself. Empty when
 *  there is no signature at all. */
export function signedCustomerOAuthQuery(search: URLSearchParams): string {
  if (!search.has('sig')) return '';
  const names = new Set(search.getAll('ba_param'));
  if (names.size === 0) return '';
  const out = new URLSearchParams();
  for (const [key, value] of search.entries()) {
    if (key === 'sig' || key === 'ba_param' || names.has(key)) out.append(key, value);
  }
  return out.toString();
}

export interface CustomerConsentRequest {
  /** The signed query, passed back verbatim on submit. */
  oauthQuery: string;
  client: RegisteredCustomerMcpClient;
  redirectUri: string;
  /** Every scope in the request, OIDC framing included. */
  requestedScopes: string[];
}

export type CustomerConsentRead =
  { ok: true; request: CustomerConsentRequest } | { ok: false; error: string };

/** Check a consent URL's signature and load the client it names, at this
 *  store. The error strings are shown to the shopper. */
export async function readCustomerConsentRequest(
  tenantId: string,
  search: URLSearchParams
): Promise<CustomerConsentRead> {
  const oauthQuery = signedCustomerOAuthQuery(search);
  if (!oauthQuery) {
    return {
      ok: false,
      error:
        'This page opens when an assistant asks to connect. Start the connection from your assistant.',
    };
  }
  if (!(await verifyOAuthQueryParams(oauthQuery, customerAuthSecret()))) {
    return {
      ok: false,
      error: 'This connection request has expired. Start the connection again from your assistant.',
    };
  }
  const query = new URLSearchParams(oauthQuery);
  const client = await getRegisteredCustomerMcpClient(tenantId, query.get('client_id') ?? '');
  if (!client) {
    return { ok: false, error: 'Unknown OAuth client. Try reconnecting from your assistant.' };
  }
  if (client.disabled) return { ok: false, error: 'This connection has been disabled.' };
  return {
    ok: true,
    request: {
      oauthQuery,
      client,
      redirectUri: query.get('redirect_uri') ?? '',
      requestedScopes: (query.get('scope') ?? '').split(' ').filter(Boolean),
    },
  };
}

/** The scope string to approve: the shopper's picks from the known vocabulary
 *  plus OIDC framing, all limited to what the client requested. Empty when no
 *  capability was picked. */
export function customerApprovedScope(requested: string[], selected: string[]): string {
  const business = capCustomerScopes(selected).filter((s) => requested.includes(s));
  if (business.length === 0) return '';
  const wanted = new Set<string>([...CUSTOMER_OIDC_BASE_SCOPES, ...business]);
  return requested.filter((s) => wanted.has(s)).join(' ');
}

/** Record the shopper's decision at this store and return where the browser
 *  goes next (the client's redirect with a code, or `access_denied`). Throws a
 *  Better Auth APIError when the request is invalid/expired or the session is
 *  gone. `headers` carry the session cookie and the store's Host. */
export async function submitCustomerConsent(args: {
  tenantId: string;
  oauthQuery: string;
  accept: boolean;
  scope?: string;
  headers: Headers;
}): Promise<string> {
  const result = await tenantStore.run(args.tenantId, () =>
    getCustomerAuth().api.oauth2Consent({
      body: {
        accept: args.accept,
        oauth_query: args.oauthQuery,
        ...(args.accept && args.scope ? { scope: args.scope } : {}),
      },
      headers: args.headers,
    })
  );
  return result.url;
}
