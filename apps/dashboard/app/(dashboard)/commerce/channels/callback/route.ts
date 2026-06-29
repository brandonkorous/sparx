// Channel OAuth callback (docs/106 §4.6). The channel redirects the browser back
// here with ?code&state after consent; we POST both to the api-rest exchange
// endpoint (which verifies the signed state, exchanges the code, and stores the
// encrypted grant), then bounce to the Commerce → Sales channels page with a
// status flag. Mirrors the Search Console callback route.

import { NextResponse, type NextRequest } from 'next/server';
import { api } from '@/lib/api-rest-client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // The channel sends `error` (e.g. access_denied) when the merchant cancels.
  if (error) {
    return NextResponse.redirect(
      new URL(`/commerce/channels?error=${encodeURIComponent(error)}`, origin)
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL('/commerce/channels?error=missing_params', origin));
  }

  try {
    const result = await api.post<{ connected: boolean; channel: string }>(
      '/v1/channels/callback',
      {
        code,
        state,
      }
    );
    return NextResponse.redirect(
      new URL(`/commerce/channels?connected=${encodeURIComponent(result.channel)}`, origin)
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OAuth exchange failed';
    return NextResponse.redirect(
      new URL(`/commerce/channels?error=${encodeURIComponent(message)}`, origin)
    );
  }
}
