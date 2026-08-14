'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE PRICE-LIST DATA LAYER
//
// A price list is a named set of special prices for particular customers — a
// wholesale sheet, a distributor's rates, a "trade" price for the businesses you
// supply. It carries ONE currency, a targeting rule (everyone on a channel, one
// customer group, or one trade account), an optional go-live window, and a set
// of per-product-version ENTRIES: either a fixed price, or a percentage off the
// normal price.
//
// This is the AUTHORING home the product Pricing tab and the B2B panes already
// point at (they READ `price-list-entries`; this is the WRITE side). Everything
// sent here satisfies the pricing Zod schemas in `@sparx/commerce-schemas`.
//
//   ['commerce','price-lists']                the root every read nests under
//   ['commerce','price-lists','list',{…}]     the list surface's window
//   ['commerce','price-lists', id]            one list, in full
//   ['commerce','price-lists', id, 'entries'] its per-version prices
//
// Every write invalidates the ROOT prefix, which also reaches the product
// Pricing tab's `price-list-entries` read — a new or changed trade price has to
// show up there too.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import { api } from '../../lib/api/client';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

export type PriceListStatus = 'draft' | 'active' | 'archived';

/** One price list as the list surface and the detail header read it. Mirrors
 *  api-rest `PriceListRow` (pricing-service `serializePriceList`). */
export interface PriceListRow {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  /** null = applies on every channel. */
  channel: string | null;
  customerSegmentId: string | null;
  companyId: string | null;
  collectionId: string | null;
  priority: number;
  validFrom: string | null;
  validTo: string | null;
  status: PriceListStatus;
  /** How many per-version prices are on it. */
  entryCount: number;
  /** The sites this list prices on. EMPTY = all of them. */
  propertyIds: string[];
  updatedAt: string;
}

/** One per-version price on a list. Mirrors api-rest `PriceListEntryRow`
 *  (pricing-service `listEntries`). */
export interface PriceListEntryRow {
  id: string;
  variantId: string;
  variantSku: string;
  productTitle: string;
  fixedPriceCents: number | null;
  percentOffList: number | null;
  minQuantity: number;
  maxQuantity: number | null;
}

/** A targetable audience — a saved customer group, or a trade account. Both come
 *  from CRM, so both are named `{ id, name }`. */
export interface NamedChoice {
  id: string;
  name: string;
}

export const priceListKeys = {
  all: ['commerce', 'price-lists'] as const,
  detail: (id: string) => [...priceListKeys.all, id] as const,
  entries: (id: string) => [...priceListKeys.all, id, 'entries'] as const,
};

/* ── Display state ──────────────────────────────────────────────────────── */

export type StateTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/**
 * What a price list is DOING right now, in one word, as a semantic tone.
 *
 * The stored status (draft/active/archived) is only half the story: an active
 * list whose start date is in the future is not live YET, and one whose end
 * date has passed is no longer live. So the shown state is derived from the
 * status AND the schedule — the same question the shop owner is actually asking
 * when they scan this list. State is its own colour axis (docs/23), independent
 * of the commerce module hue.
 */
export function priceListState(row: {
  status: PriceListStatus;
  validFrom: string | null;
  validTo: string | null;
}): { label: string; tone: StateTone } {
  if (row.status === 'archived') return { label: 'Retired', tone: 'neutral' };
  if (row.status === 'draft') return { label: 'Not live', tone: 'warning' };
  const now = Date.now();
  if (row.validFrom && new Date(row.validFrom).getTime() > now) {
    return { label: 'Scheduled', tone: 'info' };
  }
  if (row.validTo && new Date(row.validTo).getTime() < now) {
    return { label: 'Ended', tone: 'neutral' };
  }
  return { label: 'Live', tone: 'success' };
}

/** Who a price list is for, in plain words — for the list column, where the
 *  specific group/account name is not loaded. */
export function audienceSummary(row: {
  customerSegmentId: string | null;
  companyId: string | null;
}): string {
  if (row.companyId) return 'A trade account';
  if (row.customerSegmentId) return 'A customer group';
  return 'Everyone';
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export function usePriceList(id: string) {
  return useQuery({
    queryKey: priceListKeys.detail(id),
    queryFn: () => api.get<PriceListRow>(`/v1/commerce/price-lists/${id}`),
    enabled: id !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

export function usePriceListEntries(id: string) {
  return useQuery({
    queryKey: priceListKeys.entries(id),
    queryFn: () => api.get<PriceListEntryRow[]>(`/v1/commerce/price-lists/${id}/entries`),
    enabled: id !== 'new',
  });
}

/**
 * The customer groups a list can target (CRM segments).
 *
 * Behind the CRM module, so a tenant without it gets a 404 — treated as "no
 * groups to choose from" rather than an error, because targeting a group is
 * optional and the pane must still work with the module off.
 */
export function useCustomerSegments(enabled: boolean) {
  return useQuery({
    queryKey: ['commerce', 'price-lists', 'segments'] as const,
    queryFn: () => api.list<NamedChoice>('/v1/crm/segments', { take: 250 }),
    enabled,
    staleTime: 60_000,
    retry: (failureCount, error) =>
      error instanceof ApiError && (error.status === 404 || error.status === 403)
        ? false
        : failureCount < 2,
  });
}

/** The trade accounts a list can target (CRM B2B accounts). Same module-off
 *  tolerance as {@link useCustomerSegments}. */
export function useB2bAccounts(enabled: boolean) {
  return useQuery({
    queryKey: ['commerce', 'price-lists', 'accounts'] as const,
    queryFn: () => api.list<NamedChoice>('/v1/crm/b2b-accounts', { take: 250 }),
    enabled,
    staleTime: 60_000,
    retry: (failureCount, error) =>
      error instanceof ApiError && (error.status === 404 || error.status === 403)
        ? false
        : failureCount < 2,
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

export function useInvalidatePriceLists() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    // Root prefix — reaches the list, the detail, AND the product Pricing tab's
    // `price-list-entries` read, which is keyed off a different root but shows
    // this same data.
    void queryClient.invalidateQueries({ queryKey: priceListKeys.all });
    void queryClient.invalidateQueries({ queryKey: ['commerce', 'products'] });
    if (id) {
      void queryClient.invalidateQueries({ queryKey: priceListKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: priceListKeys.entries(id) });
    }
  };
}

/* ── Mutations ──────────────────────────────────────────────────────────── */

export interface PriceListWriteInput {
  name: string;
  description?: string | null;
  currency: string;
  channel?: string | null;
  customerSegmentId?: string | null;
  companyId?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  status: PriceListStatus;
  /** Full replacement set. Empty = every site; omitted on an update = untouched. */
  propertyIds?: string[];
}

export function useCreatePriceList() {
  const invalidate = useInvalidatePriceLists();
  return useMutation({
    mutationFn: (input: PriceListWriteInput) =>
      api.post<{ id: string }>('/v1/commerce/price-lists', input),
    onSuccess: (created) => {
      invalidate(created.id);
    },
  });
}

export function useUpdatePriceList(id: string) {
  const invalidate = useInvalidatePriceLists();
  return useMutation({
    mutationFn: (patch: Partial<PriceListWriteInput>) =>
      api.patch(`/v1/commerce/price-lists/${id}`, patch),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useArchivePriceList(id: string) {
  const invalidate = useInvalidatePriceLists();
  return useMutation({
    mutationFn: () => api.post(`/v1/commerce/price-lists/${id}/archive`),
    onSuccess: () => {
      invalidate();
    },
  });
}

/** One entry as the bulk writer accepts it — exactly one of `fixedPriceCents` or
 *  `percentOffList` is set, matching the server's refinement. */
export interface BulkEntryInput {
  variantId: string;
  fixedPriceCents?: number;
  percentOffList?: number;
  minQuantity: number;
}

/**
 * Write MANY entries in ONE request (upsert on variant + quantity).
 *
 * A price list can carry a lot of prices, and a request per entry is the storm
 * the workbench data layer forbids — so the whole set goes in one call to
 * `bulkSetEntries`. Note this only WRITES the entries given; entries removed in
 * the editor are deleted separately via {@link useDeletePriceListEntry}.
 */
export function useBulkSetEntries(id: string) {
  const invalidate = useInvalidatePriceLists();
  return useMutation({
    mutationFn: (entries: BulkEntryInput[]) =>
      api.post<{ written: number }>(`/v1/commerce/price-lists/${id}/entries/bulk`, { entries }),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useDeletePriceListEntry(id: string) {
  const invalidate = useInvalidatePriceLists();
  return useMutation({
    mutationFn: (entryId: string) => api.delete(`/v1/commerce/price-list-entries/${entryId}`),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

/* ── Errors ─────────────────────────────────────────────────────────────── */

export function priceListErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}
