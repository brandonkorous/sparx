'use client';

// ══════════════════════════════════════════════════════════════════════════
// PRICE TIERS — named trade levels you set a discount on once.
//
// A price tier is a level like "Trade", "Distributor" or "Key account": you set
// how much it takes off, and then every account on that tier gets it — instead
// of setting a discount on each customer by hand. A tier can also carry per-
// product overrides (a fixed price or a bigger cut on specific items).
//
//   ['b2b','pricing-tiers']                the root every read nests under
//   ['b2b','pricing-tiers','list',{…}]     the list window
//   ['b2b','pricing-tiers', id]            one tier
//   ['b2b','pricing-tiers', id, 'overrides'] its per-product prices
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { api } from '../../lib/api/client';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

export type DiscountType = 'percentage' | 'fixed';
export type ProductScope = 'all' | 'collections' | 'products';

export interface TierRow {
  id: string;
  name: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: number;
  productScope: ProductScope;
  minOrderCents: number;
  accountCount?: number;
  createdAt: string;
  updatedAt: string;
}

/** One per-product price on a tier. Exactly one of a fixed price or a discount
 *  percentage is set, and exactly one of a variant or a collection. */
export interface TierOverride {
  id: string;
  tierId: string;
  variantId: string | null;
  collectionId: string | null;
  priceCents: number | null;
  discountPercentage: number | null;
  notes: string | null;
  variant: { id: string; sku: string; title: string | null } | null;
  collection: { id: string; name: string } | null;
}

export const tierKeys = {
  all: ['b2b', 'pricing-tiers'] as const,
  detail: (id: string) => [...tierKeys.all, id] as const,
  overrides: (id: string) => [...tierKeys.all, id, 'overrides'] as const,
};

/* ── Display language ───────────────────────────────────────────────────── */

export function discountSummary(row: {
  discountType: DiscountType;
  discountValue: number;
}): string {
  if (row.discountValue <= 0) return 'No standing discount';
  return row.discountType === 'percentage'
    ? `${String(row.discountValue)}% off`
    : `${new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(row.discountValue)} off`;
}

export function formatCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export interface TierListQuery {
  q?: string;
  take: number;
  skip: number;
}

export function useTiers(query: TierListQuery) {
  return useQuery({
    queryKey: [...tierKeys.all, 'list', query],
    queryFn: () =>
      api.list<TierRow>('/v1/b2b/pricing-tiers', {
        ...(query.q ? { q: query.q } : {}),
        take: query.take,
        skip: query.skip,
      }),
    placeholderData: (previous) => previous,
  });
}

export function useTier(id: string) {
  return useQuery({
    queryKey: tierKeys.detail(id),
    queryFn: () => api.get<TierRow>(`/v1/b2b/pricing-tiers/${id}`),
    enabled: id !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

export function useTierOverrides(id: string) {
  return useQuery({
    queryKey: tierKeys.overrides(id),
    queryFn: () => api.get<TierOverride[]>(`/v1/b2b/pricing-tiers/${id}/overrides`),
    enabled: id !== 'new',
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

export function useInvalidateTiers() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: tierKeys.all });
    if (id) {
      void queryClient.invalidateQueries({ queryKey: tierKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: tierKeys.overrides(id) });
    }
  };
}

/* ── Mutations ──────────────────────────────────────────────────────────── */

export interface TierWriteInput {
  name: string;
  description?: string | null;
  discountType: DiscountType;
  discountValue: number;
  productScope: ProductScope;
  minOrderCents: number;
}

export function useCreateTier() {
  const invalidate = useInvalidateTiers();
  return useMutation({
    mutationFn: (input: TierWriteInput) => api.post<TierRow>('/v1/b2b/pricing-tiers', input),
    onSuccess: (created) => {
      invalidate(created.id);
    },
  });
}

export function useUpdateTier(id: string) {
  const invalidate = useInvalidateTiers();
  return useMutation({
    mutationFn: (patch: Partial<TierWriteInput>) => api.patch(`/v1/b2b/pricing-tiers/${id}`, patch),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useDeleteTier(id: string) {
  const invalidate = useInvalidateTiers();
  return useMutation({
    mutationFn: () => api.delete(`/v1/b2b/pricing-tiers/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

export interface OverrideInput {
  variantId: string;
  priceCents?: number;
  discountPercentage?: number;
  notes?: string;
}

export function useAddOverride(id: string) {
  const invalidate = useInvalidateTiers();
  return useMutation({
    mutationFn: (input: OverrideInput) => api.post(`/v1/b2b/pricing-tiers/${id}/overrides`, input),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useDeleteOverride(id: string) {
  const invalidate = useInvalidateTiers();
  return useMutation({
    mutationFn: (overrideId: string) =>
      api.delete(`/v1/b2b/pricing-tiers/${id}/overrides/${overrideId}`),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

/* ── Errors ─────────────────────────────────────────────────────────────── */

export function tierErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}
