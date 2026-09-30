'use client';

// A resource's linked outside calendars: reads, writes, and what their state
// means. Split out of calendar-data.ts, which keeps the diary's own reads.

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import type { Tone } from './bookings-data';
import { calendarKeys } from './calendar-data';

/* ── Shapes: an external-calendar connection ────────────────────────────── */

export type ConnectionStatus = 'active' | 'expired' | 'error';

/** A resource's linked outside calendar, in the API's safe view (no secrets). */
export interface CalendarConnection {
  id: string;
  resourceId: string;
  provider: string;
  connectionKind: string;
  credentialSource: string;
  direction: string;
  fidelity: string;
  status: ConnectionStatus;
  externalCalendarId: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  createdAt: string;
}

/** Which OAuth connect buttons the deployment can actually offer. */
export interface OAuthProviders {
  cryptoConfigured: boolean;
  google: boolean;
  microsoft: boolean;
}

/** One resource's linked outside calendars (or every connection when unscoped). */
export function useConnections(resourceId?: string) {
  return useQuery({
    queryKey: calendarKeys.connections(resourceId ?? 'all'),
    queryFn: () =>
      api.get<CalendarConnection[]>('/v1/scheduling/calendar/connections', {
        ...(resourceId ? { resourceId } : {}),
      }),
    staleTime: 30_000,
  });
}

/** Which connect options this deployment supports — read once, cached long. */
export function useOAuthProviders() {
  return useQuery({
    queryKey: calendarKeys.oauthProviders(),
    queryFn: () => api.get<OAuthProviders>('/v1/scheduling/calendar/oauth/providers'),
    staleTime: 5 * 60_000,
  });
}

function useInvalidateConnections() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: [...calendarKeys.all, 'connections'] });
    // A fresh feed writes external-busy blocks, which change what the grid shows.
    void queryClient.invalidateQueries({ queryKey: calendarKeys.all });
  };
}

/* ── Writes: calendar connections ───────────────────────────────────────── */

export interface AddIcalFeedPayload {
  resourceId: string;
  icalUrl: string;
  provider?: string;
  label?: string;
}

export function useAddIcalFeed() {
  const invalidate = useInvalidateConnections();
  return useMutation({
    mutationFn: (input: AddIcalFeedPayload) =>
      api.post<CalendarConnection>('/v1/scheduling/calendar/connections/ical', input),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useSyncConnection() {
  const invalidate = useInvalidateConnections();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<CalendarConnection>(`/v1/scheduling/calendar/connections/${id}/sync`),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useRemoveConnection() {
  const invalidate = useInvalidateConnections();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string; deleted: boolean }>(`/v1/scheduling/calendar/connections/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

/* ── Saying what a connection's state means ─────────────────────────────── */

export function connectionStateMeta(status: ConnectionStatus): { label: string; tone: Tone } {
  switch (status) {
    case 'active':
      return { label: 'Syncing', tone: 'success' };
    case 'expired':
      return { label: 'Needs reconnecting', tone: 'warning' };
    case 'error':
      return { label: 'Sync problem', tone: 'danger' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

/** A connection's provider in plain words. */
export function providerLabel(provider: string): string {
  switch (provider) {
    case 'google':
      return 'Google Calendar';
    case 'microsoft':
      return 'Microsoft Outlook';
    case 'apple_caldav':
      return 'Apple iCloud';
    case 'caldav':
      return 'Other calendar (CalDAV)';
    case 'ical':
      return 'Calendar link (iCal)';
    default:
      return provider;
  }
}
