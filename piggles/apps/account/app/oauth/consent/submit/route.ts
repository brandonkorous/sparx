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
// than what the app asked for: the role cap in api-rest narrows them, and the
// provider refuses anything that was not in the signed request.

import { type NextRequest, NextResponse } from 'next/server';
import { CONSENT_ERROR_PARAM, readMcpConsentRequest, submitMcpConsent } from '@/lib/mcp-consent';
import { sameOriginRedirect } from '@/lib/same-origin-redirect';

const str = (v: FormDataEntryValue | null): string => (typeof v === 'string' ? v : '');

/**
 * 303 See Other. A path on this app goes out as a relative `Location`, which
 * the browser resolves against the address it actually asked for: never the
 * request's own URL, which behind the ingress is the pod's bind address, and
 * never a configured origin, which this app no longer holds. An absolute URL
 * (the assistant's registered address, with a code) goes out as it is.
 */
function seeOther(target: string): NextResponse {
  return /^https?:\/\//i.test(target)
    ? NextResponse.redirect(target, 303)
    : sameOriginRedirect(target, 303);
}

/** Back to the consent page with a message, keeping the signed request. */
function backToConsent(oauthQuery: string, message: string): NextResponse {
  const q = new URLSearchParams(oauthQuery);
  q.set(CONSENT_ERROR_PARAM, message);
  return seeOther(`/oauth/consent?${q.toString()}`);
}

function signInFirst(oauthQuery: string): NextResponse {
  // Signed out in another tab: sign in and come straight back to this request.
  return seeOther(`/sign-in?callbackURL=${encodeURIComponent(`/oauth/consent?${oauthQuery}`)}`);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const fd = await request.formData();
  const oauthQuery = str(fd.get('oauth_query'));

  const read = await readMcpConsentRequest(new URLSearchParams(oauthQuery));
  if (!read.ok) return backToConsent(oauthQuery, read.error);

  // api-rest cuts the scopes to what the person's role may give, and the
  // provider refuses anything that was not in the signed request.
  const accept = str(fd.get('decision')) !== 'deny';
  const answer = await submitMcpConsent({
    oauthQuery,
    accept,
    scopes: accept ? str(fd.get('scopes')).split(' ').filter(Boolean) : [],
  });
  if (answer.ok) {
    // Where the provider sends the browser next: the app's registered address
    // with a code (allowed) or `access_denied` (cancelled).
    return seeOther(answer.next);
  }
  if (answer.signedOut) return signInFirst(oauthQuery);
  // The provider refused (an expired request, a session that ended between
  // page and submit), or no scope was chosen. Never a redirect to the app:
  // back to this page.
  return backToConsent(oauthQuery, answer.error);
}
