'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE COLLECTION DATA LAYER
//
// A collection is a themed group of products you show together — "Summer sale",
// "New arrivals", "Diesel service specials". Unlike a category it is NOT part of
// the site menu; it is a set you can place wherever you like. A collection is
// either MANUAL (a list you hand-pick) or RULES-BASED (conditions that fill it
// for you).
//
// ── The canonical rule shape lives in the schema package, not here ─────────
//
// A rules-based collection stores a `CollectionRuleSet` — `{ match, predicates }`
// — and this UI is the PRODUCER of a format the rule compiler consumes. The
// types AND the Zod validator come straight from `@wizeworks/commerce-schemas`, so
// the editor cannot drift from the contract: `buildRuleSet` runs the real schema
// before a save, and a shape the compiler would reject never reaches the server.
//
// ── The key contract ──────────────────────────────────────────────────────
//
//   ['commerce','collections']              the root every read nests under
//   ['commerce','collections','all']        the whole picker list (shared reader)
//   ['commerce','collections','list',{q}]   the list surface's window
//   ['commerce','collections', id]          one collection, in full
//
// Every write invalidates the ROOT prefix, which reaches the list, the detail,
// AND the product editor's filing picker — a new, renamed or retyped collection
// has to appear in all of them.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
// The Zod validator (a VALUE), aliased so it never clashes with the same-named
// inferred TYPE below. `buildRuleSet` runs `.safeParse` on what the editor made.
import { CollectionRuleSet as CollectionRuleSetSchema } from '@wizeworks/commerce-schemas';
import type { CollectionPredicate, CollectionRuleSet } from '@wizeworks/commerce-schemas';
import { api } from '../../lib/api/client';

// The picker reader the product filing tab uses. Re-exported so callers import
// their collection shapes from one place while there is one implementation.
export { useCollections, type CollectionChoice, type CollectionKind } from './products-data';

// The rule shapes are the schema's, re-exported so the editor and this layer
// share exactly one definition with the compiler.
export type { CollectionPredicate, CollectionRuleSet };

/* ── Shapes ─────────────────────────────────────────────────────────────── */

export type CollectionType = 'manual' | 'rules';

/**
 * One collection in full, as the detail pane edits it. Mirrors the api-rest
 * `CollectionDetail` (collection-service `get`).
 */
export interface CollectionDetail {
  id: string;
  name: string;
  handle: string;
  type: CollectionType;
  /** How many products are currently IN it. For a rules collection this is the
   *  last projection the indexer wrote, not a live recount — see `useReindex`. */
  productCount: number;
  featured: boolean;
  description: string | null;
  heroMediaId: string | null;
  /** The raw stored rule set. `{}` on a manual collection; a `CollectionRuleSet`
   *  on a rules one. Read through `asRuleSet` before handing it to the editor. */
  ruleSet: Record<string, unknown> | null;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageId: string | null;
  /** The materialized member ids. On a manual collection this is the hand-picked
   *  set the products editor writes back. */
  productIds: string[];
  /** Sites this collection is shown on. EMPTY means every site — the default. */
  propertyIds: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * One collection as the LIST surface shows it — the flat summary the
 * `GET /v1/commerce/collections` window returns, not the full editable detail.
 */
export interface CollectionSummary {
  id: string;
  name: string;
  handle: string;
  type: CollectionType;
  productCount: number;
  featured: boolean;
  updatedAt: string;
}

/** Sort direction shared by every server-sorted list. */
export type SortDir = 'asc' | 'desc';

/** The columns the collections table can sort by — EXACTLY the server's Zod
 *  whitelist in `ListCollectionsQuery`. An off-list key would be rejected. */
export type CollectionSort = 'name' | 'type' | 'productCount' | 'updatedAt';

export interface CollectionsPageParams {
  q?: string;
  /** Narrow to one fill mode. Omit for both. */
  type?: CollectionType;
  sortBy: CollectionSort;
  order: SortDir;
  take: number;
  skip: number;
}

export const collectionKeys = {
  all: ['commerce', 'collections'] as const,
  page: (params: CollectionsPageParams) => ['commerce', 'collections', 'page', params] as const,
  detail: (id: string) => [...collectionKeys.all, id] as const,
};

/**
 * The collections TABLE window — one server query per visible window, server
 * sorted and paged. Never a client sort of a loaded page: sorting a single
 * window and presenting it as the whole answer is the exact bug the server sort
 * exists to prevent (ask for the biggest collection, get the biggest one on page
 * three). `placeholderData` keeps the current rows on screen while the next
 * window loads, so paging and re-sorting don't blink out to empty and back.
 */
export function useCollectionsPage(params: CollectionsPageParams) {
  return useQuery({
    queryKey: collectionKeys.page(params),
    queryFn: () =>
      api.list<CollectionSummary>('/v1/commerce/collections', {
        ...(params.q?.trim() ? { q: params.q.trim() } : {}),
        ...(params.type ? { type: params.type } : {}),
        sort_by: params.sortBy,
        order: params.order,
        take: params.take,
        skip: params.skip,
      }),
    placeholderData: (previous) => previous,
  });
}

/* ── Reading the stored rule set safely ─────────────────────────────────── */

/**
 * Turn a collection's stored `ruleSet` into a real `CollectionRuleSet`, or null.
 *
 * The column is `{}` on a manual collection and can hold a rule set written by an
 * older editor, so it is validated on the way in rather than trusted — a shape
 * the schema rejects becomes "no usable rules" (the editor then starts fresh)
 * instead of a runtime crash deep in a predicate row.
 */
export function asRuleSet(
  raw: Record<string, unknown> | null | undefined
): CollectionRuleSet | null {
  if (!raw || Object.keys(raw).length === 0) return null;
  const parsed = CollectionRuleSetSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * Validate a rule set the editor built before it is saved.
 *
 * This is the guarantee the whole rule editor exists to make good on: whatever
 * the UI produced has to satisfy the SAME schema the compiler reads. Returns the
 * parsed value or a human sentence naming the first problem.
 */
export function buildRuleSet(
  candidate: unknown
): { ok: true; value: CollectionRuleSet } | { ok: false; error: string } {
  const parsed = CollectionRuleSetSchema.safeParse(candidate);
  if (parsed.success) return { ok: true, value: parsed.data };
  const first = parsed.error.issues[0];
  return {
    ok: false,
    error: first?.message ?? 'One of the conditions is not filled in correctly.',
  };
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export function useCollection(id: string) {
  return useQuery({
    queryKey: collectionKeys.detail(id),
    queryFn: () => api.get<CollectionDetail>(`/v1/commerce/collections/${id}`),
    enabled: id !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

export function useInvalidateCollections() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: collectionKeys.all });
    if (id) void queryClient.invalidateQueries({ queryKey: collectionKeys.detail(id) });
  };
}

/* ── Mutations ──────────────────────────────────────────────────────────── */

export interface CreateCollectionInput {
  name: string;
  handle?: string;
  description?: string | null;
  type: CollectionType;
  /** Required when `type` is `rules`; the server rejects a rules collection with
   *  no rule set. */
  ruleSet?: CollectionRuleSet;
  heroMediaId?: string | null;
  featured?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  ogImageId?: string | null;
  propertyIds?: string[];
}

export function useCreateCollection() {
  const invalidate = useInvalidateCollections();
  return useMutation({
    mutationFn: (input: CreateCollectionInput) =>
      api.post<{ id: string; handle: string }>('/v1/commerce/collections', input),
    onSuccess: (created) => {
      invalidate(created.id);
    },
  });
}

/** What an edit can change. `type` is deliberately absent — the server refuses a
 *  manual↔rules flip (it would lose the other mode's data), so the UI never
 *  offers one and this payload cannot carry one. */
export interface UpdateCollectionInput {
  name?: string;
  handle?: string;
  description?: string | null;
  ruleSet?: CollectionRuleSet;
  heroMediaId?: string | null;
  featured?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  ogImageId?: string | null;
  propertyIds?: string[];
}

export function useUpdateCollection(id: string) {
  const invalidate = useInvalidateCollections();
  return useMutation({
    mutationFn: (patch: UpdateCollectionInput) =>
      api.patch(`/v1/commerce/collections/${id}`, patch),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

/** Replace a MANUAL collection's members with this exact set. The server rejects
 *  this on a rules collection — those fill themselves. */
export function useSetCollectionProducts(id: string) {
  const invalidate = useInvalidateCollections();
  return useMutation({
    mutationFn: (productIds: string[]) =>
      api.post('/v1/commerce/collections/set-products', { collectionId: id, productIds }),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

/**
 * Ask the server to re-check which products a RULES collection matches.
 *
 * Membership is projected in the BACKGROUND (the indexer worker), not computed
 * on this call, so the returned/shown count updates shortly rather than
 * instantly. The UI says so rather than faking a fresh number.
 */
export function useReindexCollection(id: string) {
  const invalidate = useInvalidateCollections();
  return useMutation({
    mutationFn: () => api.post(`/v1/commerce/collections/${id}/reindex`),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useDeleteCollection(id: string) {
  const invalidate = useInvalidateCollections();
  return useMutation({
    mutationFn: () => api.delete(`/v1/commerce/collections/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

/* ── Errors ─────────────────────────────────────────────────────────────── */

export function collectionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}

export function slugifyHandle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}
