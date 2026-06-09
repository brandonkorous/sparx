'use server';

import { api } from '@/lib/api-rest-client';

interface TierBody {
  name: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  productScope: 'all' | 'collections' | 'products';
  minOrderCents: number;
}

export async function createPricingTier(body: TierBody): Promise<{ error?: string }> {
  try {
    await api.post('/v1/b2b/pricing-tiers', body);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Create failed' };
  }
}
