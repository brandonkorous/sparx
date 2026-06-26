// Edge proxy (Next.js `proxy` file convention — formerly `middleware`).
//
// Unlike the tenant storefront (apps/site), sparx.market is a SINGLE public
// host — there is no per-tenant / per-property host routing to resolve at the
// edge. The marketplace catalog is cross-tenant: every request hits the same
// site and the seller's tenant is resolved per-listing in the data layer, not
// from the Host header. So this proxy is a deliberate no-op passthrough; it
// exists only to reserve the convention (and a single place to add edge
// concerns later — geo headers, A/B bucketing — without restructuring).

import { NextResponse, type NextRequest } from 'next/server';

export function proxy(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  // Skip Next internals + the static SEO/health routes; everything else passes
  // straight through.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/health).*)'],
};
