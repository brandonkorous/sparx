'use client';

// The free web address a new site is about to be given, and whether it is free.
//
// A site's address is `<handle>.<business>.piggles.site`, and the business half
// is not something this console holds as a field — it is the host the main site
// is already served at. So the honest way to show the address before the site
// exists is to read it off the address that does, which is also exactly how
// api-rest mints it (`mintZoneHost`).
//
// The base is null rather than a guess when the main site has no free address on
// record. A preview that is wrong is worse than no preview: the handle can never
// be changed afterwards, so it would be a promise nobody can take back.

import { useSites, useDomains } from './data';

/** Handles this account cannot hand out. `primary` is the first site's own, and
 *  it is never shown in the picker, so a second site claiming it would collide
 *  with something the owner cannot see. */
const RESERVED = new Set(['primary']);

export interface NewSiteAddress {
  /** The business's own address — what a new site's handle sits in front of. */
  base: string | null;
  /** The whole address this handle would produce, once there is a handle. */
  host: string | null;
  /** Why this handle cannot be used, in her words. Null when it is free.
   *
   *  Answered here rather than on the server because `Property.slug` is unique
   *  PER TENANT, and the tenant's sites are already on screen — so waiting for a
   *  409 would be asking a question this console can already answer, on the one
   *  field that cannot be changed afterwards. */
  problem: string | null;
}

export function useNewSiteAddress(handle: string): NewSiteAddress {
  const { data: sites } = useSites();
  const { data: domains } = useDomains();

  const primary = (sites ?? []).find((site) => site.isPrimary);
  const base =
    primary === undefined
      ? null
      : ((domains ?? []).find(
          (domain) =>
            domain.propertyId === primary.id &&
            domain.type === 'subdomain' &&
            domain.status !== 'removed'
        )?.host ?? null);

  return {
    base,
    host: base && handle ? `${handle}.${base}` : null,
    problem: problemWith(handle, sites),
  };
}

function problemWith(
  handle: string,
  sites: { slug: string; name: string }[] | undefined
): string | null {
  if (!handle) return null;
  if (RESERVED.has(handle)) return 'That one is taken. Pick another.';
  const clash = (sites ?? []).find((site) => site.slug === handle);
  return clash ? `${clash.name} already has that address. Pick another.` : null;
}
