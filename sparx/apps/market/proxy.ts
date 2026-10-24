// Edge proxy (Next.js `proxy` file convention — formerly `middleware`).
//
// Unlike the tenant storefront (wizeworks/apps/site), sparx.market is a SINGLE public
// host — there is no per-tenant / per-property host routing to resolve at the
// edge. The marketplace catalog is cross-tenant: every request hits the same
// site and the seller's tenant is resolved per-listing in the data layer, not
// from the Host header. So this proxy does no routing at all.
//
// Its one job: a header-named call to an unknown server action gets Next's own
// 404 here, because on a prerendered page Next's answer to it is a 500. See
// @wizeworks/app-kit/stale-form-action.

import { NextResponse, type NextRequest } from 'next/server';
import { runningActionIds, unknownActionResponse } from '@wizeworks/app-kit/stale-form-action';

export function proxy(req: NextRequest) {
  return unknownActionResponse(req, runningActionIds()) ?? NextResponse.next();
}

export const config = {
  // Skip Next internals + the static SEO/health routes; everything else passes
  // straight through. The `has` entry reaches the skipped paths for any
  // server-action call, so the guard sees those too.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/health).*)',
    { source: '/:path*', has: [{ type: 'header', key: 'next-action' }] },
  ],
};
