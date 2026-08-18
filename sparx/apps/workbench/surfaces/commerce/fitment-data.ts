'use client';

// ══════════════════════════════════════════════════════════════════════════
// FITMENT DICTIONARY MANAGEMENT — the catalog-wide counterpart to the
// product-scoped fitment pane.
//
// Where `product-fitment.tsx` assigns ONE product to points in a domain's tree,
// this data layer owns the DOMAINS and their node TREES themselves: creating a
// "Vehicles" list, editing its levels (Make → Model → Engine), and adding /
// renaming / reordering / deleting the values inside it.
//
// ── One definition of the read shapes ────────────────────────────────────
//
// The domain-list read (`useFitmentDomains`), the per-level node read
// (`useFitmentNodes`) and the row shapes (`FitmentDomain`, `FitmentNode`,
// `FitmentDimension`) already live in `products-data.ts`, because the product
// pane reads them too. This module RE-EXPORTS them rather than redeclaring —
// two definitions of a fitment domain is how the manager ends up writing a
// field the product pane never fetched. The management-only reads and every
// write live here.
//
// ── Query keys, shared by construction ───────────────────────────────────
//
//   domains          ['commerce','fitment','domains']         the domain list
//   domain(id)       ['commerce','fitment','domain', id]      one domain in full
//   nodes(domainId)  ['commerce','fitment','nodes', id]       PREFIX of every level
//   presets          ['commerce','fitment','presets']         the starter library
//
// `useFitmentNodes` keys each level as `[...nodes(id), parentId]`, so a mutation
// invalidating the `nodes(id)` PREFIX refreshes every open level of that tree in
// one call — the product picker docked beside the manager sees new nodes too.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { api } from '../../lib/api/client';
import {
  useFitmentDomains,
  useFitmentNodes,
  type FitmentDimension,
  type FitmentDomain,
  type FitmentNode,
} from './products-data';

export { useFitmentDomains, useFitmentNodes };
export type { FitmentDimension, FitmentDomain, FitmentNode };

/* ── Keys ───────────────────────────────────────────────────────────────── */

const fitmentKeys = {
  domains: ['commerce', 'fitment', 'domains'] as const,
  domain: (id: string) => ['commerce', 'fitment', 'domain', id] as const,
  nodes: (domainId: string) => ['commerce', 'fitment', 'nodes', domainId] as const,
  presets: ['commerce', 'fitment', 'presets'] as const,
};

/* ── The one domain, in full ────────────────────────────────────────────── */

/**
 * A single domain by id — the detail pane's read.
 *
 * A 404 means the list was deleted or uninstalled while this pane was open, and
 * that is a meaningful answer rather than a fault, so it is not retried into a
 * generic failure.
 */
export function useFitmentDomain(id: string) {
  return useQuery({
    queryKey: fitmentKeys.domain(id),
    queryFn: () => api.get<FitmentDomain>(`/v1/commerce/fitment/domains/${id}`),
    enabled: id !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/* ── Domain writes ──────────────────────────────────────────────────────── */

export interface CreateFitmentDomainBody {
  slug: string;
  displayName: string;
  description?: string;
  iconKey?: string;
  dimensions: FitmentDimension[];
}

export interface UpdateFitmentDomainBody {
  displayName?: string;
  /** `null` clears the stored description. */
  description?: string | null;
  /** `null` clears the stored icon. */
  iconKey?: string | null;
  dimensions?: FitmentDimension[];
}

export function useCreateFitmentDomain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateFitmentDomainBody) =>
      api.post<{ id: string }>('/v1/commerce/fitment/domains', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fitmentKeys.domains });
    },
  });
}

export function useUpdateFitmentDomain(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateFitmentDomainBody) =>
      api.patch<{ id: string }>(`/v1/commerce/fitment/domains/${id}`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fitmentKeys.domains });
      void queryClient.invalidateQueries({ queryKey: fitmentKeys.domain(id) });
    },
  });
}

/** Uninstall a domain, its whole tree, and every product mark that referenced
 *  it. The server reports how many products were affected AFTER the fact. */
export function useDeleteFitmentDomain(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.delete<{ productsAffected: number }>(`/v1/commerce/fitment/domains/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fitmentKeys.domains });
    },
  });
}

/* ── Node writes ────────────────────────────────────────────────────────── */

export interface CreateFitmentNodeBody {
  parentId: string | null;
  /** The level dimension this node sits at — the service authoritatively
   *  recomputes it from depth, but the schema still requires a valid one. */
  dimensionKey: string;
  name: string;
  slug: string;
  position: number;
}

/**
 * Add one value to a domain's tree.
 *
 * Adding, renaming, reordering and deleting nodes each commit immediately —
 * there is no draft over the tree — because every one is a discrete, complete
 * act on its own, exactly as in the product fitment picker. That is also what
 * lets a delete carry its own confirm naming what is lost.
 */
export function useCreateFitmentNode(domainId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateFitmentNodeBody) =>
      api.post<{ id: string }>('/v1/commerce/fitment/nodes', { domainId, ...body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fitmentKeys.nodes(domainId) });
      void queryClient.invalidateQueries({ queryKey: fitmentKeys.domains });
      void queryClient.invalidateQueries({ queryKey: fitmentKeys.domain(domainId) });
    },
  });
}

/** Rename one value. Only the name changes — the slug is the machine handle
 *  product links resolve against, so it is kept stable across a rename. */
export function useUpdateFitmentNode(domainId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; name: string }) =>
      api.patch<{ id: string }>(`/v1/commerce/fitment/nodes/${input.id}`, { name: input.name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fitmentKeys.nodes(domainId) });
    },
  });
}

/** Delete a value and its whole subtree. The server reports how many products
 *  lost a mark AFTER the fact. */
export function useDeleteFitmentNode(domainId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (nodeId: string) =>
      api.delete<{ productsAffected: number }>(`/v1/commerce/fitment/nodes/${nodeId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fitmentKeys.nodes(domainId) });
      void queryClient.invalidateQueries({ queryKey: fitmentKeys.domains });
      void queryClient.invalidateQueries({ queryKey: fitmentKeys.domain(domainId) });
    },
  });
}

/** Set the order of one set of siblings, by listing their ids top-to-bottom. */
export function useReorderFitmentNodes(domainId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { parentId: string | null; orderedIds: string[] }) =>
      api.post('/v1/commerce/fitment/nodes/reorder', {
        domainId,
        parentId: input.parentId,
        orderedIds: input.orderedIds,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fitmentKeys.nodes(domainId) });
    },
  });
}

/* ── The starter library (install a ready-made dictionary) ──────────────── */

export interface FitmentDictionarySummaryChip {
  label: string;
  tone?: 'module' | 'neutral';
}

/** One installable starter list, as the picker shows it. Comes from the
 *  cross-module preset seam (`/v1/presets?module=commerce&kind=fitment`). */
export interface FitmentDictionaryOption {
  module: string;
  slug: string;
  kind: string;
  name: string;
  description: string;
  iconKey: string;
  tags: string[];
  summary: FitmentDictionarySummaryChip[];
  installed: boolean;
}

/** The ready-made lists a business can install. Long-lived — the library is
 *  data-as-code and only its `installed` flags move. */
export function useFitmentDictionaries() {
  return useQuery({
    queryKey: fitmentKeys.presets,
    queryFn: () =>
      api.get<FitmentDictionaryOption[]>('/v1/presets', { module: 'commerce', kind: 'fitment' }),
    staleTime: 5 * 60_000,
  });
}

/** Stamp a starter list as this business's own domain + tree. Returns the new
 *  domain id so the caller can open it. */
export function useInstallFitmentDictionary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => api.post<{ id: string }>(`/v1/presets/commerce/${slug}/install`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fitmentKeys.domains });
      void queryClient.invalidateQueries({ queryKey: fitmentKeys.presets });
    },
  });
}

/* ── Errors ─────────────────────────────────────────────────────────────── */

/**
 * The server's own sentence for a 4xx, which these routes write to be shown
 * verbatim: "Can't remove level "Model" — 12 node(s) still use it", "A node with
 * slug "ford" already exists here". A 5xx carries no such sentence, so it falls
 * back to the caller's wording.
 */
export function fitmentErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}

/* ── Reading a domain's shape out loud ──────────────────────────────────── */

export function levelDimensions(domain: FitmentDomain): FitmentDimension[] {
  return domain.dimensions.filter((dimension) => dimension.kind === 'level');
}

export function rangeDimensions(domain: FitmentDomain): FitmentDimension[] {
  return domain.dimensions.filter((dimension) => dimension.kind === 'range');
}

/** "Make › Model › Engine, narrowed by Year" — the whole shape in one phrase. */
export function dimensionSummary(domain: FitmentDomain): string {
  const levels = levelDimensions(domain)
    .map((dimension) => dimension.label)
    .join(' › ');
  const ranges = rangeDimensions(domain);
  if (ranges.length === 0) return levels || '—';
  return `${levels}, narrowed by ${ranges.map((r) => r.label).join(' & ')}`;
}

/** A naive-but-decent English plural, for counting entries by their level's
 *  name ("4 makes", "3 models", "8 sizes"). */
export function pluralize(word: string, count: number): string {
  if (count === 1) return word;
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/.test(word)) return `${word}es`;
  return `${word}s`;
}

/** "4 makes", "8 sizes" — the top-level count named by the first level. */
export function rootCountLabel(domain: FitmentDomain): string {
  const first = levelDimensions(domain)[0]?.label.toLowerCase() ?? 'entry';
  return `${String(domain.rootCount)} ${pluralize(first, domain.rootCount)}`;
}

/* ── Deriving machine ids from human labels ─────────────────────────────── */

/** A domain slug — lowercase, digits, hyphens (matches the API's SlugString). */
export function slugifyDomain(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

/** A node slug — same alphabet as a domain slug, room for 127 chars. */
export function slugifyNode(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 127);
}

/** A dimension key — a stable snake_case machine id derived from a label, never
 *  shown to the operator. Must start with a letter (the schema's rule), so a
 *  label starting with a digit is prefixed. */
export function dimensionKeyFrom(label: string): string {
  let key = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  if (key === '') key = 'level';
  if (!/^[a-z]/.test(key)) key = `x_${key}`.slice(0, 40);
  return key;
}
