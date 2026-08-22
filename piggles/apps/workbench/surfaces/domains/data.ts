'use client';

// Domains data — the web addresses that reach a site, and the moves you can make
// on one.
//
// This file OWNS the `Domain` type and the `['domains']` query key for the whole
// app; `surfaces/sites/data.ts` re-exports from here rather than keeping its own
// narrower copy. Two definitions of the same row is how a list ends up reading a
// field the other one never fetched.
//
// Buying a domain is deliberately absent, and stays absent. Piggles does not sell
// domains, and the sparx console's answer — a "Get a domain" button opening
// shop.sparx.works — is another company's shop with another company's checkout
// on the end of it (issue #090). Connecting a domain you ALREADY own is the whole
// of this surface, and a customer buys hers wherever she likes.

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { apiErrorMessage } from '../../lib/api-error';
import { api } from '../../lib/api/client';

/** One DNS record, exactly as it must be typed into a registrar. */
export interface DnsRecord {
  name: string;
  value: string;
}

export interface Domain {
  id: string;
  propertyId: string;
  host: string;
  /** `subdomain` (the free piggles.site address, always live), `custom`
   *  (connected by its owner), or `purchased` (registered on the customer's
   *  behalf — never on Piggles, which does not sell domains; see the header). */
  type: string;
  status: string;
  isCanonical: boolean;
  verifiedAt: string | null;
  registrar: string | null;
  registeredAt: string | null;
  expiresAt: string | null;
  autoRenew: boolean;
  whoisPrivacy: boolean;
  renewalPriceCents: number | null;
  createdAt: string;
  /** What to add at the registrar. The CNAME is always present on a custom
   *  domain — including after it goes live, so it can be re-read or re-entered —
   *  and the TXT rides along only while a verification token is unspent. Null on
   *  subdomain and purchased hosts, which sparx points at itself. */
  instructions: { cname: DnsRecord; txt: DnsRecord | null } | null;
  /** Apex custom domains prove ownership by TXT, so a spent token can be
   *  re-issued. False for subdomain customs (CNAME is the proof) and for hosts
   *  sparx manages. */
  verifiesByTxt: boolean;
}

export const DOMAINS_KEY = ['domains'];

/** Every domain on the account. One request, not one per site: the whole list is
 *  a handful of rows, and it has to be grouped by site anyway. */
export function useDomains() {
  return useQuery({
    queryKey: DOMAINS_KEY,
    // api-rest orders canonical-first, then oldest-first — preserved rather than
    // re-sorted, so the site's main address always heads its group.
    queryFn: () => api.get<Domain[]>('/v1/domains'),
  });
}

export function useDomain(id: string) {
  return useQuery({
    queryKey: ['domains', id],
    queryFn: () => api.get<Domain>(`/v1/domains/${id}`),
    enabled: id !== 'new',
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: DOMAINS_KEY });
    // The sites list shows each site's canonical address, so a change here moves
    // a row over there too.
    void queryClient.invalidateQueries({ queryKey: ['properties'] });
    if (id) void queryClient.invalidateQueries({ queryKey: ['domains', id] });
  };
}

export function useConnectDomain() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { propertyId: string; host: string }) =>
      api.post<Domain>('/v1/domains', input),
    onSuccess: (domain) => {
      invalidate(domain.id);
    },
  });
}

/**
 * Ask the server to look up DNS right now.
 *
 * A failed check comes back as a 400 with a genuinely useful sentence ("we
 * couldn't find the TXT record at … yet — DNS propagation can take a few
 * minutes"), so this deliberately does NOT swallow the error: the message is the
 * feature. It also flips the row to `failed`, which is why the list is
 * invalidated either way.
 */
export function useVerifyDomain(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => api.post<Domain>(`/v1/domains/${id}/verify`),
    onSuccess: () => {
      invalidate(id);
    },
    onError: () => {
      invalidate(id);
    },
  });
}

/** Mint a fresh TXT token for an apex domain whose original was spent by
 *  verifying (or simply lost). Does not change status — a live domain keeps
 *  serving throughout. */
export function useReissueVerification(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => api.post<Domain>(`/v1/domains/${id}/reissue-verification`),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

/** Make this the address the site is known by; the others redirect to it. */
export function useMakeCanonical(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => api.patch<Domain>(`/v1/domains/${id}`, { isCanonical: true }),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useDisconnectDomain(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => api.delete(`/v1/domains/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

/**
 * The server's own sentence for a 4xx, which is worth showing verbatim: these
 * routes explain what to do next ("Enter a valid domain (e.g. shop.acme.com)",
 * "That domain is already connected to a site") far better than anything this
 * side could infer from a status code. A 5xx has no such sentence, so it falls
 * back to the caller's wording.
 */
export function domainErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}

/** How a domain is doing, in words rather than a status enum. `tone` feeds
 *  `<Badge color>` so state carries its own color, per the platform rule. */
export function domainState(domain: Domain): {
  label: string;
  tone: 'success' | 'warning' | 'error' | 'info';
  detail: string;
} {
  // A sparx.zone address needs no DNS and cannot fail; saying "active" about it
  // invites someone to go looking for records that do not exist.
  if (domain.type === 'subdomain') {
    return {
      label: 'Always on',
      tone: 'success',
      detail: 'This address comes with your site and works without any setup.',
    };
  }
  if (domain.status === 'active' || domain.status === 'verified') {
    return {
      label: 'Live',
      tone: 'success',
      detail: 'Visitors typing this address reach your site.',
    };
  }
  if (domain.status === 'failed') {
    return {
      label: 'Records not found',
      tone: 'error',
      detail:
        'We looked for the DNS records and they were not there yet. That usually means they have not been added, or they were added moments ago and have not spread across the internet.',
    };
  }
  return {
    label: 'Waiting on DNS',
    tone: 'warning',
    detail: 'Add the records below at your domain provider, then check again.',
  };
}
