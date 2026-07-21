'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE sparx.market DATA LAYER
//
// product-channels.tsx toggles ONE product onto sparx.market. This layer is the
// catalog-wide management view: whether the business PARTICIPATES at all, every
// product currently listed, and what the marketplace has earned and paid out.
//
// Participation gating is real and server-enforced: listing a product requires
// `MarketMerchantProfile.enabled` (marketService.assertParticipating), so the
// surface must reflect the enrolled/not-enrolled split honestly rather than
// showing an empty product table behind a dead toggle. Writes require the
// `admin` role; a 403 is a permission answer, not a failure.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@sparx/query';
import { api } from '../../lib/api/client';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

export interface MarketProfile {
  enabled: boolean;
  bio: string | null;
  location: string | null;
  headline: string | null;
  bannerMediaId: string | null;
  defaultCategory: string | null;
  commissionBps: number;
  hasCommissionOverride: boolean;
}

export interface OptedInProduct {
  productId: string;
  title: string;
  handle: string;
  category: string | null;
  featured: boolean;
  approved: boolean;
  inStock: boolean;
  priceMinCents: number | null;
}

export interface SettlementSummary {
  grossCents: number;
  commissionCents: number;
  netCents: number;
  paidCents: number;
  pendingCents: number;
  orderCount: number;
}

/* ── Keys ───────────────────────────────────────────────────────────────── */

export const marketKeys = {
  all: ['commerce', 'market'] as const,
  profile: () => [...marketKeys.all, 'profile'] as const,
  products: () => [...marketKeys.all, 'products'] as const,
  settlement: () => [...marketKeys.all, 'settlement'] as const,
};

/** A listing change moves the product table AND the settlement/participation
 *  picture; toggling participation re-projects every listing. Refresh the lot. */
function invalidateMarket(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: marketKeys.all });
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export function useMarketProfile() {
  return useQuery({
    queryKey: marketKeys.profile(),
    queryFn: () => api.get<MarketProfile>('/v1/market/profile'),
  });
}

export function useMarketProducts() {
  return useQuery({
    queryKey: marketKeys.products(),
    queryFn: () =>
      api.get<{ rows: OptedInProduct[]; total: number }>('/v1/market/products', { take: 200 }),
  });
}

export function useMarketSettlement() {
  return useQuery({
    queryKey: marketKeys.settlement(),
    queryFn: () => api.get<SettlementSummary>('/v1/market/settlement/summary'),
  });
}

/* ── Mutations ──────────────────────────────────────────────────────────── */

/** Turn the business's marketplace participation on or off. Off tears down every
 *  listing's public projection; on re-projects the ones still flagged. The whole
 *  profile is sent because the endpoint replaces it (PUT), so the current public
 *  fields are carried through unchanged. */
export function useSetMarketParticipation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { enabled: boolean; profile: MarketProfile }) =>
      api.put('/v1/market/profile', {
        enabled: input.enabled,
        bio: input.profile.bio,
        location: input.profile.location,
        headline: input.profile.headline,
        bannerMediaId: input.profile.bannerMediaId,
        defaultCategory: input.profile.defaultCategory,
      }),
    onSuccess: () => {
      invalidateMarket(queryClient);
    },
  });
}

/** List or un-list one product, and set the section it is filed under. */
export function useSetProductListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { productId: string; listed: boolean; category?: string }) =>
      api.put(`/v1/market/products/${input.productId}`, {
        listed: input.listed,
        ...(input.category ? { category: input.category } : {}),
      }),
    onSuccess: () => {
      invalidateMarket(queryClient);
    },
  });
}

/** Un-list (or list) several products at once from a selection. */
export function useBulkSetListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { productIds: string[]; listed: boolean; category?: string }) =>
      api.post<{ updated: number }>('/v1/market/products/bulk', input),
    onSuccess: () => {
      invalidateMarket(queryClient);
    },
  });
}
