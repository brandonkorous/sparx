// Tenant resolution at the edge (Next.js `proxy` file convention — formerly
// `middleware`).
//
// Production: the tenant is derived from the Host header inside resolveTenant()
// (subdomain of sparx.zone, or a custom domain later). The proxy doesn't need
// to do anything there.
//
// Local dev: there's no per-tenant DNS, so we accept `?tenant=<slug>`, stash it
// in an `x-tenant-slug` request header (read by resolveTenant) AND persist it
// as a cookie so navigating between pages keeps the active store without
// re-appending the query param.
//
// Site preview: the page components read the `?sparxSitePreview=` draft token
// straight off their `searchParams`, but the root layout (which renders the
// header / footer / announcement chrome) can't see searchParams. So we mirror
// the token into an `x-sparx-site-preview` request header here, letting the
// layout fetch the DRAFT chrome too — without it, chrome changes (and the
// announcement bar) only ever appear after publishing.

import { NextResponse, type NextRequest } from 'next/server';

const COOKIE = 'sparx_dev_tenant';
// Local-dev multi-site selector (docs/49): `?property=<slug>` picks which of the
// tenant's sites to render without per-site DNS. Mirrors the tenant cookie.
const PROPERTY_COOKIE = 'sparx_dev_property';

export function proxy(req: NextRequest) {
  const fromQuery = req.nextUrl.searchParams.get('tenant');
  const fromCookie = req.cookies.get(COOKIE)?.value;
  const slug = fromQuery ?? fromCookie;
  const propertyQuery = req.nextUrl.searchParams.get('property');
  const propertyCookie = req.cookies.get(PROPERTY_COOKIE)?.value;
  const propertySlug = propertyQuery ?? propertyCookie;
  const previewToken = req.nextUrl.searchParams.get('sparxSitePreview');

  const requestHeaders = new Headers(req.headers);
  if (slug) requestHeaders.set('x-tenant-slug', slug);
  if (propertySlug) requestHeaders.set('x-property-slug', propertySlug);
  if (previewToken) requestHeaders.set('x-sparx-site-preview', previewToken);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  if (fromQuery && fromQuery !== fromCookie) {
    res.cookies.set(COOKIE, fromQuery, { httpOnly: false, sameSite: 'lax', path: '/' });
  }
  if (propertyQuery && propertyQuery !== propertyCookie) {
    res.cookies.set(PROPERTY_COOKIE, propertyQuery, {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
    });
  }
  return res;
}

export const config = {
  // Skip Next internals + the health probe; everything else gets tenant context.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/health).*)'],
};
