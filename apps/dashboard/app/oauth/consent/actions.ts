'use server';

import { redirect } from 'next/navigation';
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
} from './_lib/consent';

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

/** User approved: cap the selected scopes to their role, mint a signed,
 *  session-bound consent grant, and hand off to Better Auth's /mcp/authorize
 *  (which the server.ts `before` hook only lets through WITH this grant). */
export async function approveMcpConsent(formData: FormData): Promise<void> {
  const params = paramsFromForm(formData);

  const session = await getSession();
  if (!session) {
    redirect(`/sign-in?callbackURL=${encodeURIComponent(consentReturnPath(params))}`);
  }

  const validation = await validateAuthorizeRequest(params);
  if (!validation.ok) {
    redirect(`${consentReturnPath(params)}&error=${encodeURIComponent(validation.error)}`);
  }

  // Authoritatively cap to what the signed-in user's role may grant — a
  // tampered form can never widen beyond the role.
  const selected = str(formData.get('scopes')).split(' ').filter(Boolean);
  const capped = capBusinessScopes(selected, session.user.role as StaffRole);
  const fullScope = [...OIDC_BASE_SCOPES, ...capped].join(' ');

  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error('BETTER_AUTH_SECRET is not configured');

  const grant = signConsentGrant(
    {
      clientId: params.clientId,
      redirectUri: params.redirectUri,
      scope: fullScope,
      userId: session.user.id,
    },
    secret
  );

  // NB: no `prompt` param → the plugin mints a code immediately (our guard hook
  // has already been satisfied by the grant). `scope` MUST equal grant.scope.
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

  redirect(`/api/auth/mcp/authorize?${q.toString()}`);
}

/** User denied: return to the (validated) client redirect URI with the
 *  standard OAuth error, per RFC 6749 §4.1.2.1. */
export async function denyMcpConsent(formData: FormData): Promise<void> {
  const params = paramsFromForm(formData);

  const session = await getSession();
  if (!session) redirect('/sign-in');

  const validation = await validateAuthorizeRequest(params);
  if (!validation.ok) {
    // Can't trust the redirect URI if validation failed — show the error page.
    redirect(`${consentReturnPath(params)}&error=${encodeURIComponent(validation.error)}`);
  }

  const url = new URL(params.redirectUri);
  url.searchParams.set('error', 'access_denied');
  url.searchParams.set('error_description', 'The user declined the authorization request.');
  if (params.state) url.searchParams.set('state', params.state);
  redirect(url.toString());
}
