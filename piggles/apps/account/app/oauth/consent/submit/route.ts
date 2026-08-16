// The consent decision, as a stable Route Handler (docs/07 §5).
//
// DELIBERATELY a Route Handler and not a Server Action. This is the pivotal hop
// of a public OAuth flow, and Next.js Server Action ids are per-build hashes:
// any redeploy rotates them, so a consent page somebody is mid-flow on would
// POST an id the new build no longer has and the authorization would die
// silently. A Route Handler is a fixed URL that survives every deploy.
//
// Everything is re-validated here, authoritatively. The form is hidden fields on
// a page an attacker can craft, so a tampered submission must never be able to
// widen scope or redirect anywhere but the registered URI.

import { type NextRequest, NextResponse } from 'next/server';
import {
  getSession,
  capBusinessScopes,
  signConsentGrant,
  OIDC_BASE_SCOPES,
  type StaffRole,
} from '@sparx/auth';
import {
  parseAuthorizeParams,
  validateAuthorizeRequest,
  consentReturnPath,
  type AuthorizeParams,
} from '../_lib/consent';

const str = (v: FormDataEntryValue | null): string => (typeof v === 'string' ? v : '');

/** Reconstruct the authorize params carried as hidden fields on the form. */
function paramsFromForm(fd: FormData): AuthorizeParams {
  return parseAuthorizeParams({
    response_type: str(fd.get('response_type')),
    client_id: str(fd.get('client_id')),
    redirect_uri: str(fd.get('redirect_uri')),
    scope: str(fd.get('scope')),
    state: str(fd.get('state')),
    code_challenge: str(fd.get('code_challenge')),
    code_challenge_method: str(fd.get('code_challenge_method')),
    resource: str(fd.get('resource')),
    nonce: str(fd.get('nonce')),
  });
}

/**
 * Canonical public origin of this app, the authorization server.
 *
 * MUST come from the configured `BETTER_AUTH_URL` — the same value Better Auth
 * uses as its baseURL — and NEVER from the request: behind the ingress proxy
 * `request.nextUrl.origin` resolves to the internal bind address, so a
 * request-derived redirect strands the browser on an unreachable host
 * mid-authorization. A configured origin is also immune to the host-header
 * injection that trusting `x-forwarded-host` would invite.
 */
function authOrigin(): string {
  return (process.env.BETTER_AUTH_URL ?? 'http://localhost:3021').replace(/\/$/, '');
}

/** 303 See Other to a path on this origin (turns the POST into a GET). */
function seeOther(path: string): NextResponse {
  return NextResponse.redirect(new URL(path, authOrigin()), 303);
}

/**
 * Allowed: cap the chosen scopes to what this role may actually grant, mint a
 * signed session-bound consent grant, and hand off to Better Auth's
 * /mcp/authorize — whose `before` guard only mints a code WITH that grant.
 */
function approve(
  fd: FormData,
  params: AuthorizeParams,
  userId: string,
  role: StaffRole
): NextResponse {
  // The cap is the point: a tampered form can never widen beyond the role.
  const selected = str(fd.get('scopes')).split(' ').filter(Boolean);
  const fullScope = [...OIDC_BASE_SCOPES, ...capBusinessScopes(selected, role)].join(' ');

  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error('BETTER_AUTH_SECRET is not configured');
  const grant = signConsentGrant(
    { clientId: params.clientId, redirectUri: params.redirectUri, scope: fullScope, userId },
    secret
  );

  // No `prompt` param → the plugin mints a code immediately, since the guard
  // hook is already satisfied by the grant. `scope` MUST equal grant.scope.
  const q = new URLSearchParams();
  q.set('response_type', 'code');
  q.set('client_id', params.clientId);
  q.set('redirect_uri', params.redirectUri);
  q.set('scope', fullScope);
  if (params.state) q.set('state', params.state);
  q.set('code_challenge', params.codeChallenge);
  q.set('code_challenge_method', 'S256');
  if (params.nonce) q.set('nonce', params.nonce);
  // `sparx_grant` is the platform's wire name, read by the `before` hook in
  // @sparx/auth. It is shared with the other brand by construction, so it stays
  // as-is until the scope rename (piggles/docs/migration, phase A3) renames both
  // sides together — changing one half here would break the handshake.
  q.set('sparx_grant', grant);
  return seeOther(`/api/auth/mcp/authorize?${q.toString()}`);
}

/** Cancelled: back to the (already-validated) client redirect URI with the
 *  standard OAuth error, per RFC 6749 §4.1.2.1. */
function deny(params: AuthorizeParams): NextResponse {
  const url = new URL(params.redirectUri);
  url.searchParams.set('error', 'access_denied');
  url.searchParams.set('error_description', 'The user declined the authorization request.');
  if (params.state) url.searchParams.set('state', params.state);
  return NextResponse.redirect(url.toString(), 303);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const fd = await request.formData();
  const params = paramsFromForm(fd);

  const session = await getSession();
  if (!session) {
    // Preserve the full authorize request across sign-in.
    return seeOther(`/sign-in?callbackURL=${encodeURIComponent(consentReturnPath(params))}`);
  }

  const validation = await validateAuthorizeRequest(params);
  if (!validation.ok) {
    // Never redirect to an unvalidated redirect_uri — bounce back to consent,
    // which is the whole reason the error is carried as a query param.
    return seeOther(`${consentReturnPath(params)}&error=${encodeURIComponent(validation.error)}`);
  }

  return str(fd.get('decision')) === 'deny'
    ? deny(params)
    : approve(fd, params, session.user.id, session.user.role as StaffRole);
}
