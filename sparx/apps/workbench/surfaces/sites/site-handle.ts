'use client';

// The handle a new site is offered, from its name.
//
// A site's address is `<handle>.<business>.sparx.zone`, and the business half is
// the host the main site is already served at, read rather than composed (the same
// reading the Piggles console's site-address.ts makes).

import { useDomains } from '../domains/data';
import { useSites } from './data';

/** Handles this account cannot hand out. `primary` is the first site's own. */
const RESERVED = new Set(['primary']);

/** The business's own free address, the part a new site's handle sits in front of. */
export function useSiteAddressBase(): string | null {
  const { data: sites } = useSites();
  const { data: domains } = useDomains();

  const primary = (sites ?? []).find((site) => site.isPrimary);
  return primary === undefined
    ? null
    : ((domains ?? []).find(
        (domain) => domain.propertyId === primary.id && domain.type === 'subdomain'
      )?.host ?? null);
}

/**
 * A site handle without the business's own name in front of it (persona issue 927).
 *
 * A site called "Juniper Row Lookbook" was offered
 * `juniper-row-lookbook.juniper-row.<zone>`, the business named twice, on the one
 * field that can never be changed afterwards. The same rule api-rest applies to a
 * site added without a handle. Only ever applied to a handle derived from the name:
 * one somebody typed is theirs. Left whole when nothing would be left, or when what
 * is left is reserved.
 */
export function withoutBusinessName(handle: string, base: string | null): string {
  const business = base?.split('.')[0];
  if (!business) return handle;
  const prefix = `${business}-`;
  if (!handle.startsWith(prefix)) return handle;
  const rest = handle.slice(prefix.length);
  return rest === '' || RESERVED.has(rest) ? handle : rest;
}
