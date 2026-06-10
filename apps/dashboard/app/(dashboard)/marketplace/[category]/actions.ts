'use server';

// Marketplace category browse fetch (docs/60 §6). The api-rest client is
// server-only (it forwards the session), so the client browse component pages
// through "Load more" by calling this server action rather than hitting api-rest
// directly. Filter/sort changes navigate (URL params) instead — see the page.

import 'server-only';

import type { MarketplaceListResponse } from '../_types';

import { api } from '@/lib/api-rest-client';

export async function fetchCategoryPage(
  category: string,
  query: Record<string, string>
): Promise<MarketplaceListResponse> {
  const qs = new URLSearchParams(query).toString();
  return api.get<MarketplaceListResponse>(
    `/v1/marketplace/${encodeURIComponent(category)}${qs ? `?${qs}` : ''}`
  );
}
