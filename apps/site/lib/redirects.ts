// Runtime redirect enforcement for the storefront.
//
// Tenants manage 301/302 redirects in the dashboard, but until now nothing
// applied them — a renamed slug just 404'd, dropping the link equity the
// redirect was meant to preserve. `applyRedirect` closes that: pages call it
// immediately before `notFound()`, so it only ever fires for a path that would
// otherwise be dead (a live product/page always renders first and never reaches
// the lookup).
//
// The resolution is server-cached (tagged per tenant) and api-rest flattens the
// chain, so this is one cheap fetch on the 404 path and a single hop to the
// final destination.

import { redirect, permanentRedirect } from 'next/navigation';

import { publicGet } from './content';

interface RedirectResolution {
  toPath: string;
  statusCode: number;
}

/**
 * Look up a redirect for `path` under `tenantSlug`. If one exists, throw the
 * appropriate Next redirect (308 permanent for 301/308, 307 temporary for
 * 302/307) — which never returns. Otherwise return so the caller can 404.
 *
 * Fails open: any lookup error falls through to the caller's notFound().
 */
export async function applyRedirect(tenantSlug: string, path: string): Promise<void> {
  let resolution: RedirectResolution | null = null;
  try {
    resolution = await publicGet<RedirectResolution>(
      '/v1/public/redirects/resolve',
      { tenant: tenantSlug, path },
      { tag: `redirect:${tenantSlug}` }
    );
  } catch {
    // NOT_FOUND (the common "no redirect here") or any transient error — never
    // block a 404 on the redirect lookup.
    return;
  }

  // Guard against a self-referential row sending the browser into a loop.
  if (!resolution || resolution.toPath === path) return;

  if (resolution.statusCode === 301 || resolution.statusCode === 308) {
    permanentRedirect(resolution.toPath);
  }
  redirect(resolution.toPath);
}
