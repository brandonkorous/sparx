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

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import { apiErrorMessage } from '../../lib/api-error';

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

/* ── Connecting one ─────────────────────────────────────────────────────── */

// The handshake the API has always had and nothing ever started.
//
// `GET /v1/channels/:slug/connect-url` signs a short-lived state, hands back the
// shop's consent URL, and `POST /v1/channels/callback` trades the code for a
// stored, encrypted connection. Both shipped. **MEASURED 2026-09-19: neither had
// a single caller anywhere in either console**, while the pane above showed Meta
// with a green **Available** badge and a line reading "can be connected from
// your settings" — a settings screen that does not connect it either.
//
// So a shop the platform was ready to sell through could not be reached from
// any screen. Issue 733. [[feedback_screen_over_a_function_nobody_calls]]
//
// Same shape as Search Console and the social platforms: the pane opens a popup,
// our own callback route relays the code back, and the pane does the exchange on
// the console's own token.

/** The shop's consent URL. `redirectUri` is a route on this app that hands the
 *  code back through `window.opener`. */
export function useChannelConnectUrl() {
  return useMutation({
    mutationFn: (input: { slug: string; redirectUri: string }) =>
      api.get<{ url: string }>(`/v1/channels/${input.slug}/connect-url`, {
        redirect_uri: input.redirectUri,
      }),
  });
}

/** Trade the code the shop returned for a stored, encrypted connection. */
export function useCompleteChannelConnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { code: string; state: string }) =>
      api.post<{ connected: boolean; channel: string; externalId: string | null }>(
        '/v1/channels/callback',
        input
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: channelKeys.overview() });
    },
  });
}

/** What went wrong, in words, for anything this layer does. */
export function channelErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}
