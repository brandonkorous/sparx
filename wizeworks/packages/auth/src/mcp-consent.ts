// The MCP consent screen's server side (docs/07 §5), shared by every app that
// mounts the staff instance's consent page (sparx workbench, Piggles account).
//
// On Better Auth 1.7 the provider owns the authorization request. When a person
// needs to sign in or approve, `/oauth2/authorize` sends the browser to our
// consent page with the whole request in the query string, SIGNED with the
// instance secret and stamped with an expiry (`sig`, `exp`, `ba_iat`,
// `ba_param`). That signature is what makes the page safe: the client, the
// redirect address and the requested scopes in the URL are exactly what the
// provider validated, and nobody can edit them on the way.
//
// So the page does three things and no protocol checking of its own:
//   1. readMcpConsentRequest: verify the signature, then load the client so the
//      screen can name it (and refuse a disabled one).
//   2. render the role-capped scope picker over what the client asked for.
//   3. submitMcpConsent: hand the decision to `/oauth2/consent` with the signed
//      query. The provider records the consent and, on approval, finishes the
//      authorization and returns the client's redirect with a code; on denial,
//      the redirect carries `access_denied`.
//
// The provider refuses an accepted scope that was not in the signed request
// ("Scope not originally requested"), so the role cap here can only ever
// narrow a grant.

import { verifyOAuthQueryParams } from '@better-auth/oauth-provider';

import { getRegisteredMcpClient, type RegisteredMcpClient } from './mcp-connections';
import { capBusinessScopes, OIDC_BASE_SCOPES, type StaffRole } from './mcp-scopes';
import { auth } from './server';

/** The query parameter the consent page uses to carry its own error message
 *  back to itself. Not part of the signed request, so it never breaks the
 *  signature. */
export const CONSENT_ERROR_PARAM = 'consent_error';

/** The signed part of a consent URL's query string: every parameter the
 *  provider listed in `ba_param`, plus `sig` and the list itself. Anything
 *  else on the URL (our own error message) is dropped. Empty when the query
 *  carries no signature at all, e.g. somebody opened /oauth/consent directly. */
export function signedOAuthQuery(search: URLSearchParams): string {
  if (!search.has('sig')) return '';
  const names = new Set(search.getAll('ba_param'));
  if (names.size === 0) return '';
  const out = new URLSearchParams();
  for (const [key, value] of search.entries()) {
    if (key === 'sig' || key === 'ba_param' || names.has(key)) out.append(key, value);
  }
  return out.toString();
}

/** A Next.js `searchParams` record (or any query) as URLSearchParams, keeping
 *  repeated keys (`ba_param`, `resource`) in order. */
export function toSearchParams(
  sp: URLSearchParams | Record<string, string | string[] | undefined>
): URLSearchParams {
  if (sp instanceof URLSearchParams) return sp;
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (Array.isArray(value)) for (const v of value) out.append(key, v);
    else if (value !== undefined) out.append(key, value);
  }
  return out;
}

export interface McpConsentRequest {
  /** The signed query, passed back verbatim on submit. */
  oauthQuery: string;
  client: RegisteredMcpClient;
  /** Where the client receives its code. Validated by the provider. */
  redirectUri: string;
  /** Every scope in the request, OIDC framing included. */
  requestedScopes: string[];
}

export type McpConsentRead =
  { ok: true; request: McpConsentRequest } | { ok: false; error: string };

/** Check a consent URL's signature and load the client it names. The error
 *  strings are shown to the person, so they say what to do next. */
export async function readMcpConsentRequest(search: URLSearchParams): Promise<McpConsentRead> {
  const oauthQuery = signedOAuthQuery(search);
  if (!oauthQuery) {
    return {
      ok: false,
      error:
        'This page opens when an assistant asks to connect. Start the connection from your assistant.',
    };
  }
  const { secret } = await auth.$context;
  if (!(await verifyOAuthQueryParams(oauthQuery, secret))) {
    return {
      ok: false,
      error:
        'This connection request has expired. Close this window and connect again from your assistant.',
    };
  }

  const query = new URLSearchParams(oauthQuery);
  const client = await getRegisteredMcpClient(query.get('client_id') ?? '');
  if (!client) {
    return { ok: false, error: 'Unknown OAuth client. Try reconnecting from your assistant.' };
  }
  if (client.disabled) {
    return { ok: false, error: 'This connection has been disabled by an administrator.' };
  }

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

/** The scope string to approve: the business scopes the person switched on,
 *  capped to what their role may grant, plus the OIDC framing scopes, and all
 *  of it limited to what the client actually requested. Empty when nothing
 *  grantable was selected. */
export function approvedScope(requested: string[], selected: string[], role: StaffRole): string {
  const business = capBusinessScopes(selected, role).filter((s) => requested.includes(s));
  if (business.length === 0) return '';
  const wanted = new Set<string>([...OIDC_BASE_SCOPES, ...business]);
  return requested.filter((s) => wanted.has(s)).join(' ');
}

/** Record the person's decision and return where the browser goes next: the
 *  client's redirect address, with a code on approval or `access_denied` on
 *  denial. Throws (an APIError from Better Auth) when the signed request is
 *  invalid or expired, or the session is gone. */
export async function submitMcpConsent(args: {
  oauthQuery: string;
  accept: boolean;
  /** Space-separated; omit on denial. */
  scope?: string;
  headers: Headers;
}): Promise<string> {
  const result = await auth.api.oauth2Consent({
    body: {
      accept: args.accept,
      oauth_query: args.oauthQuery,
      ...(args.accept && args.scope ? { scope: args.scope } : {}),
    },
    headers: args.headers,
  });
  return result.url;
}
