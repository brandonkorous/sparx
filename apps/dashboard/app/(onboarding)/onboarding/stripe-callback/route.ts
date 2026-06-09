// Stripe Connect OAuth callback — GET handler invoked when Stripe redirects
// back after the merchant authorizes the platform account.
//
// Stripe appends ?code=<authorization_code>&state=<state> to the redirect_uri
// we passed in the OAuth URL. We exchange the code via api-rest and then
// redirect the merchant back to the onboarding flow.

import { type NextRequest, NextResponse } from 'next/server';
import { api } from '@/lib/api-rest-client';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Stripe sends `error` + `error_description` when the merchant denies access.
  if (error) {
    const desc = searchParams.get('error_description') ?? error;
    return NextResponse.redirect(
      new URL(`/onboarding?stripe_error=${encodeURIComponent(desc)}`, request.nextUrl.origin)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/onboarding?stripe_error=missing_params', request.nextUrl.origin)
    );
  }

  try {
    await api.post('/v1/tenant/onboarding/stripe/exchange', { code, state });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OAuth exchange failed';
    return NextResponse.redirect(
      new URL(`/onboarding?stripe_error=${encodeURIComponent(message)}`, request.nextUrl.origin)
    );
  }

  // Success — return to the payments step with a success flag so the wizard
  // can auto-advance or show a confirmation.
  return NextResponse.redirect(new URL('/onboarding?stripe_connected=1', request.nextUrl.origin));
}
