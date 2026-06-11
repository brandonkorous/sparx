'use server';

import { revalidatePath } from 'next/cache';

import { api } from '@/lib/api-rest-client';

import type { ActionResult } from './_action-helpers';
import { restAction } from './_rest-action';

// Staged price-recompute review queue (docs/48 §8/§11). The markup-recompute-
// worker stages cost-driven price changes it won't apply silently; these actions
// approve (apply the proposed price) or reject (discard) them.

export async function approvePriceReviewAction(
  id: string
): Promise<ActionResult<{ variantId: string; newPriceCents: number }>> {
  return restAction(async () => {
    const result = await api.post<{ variantId: string; newPriceCents: number }>(
      `/v1/markup-recompute-reviews/${id}/approve`,
      {}
    );
    revalidatePath('/commerce/price-reviews');
    return result;
  });
}

export async function rejectPriceReviewAction(id: string): Promise<ActionResult<{ ok: true }>> {
  return restAction(async () => {
    await api.post(`/v1/markup-recompute-reviews/${id}/reject`, {});
    revalidatePath('/commerce/price-reviews');
    return { ok: true as const };
  });
}

export async function bulkResolvePriceReviewsAction(
  ids: string[],
  action: 'approve' | 'reject'
): Promise<ActionResult<{ resolved: number; failed: number }>> {
  return restAction(async () => {
    const result = await api.post<{ resolved: number; failed: number }>(
      '/v1/markup-recompute-reviews/bulk',
      { ids, action }
    );
    revalidatePath('/commerce/price-reviews');
    return result;
  });
}
