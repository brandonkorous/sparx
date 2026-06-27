'use server';

// Server actions for the Finance → Channels revenue view (docs/110 Slice 4b). The
// read-only revenue rollup; connecting and syncing channels stays in Settings →
// Sales channels (D4: rollup-in-Finance / manage-in-place). Tenant-scoped via the
// api-rest client; the reports API gates on the Commerce module + role server-side.

import 'server-only';
import { api } from '@/lib/api-rest-client';
import type { ChannelRevenueReport, ChannelTopProduct } from './_types';

/** Revenue consolidated across every channel (last 30 days). Returns null when the
 *  Commerce reports aren't reachable (e.g. module off) so the page degrades. */
export async function getChannelRevenue(): Promise<ChannelRevenueReport | null> {
  return api.get<ChannelRevenueReport>('/v1/commerce/reports/channel-revenue').catch(() => null);
}

/** Top products for one channel key (last 30 days), for the channel drill-down. */
export async function getChannelTopProducts(channel: string): Promise<ChannelTopProduct[]> {
  return api
    .get<
      ChannelTopProduct[]
    >(`/v1/commerce/reports/channel-top-products?channel=${encodeURIComponent(channel)}&limit=5`)
    .catch(() => []);
}
