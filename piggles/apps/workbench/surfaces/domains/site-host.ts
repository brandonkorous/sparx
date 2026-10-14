'use client';

// The address shoppers reach a site at, for screens that print one.
//
// Worked out the same way in two places before (a product's "See it on your
// site" link and its search preview), and typed in as "yoursite.com" in three
// more, so a category's hint sent its owner to an address that was not his
// (sparx persona issue 225).

import { useActivePropertyId } from '../../lib/api/shell-data';
import { useDomains, type Domain } from './data';

/**
 * The site's main address, else its first live one. Null when it has none, or
 * before the domains have loaded: a caller prints the path alone rather than an
 * address nobody owns.
 */
export function siteHostOf(domains: Domain[] | undefined, propertyId: string | null): string | null {
  const mine = (domains ?? []).filter(
    (domain) =>
      domain.status !== 'removed' && (propertyId ? domain.propertyId === propertyId : true)
  );
  return (mine.find((domain) => domain.isCanonical) ?? mine[0])?.host ?? null;
}

/** That address for the site being worked in. */
export function useSiteHost(): string | null {
  const { data: domains } = useDomains();
  return siteHostOf(domains, useActivePropertyId());
}
