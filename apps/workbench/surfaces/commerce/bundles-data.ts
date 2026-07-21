'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE BUNDLE DATA LAYER
//
// A bundle sells several products together as one item — a starter kit, a gift
// set, a service package — usually for less than buying the parts on their own.
// It is SOLD AS a wrapper product (chosen once, on create) and made up of
// COMPONENTS, each a specific product version (a variant). Everything sent here
// satisfies `CreateBundleInput` / `UpdateBundleInput` from `@sparx/commerce-
// schemas`.
//
//   ['commerce','bundles']              the root every read nests under
//   ['commerce','bundles','list',{q}]   the list surface's window
//   ['commerce','bundles', id]          one bundle, with its components
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import { api } from '../../lib/api/client';
// The read shapes are the product layer's — one definition, shared, so the
// bundle a product-scoped pane reads and the one this list reads cannot drift.
import type { Bundle, BundleComponent, BundleDetail } from './products-data';

export type { Bundle, BundleComponent, BundleDetail };

export const bundleKeys = {
  all: ['commerce', 'bundles'] as const,
  detail: (id: string) => [...bundleKeys.all, id] as const,
};

export type BundlePricingMode = 'sum_of_components' | 'fixed' | 'percent_off_sum';
export type BundleInventoryMode = 'decrement_components' | 'decrement_bundle_sku';

/* ── Queries ────────────────────────────────────────────────────────────── */

export function useBundle(id: string) {
  return useQuery({
    queryKey: bundleKeys.detail(id),
    queryFn: () => api.get<BundleDetail>(`/v1/commerce/bundles/${id}`),
    enabled: id !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/* ── The variant catalog (component + add-on picker) ────────────────────── */

/** A specific, sellable version of a product — what a bundle component and a
 *  configurator add-on both point at. */
export interface VariantChoice {
  id: string;
  sku: string;
  title: string | null;
  isDefault: boolean;
  priceCents: number;
  currency: string;
  archivedAt: string | null;
  productId: string;
  productTitle: string;
  productHandle: string;
  productStatus: string;
}

/**
 * The whole sellable catalog, one call.
 *
 * The tenant-wide variants endpoint takes no search term of its own, so this
 * pulls a window ordered by product title and the picker filters it in the
 * browser. Fine for the realistic case; a catalog past the ceiling is the
 * signal to give that endpoint a real `q`.
 */
export function useVariantCatalog() {
  return useQuery({
    queryKey: ['commerce', 'variants', 'catalog'] as const,
    queryFn: () => api.get<VariantChoice[]>('/v1/commerce/variants', { take: 500 }),
    staleTime: 60_000,
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

export function useInvalidateBundles() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: bundleKeys.all });
    if (id) void queryClient.invalidateQueries({ queryKey: bundleKeys.detail(id) });
  };
}

/* ── Mutations ──────────────────────────────────────────────────────────── */

export interface BundleComponentInput {
  variantId: string;
  defaultQuantity: number;
  isRequired: boolean;
  isSwappable: boolean;
  swappableProductId?: string;
  position: number;
}

export interface CreateBundleInput {
  bundleProductId: string;
  pricingMode: BundlePricingMode;
  fixedPriceCents?: number;
  percentOffSum?: number;
  inventoryMode: BundleInventoryMode;
  components: BundleComponentInput[];
}

export function useCreateBundle() {
  const invalidate = useInvalidateBundles();
  return useMutation({
    mutationFn: (input: CreateBundleInput) => api.post<{ id: string }>('/v1/commerce/bundles', input),
    onSuccess: (created) => {
      invalidate(created.id);
    },
  });
}

/** What an edit can change. `bundleProductId` is absent — the wrapper product is
 *  fixed once the bundle exists (the server has no way to move it). */
export interface UpdateBundleInput {
  pricingMode?: BundlePricingMode;
  fixedPriceCents?: number | null;
  percentOffSum?: number | null;
  inventoryMode?: BundleInventoryMode;
  components?: BundleComponentInput[];
}

export function useUpdateBundle(id: string) {
  const invalidate = useInvalidateBundles();
  return useMutation({
    mutationFn: (patch: UpdateBundleInput) => api.patch(`/v1/commerce/bundles/${id}`, patch),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useDeleteBundle(id: string) {
  const invalidate = useInvalidateBundles();
  return useMutation({
    mutationFn: () => api.delete(`/v1/commerce/bundles/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

/* ── Errors ─────────────────────────────────────────────────────────────── */

export function bundleErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}
