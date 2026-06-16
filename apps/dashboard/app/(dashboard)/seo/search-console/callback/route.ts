// Google Search Console OAuth callback — GET handler invoked when Google
// redirects back after the merchant authorizes the platform.
//
// Google appends ?code=<authorization_code>&state=<state> to the redirect_uri we
// passed in the consent URL. We exchange the code via api-rest (which verifies
// the signed state and stores the encrypted grant) and then redirect back to the
// SEO overview. Mirrors the Stripe Connect callback.

import { type NextRequest, NextResponse } from 'next/server';
import { api } from '@/lib/api-rest-client';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Google sends `error` (e.g. access_denied) when the merchant cancels consent.
  if (error) {
    return NextResponse.redirect(new URL(`/seo?gsc_error=${encodeURIComponent(error)}`, origin));
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL('/seo?gsc_error=missing_params', origin));
  }

  try {
    const result = await api.post<{
      connection: { status: string } | null;
      sites: { siteUrl: string }[];
    }>('/v1/seo/search-console/exchange', { code, state });
    // One verified site auto-connects (status 'connected'); multiple sites leave
    // it in 'needs_site' so the merchant can pick on the SEO page.
    const flag = result.connection?.status === 'connected' ? 'connected' : 'pick_site';
    return NextResponse.redirect(new URL(`/seo?gsc=${flag}`, origin));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OAuth exchange failed';
    return NextResponse.redirect(new URL(`/seo?gsc_error=${encodeURIComponent(message)}`, origin));
  }
}
