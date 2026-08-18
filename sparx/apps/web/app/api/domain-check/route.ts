import { NextResponse } from 'next/server';

/**
 * Domain availability via RDAP (the registries' authoritative WHOIS successor).
 * Server-side so there's no CORS problem and no API key: rdap.org redirects to
 * the authoritative RDAP server for the TLD, which returns 404 for an
 * unregistered domain and 200 for a registered one. TLDs without public RDAP
 * resolve to "unknown" rather than a guess.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DOMAIN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export async function GET(request: Request) {
  const domain = (new URL(request.url).searchParams.get('domain') ?? '').trim().toLowerCase();
  if (!domain || !DOMAIN.test(domain)) {
    return NextResponse.json({ domain, available: null, error: 'invalid domain' }, { status: 400 });
  }

  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      headers: { accept: 'application/rdap+json' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) return NextResponse.json({ domain, available: true });
    if (res.ok) return NextResponse.json({ domain, available: false });
    return NextResponse.json({ domain, available: null, error: `registry returned ${res.status}` });
  } catch {
    return NextResponse.json({ domain, available: null, error: 'lookup failed' });
  }
}
