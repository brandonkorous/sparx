// Stripe Connect OAuth callback — GET handler invoked when Stripe redirects
// back after the merchant authorizes the platform account.
//
// Stripe appends ?code=<authorization_code>&state=<state> to the redirect_uri
// we passed in the OAuth URL. We exchange the code via api-rest and then
// redirect the merchant back to the onboarding flow they came from.
//
// One registered redirect URI serves BOTH front ends: the classic wizard
// (/onboarding) and the natural-language story (/story). Standard-OAuth redirect
// URIs are allow-listed in the Stripe dashboard and the OAuth `state` only carries
// the tenant id, so the origin is recorded in a short-lived cookie the story flow
// sets before leaving (see ONBOARDING_FLOW_COOKIE). We read it here, route back to
// the matching page, and clear it.

import { type NextRequest, NextResponse } from 'next/server';
import { api } from '@/lib/api-rest-client';
import { ONBOARDING_FLOW_COOKIE } from '../../story/_lib/flow';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Where to return — `/story` when the story flow set the flow cookie, else the
  // classic wizard. Cleared on the response so it never leaks into a later run.
  const base =
    request.cookies.get(ONBOARDING_FLOW_COOKIE)?.value === 'story' ? '/story' : '/onboarding';
  const back = (params: string): NextResponse => {
    const res = NextResponse.redirect(new URL(`${base}?${params}`, request.nextUrl.origin));
    res.cookies.delete(ONBOARDING_FLOW_COOKIE);
    return res;
  };

  // Stripe sends `error` + `error_description` when the merchant denies access.
  if (error) {
    const desc = searchParams.get('error_description') ?? error;
    return back(`stripe_error=${encodeURIComponent(desc)}`);
  }

  if (!code || !state) {
    return back('stripe_error=missing_params');
  }

  try {
    await api.post('/v1/tenant/onboarding/stripe/exchange', { code, state });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OAuth exchange failed';
    return back(`stripe_error=${encodeURIComponent(message)}`);
  }

  // Success — return to the flow's payments step with a success flag so it can
  // auto-advance or show a confirmation.
  return back('stripe_connected=1');
}
