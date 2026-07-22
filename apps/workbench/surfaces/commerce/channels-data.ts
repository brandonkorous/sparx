'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE SALES-CHANNELS DATA LAYER
//
// product-channels.tsx shows where ONE product is listed (its variant↔listing
// mappings). This layer is the catalog-wide view: every outside shop the whole
// business has connected, how healthy each connection is, how many listings it
// carries, plus the catalog of shops available to connect.
//
// Connections are CREATED by the OAuth handshake + the sync worker (the side
// that knows the external ids), so this layer reads them and can DISCONNECT one
// — it never hand-creates a connection. Gated on the Commerce module server-side
// (`requireChannelsModule`); a 404 here means the module is off, not an error.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { api } from '../../lib/api/client';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

/** One connected outside shop. `mappingCount` is how many of your product
 *  listings ride on it — the cross-catalog signal this surface leads with. */
export interface ChannelConnection {
  id: string;
  channel: string;
  status: string;
  propertyId: string | null;
  shopName: string | null;
  externalId: string | null;
  lastSyncedAt: string | null;
  connectedAt: string;
  mappingCount: number;
}

/** A shop you could sell through. `availability` is resolved at runtime — a
 *  shop only reads `available` once sparx has provisioned its partner app. */
export interface ChannelCatalogEntry {
  slug: string;
  name: string;
  shape: string;
  tagline: string;
  managesOrders: boolean;
  bestFor: string;
  phase: 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
  availability: 'available' | 'coming_soon';
}

export interface ChannelsPayload {
  connections: ChannelConnection[];
  catalog: ChannelCatalogEntry[];
}

/* ── Keys ───────────────────────────────────────────────────────────────── */

export const channelKeys = {
  all: ['commerce', 'channels'] as const,
  overview: () => [...channelKeys.all, 'overview'] as const,
};

/* ── Queries ────────────────────────────────────────────────────────────── */

export function useChannels() {
  return useQuery({
    queryKey: channelKeys.overview(),
    queryFn: () => api.get<ChannelsPayload>('/v1/channels'),
    // A channel connection changes rarely, but the sync health / last-sync
    // timestamps drift; the default minute stale time is right here.
  });
}

/* ── Mutations ──────────────────────────────────────────────────────────── */

/** Disconnect one shop. Its product listings cascade away on our side — it does
 *  NOT take the listings down on the shop itself; the copy must say so. */
export function useDisconnectChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => api.delete(`/v1/channels/${slug}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: channelKeys.overview() });
    },
  });
}

/* ── Saying what a state means ──────────────────────────────────────────── */

export function connectionState(status: string): {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
} {
  switch (status) {
    case 'active':
      return { label: 'Connected', tone: 'success' };
    case 'paused':
      return { label: 'Paused', tone: 'warning' };
    case 'error':
      return { label: 'Needs attention', tone: 'danger' };
    case 'disconnected':
      return { label: 'Disconnected', tone: 'neutral' };
    default:
      return { label: status.replace(/_/g, ' '), tone: 'neutral' };
  }
}
