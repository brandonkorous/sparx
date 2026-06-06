'use server';

// Marketplace blueprints browse fetch (docs/60 §6). The api-rest client is
// server-only (it forwards the session), so the client browse component pages
// through "Load more" by calling this server action rather than hitting api-rest
// directly. Filter/sort changes navigate (URL params) instead — see the page.

import 'server-only';

import { api } from '@/lib/api-rest-client';
import type { BrowseResponse } from '../_types';

export async function fetchBlueprintsPage(query: Record<string, string>): Promise<BrowseResponse> {
  const qs = new URLSearchParams(query).toString();
  return api.get<BrowseResponse>(`/v1/marketplace/blueprints${qs ? `?${qs}` : ''}`);
}
