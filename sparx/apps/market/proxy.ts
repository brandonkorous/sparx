// Edge proxy (Next.js `proxy` file convention — formerly `middleware`).
//
// Unlike the tenant storefront (wizeworks/apps/site), sparx.market is a SINGLE public
// host — there is no per-tenant / per-property host routing to resolve at the
// edge. The marketplace catalog is cross-tenant: every request hits the same
// site and the seller's tenant is resolved per-listing in the data layer, not
// from the Host header. So this proxy does no routing at all.
//
// Its jobs: a header-named call to an unknown server action gets Next's own 404
// here, because on a prerendered page Next's answer to it is a 500; and a form
// posted from an older build is sent back to a fresh page instead of a 500. See
// @wizeworks/app-kit/stale-form-action.

import { NextResponse, type NextRequest } from 'next/server';
import {
  runningActionIds,
  staleFormActionRedirect,
  unknownActionResponse,
} from '@wizeworks/app-kit/stale-form-action';

export async function proxy(req: NextRequest) {
  const known = runningActionIds();
  return (
    unknownActionResponse(req, known) ??
    (await staleFormActionRedirect(req, known)) ??
    NextResponse.next()
  );
}

export const config = {
  // Skip Next internals + the static SEO/health routes; everything else passes
  // straight through. The `has` entries reach the skipped paths for any
  // server-action call and any multipart post, so the guards see those too.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/health).*)',
    { source: '/:path*', has: [{ type: 'header', key: 'next-action' }] },
    {
      source: '/:path*',
      has: [{ type: 'header', key: 'content-type', value: 'multipart/form-data.*' }],
    },
  ],
};
