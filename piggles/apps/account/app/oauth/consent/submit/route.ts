// The consent decision, as a stable Route Handler (docs/07 §5).
//
// DELIBERATELY a Route Handler and not a Server Action. This is the pivotal hop
// of a public OAuth flow, and Next.js Server Action ids are per-build hashes:
// any redeploy rotates them, so a consent page somebody is mid-flow on would
// POST an id the new build no longer has and the authorization would die
// silently. A Route Handler is a fixed URL that survives every deploy.
//
// The form carries one hidden field, the provider's SIGNED authorization
// request, and the provider checks that signature again when it receives the
// decision. So a tampered submission can never point the code anywhere but the
// registered address, and the scopes it can approve are only ever narrower
// than what the app asked for: the role cap below narrows them, and the
// provider refuses anything that was not in the signed request.

import { type NextRequest, NextResponse } from 'next/server';
import {
  approvedScope,
  CONSENT_ERROR_PARAM,
  getSession,
  readMcpConsentRequest,
  submitMcpConsent,
  type StaffRole,
} from '@wizeworks/auth';

const str = (v: FormDataEntryValue | null): string => (typeof v === 'string' ? v : '');

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

/** 303 See Other to a path (or absolute URL) resolved against this origin. */
function seeOther(target: string): NextResponse {
  return NextResponse.redirect(new URL(target, authOrigin()), 303);
}

/** Back to the consent page with a message, keeping the signed request. */
function backToConsent(oauthQuery: string, message: string): NextResponse {
  const q = new URLSearchParams(oauthQuery);
  q.set(CONSENT_ERROR_PARAM, message);
  return seeOther(`/oauth/consent?${q.toString()}`);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const fd = await request.formData();
  const oauthQuery = str(fd.get('oauth_query'));

  const read = await readMcpConsentRequest(new URLSearchParams(oauthQuery));
  if (!read.ok) return backToConsent(oauthQuery, read.error);

  const session = await getSession();
  if (!session) {
    // Signed out in another tab: sign in and come straight back to this request.
    return seeOther(`/sign-in?callbackURL=${encodeURIComponent(`/oauth/consent?${oauthQuery}`)}`);
  }

  const accept = str(fd.get('decision')) !== 'deny';
  let scope: string | undefined;
  if (accept) {
    const selected = str(fd.get('scopes')).split(' ').filter(Boolean);
    scope = approvedScope(read.request.requestedScopes, selected, session.user.role as StaffRole);
    if (!scope) {
      return backToConsent(oauthQuery, 'Choose at least one thing it can do.');
    }
  }

  try {
    // Where the provider sends the browser next: the app's registered address
    // with a code (allowed) or `access_denied` (cancelled).
    const next = await submitMcpConsent({ oauthQuery, accept, scope, headers: request.headers });
    return seeOther(next);
  } catch (err) {
    // The provider refused (an expired request, a session that ended between
    // page and submit). Never a redirect to the app: back to this page.
    const message = err instanceof Error && err.message ? err.message : '';
    return backToConsent(
      oauthQuery,
      message
        ? `This connection could not be completed: ${message}. Start again from your assistant.`
        : 'This connection could not be completed. Start again from your assistant.'
    );
  }
}
