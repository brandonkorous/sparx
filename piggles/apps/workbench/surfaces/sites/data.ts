'use client';

// Sites data — the shape api-rest returns for a property, and the mutations.
//
// A "site" IS a `Property`: one website, with its own name, handle, pages,
// domains, and visible modules. The tenant is the business; a site is one of the
// places that business publishes. Kept in one file so every writer invalidates
// the same keys — the toolbar's site switcher reads `['properties']` too, and a
// rename that doesn't reach it leaves the chrome showing the old name.

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { api } from '../../lib/api/client';

/** The full `PropertyView` api-rest returns — wider than the chrome's `SiteInfo`,
 *  which carries only what the switcher needs. */
export interface Site {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  isPrimary: boolean;
  status: string;
  settings: Record<string, unknown>;
  brandOverride: Record<string, unknown> | null;
  /** Module slugs switched OFF for this site — see `useSiteModules`. */
  moduleScope: string[];
  /** How many pages this site has. On the LIST only, so a caller can tell an
   *  empty site from a built one before offering to do something whole-site to
   *  it. Undefined on the single-site read — absent means "not counted", never
   *  "empty". */
  pageCount?: number;
  createdAt: string;
  updatedAt: string;
}

// Domains are owned by the domains surface — one definition of the row and one
// `['domains']` key, so a write there reaches the site list here. Re-exported
// rather than re-declared: this file's callers ask for it by this name.
export { useDomains, type Domain } from '../domains/data';

/** Shared with the toolbar switcher, deliberately: a site created or renamed
 *  here must appear there without a reload. */
export const SITES_KEY = ['properties'];

export function useSites() {
  return useQuery({
    queryKey: SITES_KEY,
    // api-rest orders primary-first, then by name — preserved rather than
    // re-sorted here, so the list and the switcher agree on order.
    queryFn: () => api.get<Site[]>('/v1/properties'),
  });
}

export function useSite(id: string) {
  return useQuery({
    queryKey: ['properties', id],
    queryFn: () => api.get<Site>(`/v1/properties/${id}`),
    enabled: id !== 'new',
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: SITES_KEY });
    void queryClient.invalidateQueries({ queryKey: ['domains'] });
    if (id) void queryClient.invalidateQueries({ queryKey: ['properties', id] });
  };
}

/**
 * Creating a site needs the Builder module from the SECOND site onward, which
 * api-rest signals with 402 rather than 403. Surfaced as a typed flag so the
 * form can explain the actual situation ("adding more sites needs Builder")
 * instead of showing a raw error for something that isn't a failure.
 */
export function isBuilderRequired(error: unknown): boolean {
  return error instanceof ApiError && error.status === 402;
}

/** api-rest reports which field a 409 is about; used to attach the message to
 *  the handle input rather than dropping a generic error above the form. */
export function conflictField(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const details = error.details as { field?: string } | undefined;
  return details?.field ?? null;
}

export function useCreateSite() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { name: string; slug?: string }) => api.post<Site>('/v1/properties', input),
    onSuccess: (site) => {
      invalidate(site.id);
    },
  });
}

export function useUpdateSite(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { name?: string; moduleScope?: string[] }) =>
      api.patch<Site>(`/v1/properties/${id}`, input),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useMakePrimary(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => api.post<Site>(`/v1/properties/${id}/make-primary`),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useDeleteSite(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => api.delete(`/v1/properties/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}
