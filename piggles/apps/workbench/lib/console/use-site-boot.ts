'use client';

// Which site this whole window operates under.
//
// Nothing can mount until this is known: arrangements are per-site, so an
// invoice panel from Site A must never be restored under Site B. The server
// reads the active-site cookie and hands it down, so a returning person's
// workspace mounts on the first paint with no token round trip; only a genuine
// first visit falls back to the token fetch, which canonicalises "no cookie yet"
// to the primary site so the key is stable ever after.
//
// Lifted out of components/console-shell.tsx, which was 555 lines of boot and
// chrome together.

import { useMemo } from 'react';
import { useActivePropertyId, useActiveSiteId, useSites } from '@/lib/api/shell-data';

export interface SiteBoot {
  /** The storage key every arrangement hangs off. Null while still resolving. */
  siteKey: string | null;
  /** Id + name of the site in view, for anything that has to NAME it. */
  activeSite: { id: string; name: string } | null;
  /** What every address is stamped with. Undefined until sites arrive. */
  siteSlug: string | undefined;
}

export function useSiteBoot(initialSiteKey: string | null): SiteBoot {
  const { data: tokenState } = useActiveSiteId();
  const { data: sites, isError: sitesFailed } = useSites();
  const resolved = useActivePropertyId();

  // The cookie names a site, or nothing. Nothing means api-rest scopes to the
  // primary site, so the primary's id IS the honest key for that state — using
  // it keeps the arrangement in one slot whether or not the cookie exists yet.
  const siteKey = useMemo(() => {
    // The server already read the cookie (initialSiteKey); /api/token forwards
    // the IDENTICAL cookie as propertyId, so the two are equal whenever both are
    // present — trusting the server value first means the boot key is known on
    // the first render for everyone returning, with nothing to flip once the
    // token fetch confirms it.
    const cookieSite = tokenState?.propertyId ?? initialSiteKey;
    if (cookieSite) return cookieSite;
    if (tokenState === undefined) return null; // still booting, and no cookie hint
    // No cookie: `useActivePropertyId` is where "then it is the primary" lives —
    // the same answer the studio stamps its documents with, so an arrangement and
    // the documents inside it can never end up under two different keys.
    if (resolved) return resolved;
    return sitesFailed ? 'default' : null; // sites still loading (or unreachable)
  }, [tokenState, resolved, sitesFailed, initialSiteKey]);

  // Resolved here rather than inside the feedback provider so it rides the same
  // sites query the top bar already holds, instead of a second fetch for a name.
  const activeSite = useMemo(() => {
    const site = siteKey ? sites?.find((candidate) => candidate.id === siteKey) : undefined;
    return site ? { id: site.id, name: site.name } : null;
  }, [sites, siteKey]);

  // Slug rather than id because a link is written to be read — `?site=savory-donuts`
  // says which business this is about, and a uuid says nothing.
  const siteSlug = useMemo(() => {
    if (!siteKey) return undefined;
    return sites?.find((candidate) => candidate.id === siteKey)?.slug;
  }, [sites, siteKey]);

  return { siteKey, activeSite, siteSlug };
}
