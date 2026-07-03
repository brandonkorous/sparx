// Stable Route Handler for the MCP OAuth consent submit (docs/07 §5).
//
// This is DELIBERATELY a Route Handler, not a Server Action. The consent submit
// is the pivotal hop of a public OAuth flow, and Next.js Server Action ids are
// per-build hashes: any dashboard redeploy rotates them, so a consent page a
// client is mid-flow on POSTs an id the new build no longer has ("Failed to find
// Server Action") and the authorization dies silently. A Route Handler is a
// fixed URL that survives every deploy. The consent form POSTs here with a
// `decision` field (approve|deny); everything is authoritatively re-validated
// server-side — a tampered form can never widen scope or redirect anywhere but
// the DCR-registered URI.

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

/** 303 See Other back to a path on this origin (turns the POST into a GET). */
function seeOther(request: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.nextUrl.origin), 303);
}

/** Approved: cap the selected scopes to the user's role, mint a signed,
 *  session-bound consent grant, and hand off to Better Auth's /mcp/authorize
 *  (its `before` guard only mints a code WITH this grant). */
function approve(
  request: NextRequest,
  fd: FormData,
  params: AuthorizeParams,
  userId: string,
  role: StaffRole
): NextResponse {
  // A tampered form can never widen beyond what the role may grant.
  const selected = str(fd.get('scopes')).split(' ').filter(Boolean);
  const fullScope = [...OIDC_BASE_SCOPES, ...capBusinessScopes(selected, role)].join(' ');

  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error('BETTER_AUTH_SECRET is not configured');
  const grant = signConsentGrant(
    { clientId: params.clientId, redirectUri: params.redirectUri, scope: fullScope, userId },
    secret
  );

  // No `prompt` param → the plugin mints a code immediately (our guard hook is
  // already satisfied by the grant). `scope` MUST equal grant.scope.
  const q = new URLSearchParams();
  q.set('response_type', 'code');
  q.set('client_id', params.clientId);
  q.set('redirect_uri', params.redirectUri);
  q.set('scope', fullScope);
  if (params.state) q.set('state', params.state);
  q.set('code_challenge', params.codeChallenge);
  q.set('code_challenge_method', 'S256');
  if (params.nonce) q.set('nonce', params.nonce);
  q.set('sparx_grant', grant);
  return seeOther(request, `/api/auth/mcp/authorize?${q.toString()}`);
}

/** Denied: return to the (already-validated) client redirect URI with the
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
    return seeOther(
      request,
      `/sign-in?callbackURL=${encodeURIComponent(consentReturnPath(params))}`
    );
  }

  const validation = await validateAuthorizeRequest(params);
  if (!validation.ok) {
    // Never redirect to an unvalidated redirect_uri — bounce back to consent.
    return seeOther(
      request,
      `${consentReturnPath(params)}&error=${encodeURIComponent(validation.error)}`
    );
  }

  return str(fd.get('decision')) === 'deny'
    ? deny(params)
    : approve(request, fd, params, session.user.id, session.user.role as StaffRole);
}
