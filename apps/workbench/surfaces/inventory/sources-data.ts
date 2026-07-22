'use client';

// ══════════════════════════════════════════════════════════════════════════
// STOCK SOURCES DATA LAYER
//
// A stock source is a connection to something OUTSIDE sparx that keeps its own
// count — a spreadsheet published on the web, another system's API, or a little
// bridge program running on the business's own computers. When one is set up,
// its numbers flow in and become the on-hand you sell against.
//
// Three kinds, three plain names (see sourceTypeLabel):
//   • csv   → "Spreadsheet file": we fetch a CSV at a web address on a schedule.
//   • api   → "Connected system": we pull JSON from another system's API.
//   • agent → "On-site bridge": a program they install pushes to us; we never
//             dial out. It goes quiet if their computer is off, so its liveness
//             is surfaced loudly rather than trusted.
//
// The API key on a "Connected system" is stored on the server and NEVER sent
// back — reads carry a `hasApiKey` flag instead. The edit form leaves the key
// field blank and the server keeps the stored one; typing a new value replaces
// it. So this layer never holds a secret.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import { api } from '../../lib/api/client';
import type { Tone } from './data';

/* ── Shapes ──────────────────────────────────────────────────────────────── */

export type SourceType = 'csv' | 'api' | 'agent';
export type SourceStatus = 'active' | 'paused' | 'error';

/**
 * One connection. `config` is the type-specific bag of settings the server
 * validates on write and redacts on read (an `api` config comes back with
 * `hasApiKey: true` and no `apiKey`).
 */
export interface InventorySource {
  id: string;
  name: string;
  type: SourceType;
  config: Record<string, unknown>;
  status: SourceStatus;
  lastSyncAt: string | null;
  /** How often we pull, in seconds. 0 means we never pull on our own. */
  syncIntervalSec: number;
  notes: string | null;
  /** On-site bridge only — the visible start of its paired key, when enrolled. */
  apiKeyPrefix: string | null;
  enrolledAt: string | null;
  /** On-site bridge only — when it last reached us. Drives online/offline. */
  agentLastSeenAt: string | null;
  agentVersion: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The declarative pull settings for a "Connected system" (type `api`). Mirrors
 *  the server's ApiSourceConfig; `apiKey` is write-only (blank on read). */
export interface ApiSourceConfigDraft {
  endpoint: string;
  authScheme: 'none' | 'bearer' | 'header';
  apiKey?: string;
  headerName?: string;
  itemsPath?: string;
  skuField: string;
  quantityField: string;
  locationField?: string;
  costField?: string;
  costUnit?: 'cents' | 'dollars';
  hasApiKey?: boolean;
}

export interface SourceListQuery {
  q?: string;
  status?: SourceStatus | '';
  take: number;
  skip: number;
}

/* ── Query keys ──────────────────────────────────────────────────────────── */

export const sourceKeys = {
  all: ['inventory', 'sources'] as const,
  list: (query: SourceListQuery) => [...sourceKeys.all, 'list', query] as const,
  item: (id: string) => [...sourceKeys.all, 'item', id] as const,
};

/* ── Reads ───────────────────────────────────────────────────────────────── */

export function useInventorySources(query: SourceListQuery) {
  return useQuery({
    queryKey: sourceKeys.list(query),
    queryFn: () =>
      api.list<InventorySource>('/v1/inventory/sources', {
        ...(query.q ? { q: query.q } : {}),
        ...(query.status ? { status: query.status } : {}),
        take: query.take,
        skip: query.skip,
      }),
    placeholderData: (previous) => previous,
  });
}

export function useInventorySource(id: string) {
  return useQuery({
    queryKey: sourceKeys.item(id),
    queryFn: () => api.get<InventorySource>(`/v1/inventory/sources/${id}`),
    // Only fetch a real source — the create pane passes 'new', which has nothing
    // to load.
    enabled: id !== '' && id !== 'new',
    // A 404 means this source was removed — an answer, not a fault to retry.
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/* ── Invalidation ────────────────────────────────────────────────────────── */

export function useInvalidateSources() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: sourceKeys.all });
    if (id) void queryClient.invalidateQueries({ queryKey: sourceKeys.item(id) });
  };
}

/* ── Writes ──────────────────────────────────────────────────────────────── */

export interface CreateSourceInput {
  name: string;
  type: SourceType;
  config: Record<string, unknown>;
  syncIntervalSec: number;
  notes: string | null;
}

export function useCreateSource() {
  const invalidate = useInvalidateSources();
  return useMutation({
    mutationFn: (input: CreateSourceInput) =>
      api.post<InventorySource>('/v1/inventory/sources', input),
    onSuccess: (source) => {
      invalidate(source.id);
    },
  });
}

export interface UpdateSourceInput {
  id: string;
  name?: string;
  config?: Record<string, unknown>;
  status?: 'active' | 'paused';
  syncIntervalSec?: number;
  notes?: string | null;
}

export function useUpdateSource() {
  const invalidate = useInvalidateSources();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateSourceInput) =>
      api.patch<InventorySource>(`/v1/inventory/sources/${id}`, body),
    onSuccess: (source) => {
      invalidate(source.id);
    },
  });
}

export function useDeleteSource() {
  const invalidate = useInvalidateSources();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/v1/inventory/sources/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

/** Ask the server to pull (or reconcile) this source right now. Returns after
 *  the work is queued, not after it finishes — a feed can take a while. */
export function useSyncSource() {
  const invalidate = useInvalidateSources();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ queued: boolean; sourceId: string }>(`/v1/inventory/sources/${id}/sync`),
    onSuccess: (_result, id) => {
      invalidate(id);
    },
  });
}

/* ── Pairing an on-site bridge ────────────────────────────────────────────
 *
 * An "On-site bridge" (type `agent`) is a small program the business installs
 * on their own computers. It signs in with a key of its own that ONLY it holds.
 * Pairing mints that key on the server; the full key is handed back exactly ONCE
 * and never stored anywhere we can show again. Pairing a second time ROTATES it —
 * a fresh key is issued and the old one stops working — which is how you recover
 * from a key that leaked or a bridge that was reinstalled. Both are admin-only on
 * the server; a non-admin gets a 403 we surface as a plain message.
 */

/** What the server hands back from a pair/rotate. `apiKey` is the plaintext,
 *  shown once; `prefix` is the visible start that is safe to keep on screen. */
export interface EnrollResult {
  sourceId: string;
  apiKey: string;
  prefix: string;
  /** True when this replaced an existing key rather than pairing for the first
   *  time — the old key stopped working the moment this one was issued. */
  rotated: boolean;
}

export function useEnrollSource() {
  const invalidate = useInvalidateSources();
  return useMutation({
    mutationFn: (id: string) => api.post<EnrollResult>(`/v1/inventory/sources/${id}/enroll`),
    onSuccess: (result) => {
      // The source now carries a new prefix / enrolledAt, and its row in the
      // list changes state, so refresh both.
      invalidate(result.sourceId);
    },
  });
}

export function useRevokeAgent() {
  const invalidate = useInvalidateSources();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ sourceId: string; unpaired: boolean }>(`/v1/inventory/sources/${id}/revoke-agent`),
    onSuccess: (result) => {
      invalidate(result.sourceId);
    },
  });
}

/* ── Saying what a source is, in plain words ─────────────────────────────── */

export interface SourceState {
  label: string;
  tone: Tone;
}

/**
 * What a source's status means for the person, including the on-site bridge that
 * is "active" but hasn't checked in. A paused feed is a deliberate choice, not a
 * problem, so it reads neutral; a bridge gone quiet is amber because stock could
 * be drifting out of date without anyone touching anything.
 */
export function sourceState(source: InventorySource): SourceState {
  if (source.status === 'error') return { label: 'Having trouble', tone: 'danger' };
  if (source.status === 'paused') return { label: 'Paused', tone: 'neutral' };
  if (source.type === 'agent') {
    if (!source.enrolledAt) return { label: 'Waiting to be paired', tone: 'warning' };
    return agentOnline(source.agentLastSeenAt)
      ? { label: 'Online', tone: 'success' }
      : { label: 'Offline', tone: 'warning' };
  }
  return { label: 'Active', tone: 'success' };
}

/** How long we treat a silent bridge as still online. A Tier-A agent heartbeats
 *  well inside this, so crossing it means something is genuinely off. */
const AGENT_ONLINE_WINDOW_MS = 10 * 60 * 1000;

export function agentOnline(agentLastSeenAt: string | null): boolean {
  if (!agentLastSeenAt) return false;
  return Date.now() - new Date(agentLastSeenAt).getTime() < AGENT_ONLINE_WINDOW_MS;
}

/** The kind of connection, named for the person rather than the tier code. */
export function sourceTypeLabel(type: SourceType): string {
  switch (type) {
    case 'csv':
      return 'Spreadsheet file';
    case 'api':
      return 'Connected system';
    case 'agent':
      return 'On-site bridge';
  }
}

/** One line on how each kind works, so the choice on the create form is real. */
export function sourceTypeDescription(type: SourceType): string {
  switch (type) {
    case 'csv':
      return 'We fetch a stock spreadsheet you publish at a web address, on a schedule.';
    case 'api':
      return 'We pull stock levels from another system’s connection using its address and a key.';
    case 'agent':
      return 'A small program you install on your own computers sends stock to us — we never dial out to you.';
  }
}

/* ── How often we pull ───────────────────────────────────────────────────── */

export interface IntervalPreset {
  seconds: number;
  label: string;
}

export const SYNC_INTERVALS: IntervalPreset[] = [
  { seconds: 0, label: 'Only when I ask' },
  { seconds: 900, label: 'Every 15 minutes' },
  { seconds: 3600, label: 'Every hour' },
  { seconds: 21600, label: 'Every 6 hours' },
  { seconds: 86400, label: 'Once a day' },
];

/** The configured frequency in plain words — for showing an existing source. */
export function syncIntervalLabel(seconds: number): string {
  const preset = SYNC_INTERVALS.find((p) => p.seconds === seconds);
  if (preset) return preset.label;
  if (seconds <= 0) return 'Only when I ask';
  if (seconds % 3600 === 0) return `Every ${plural(seconds / 3600, 'hour', 'hours')}`;
  if (seconds % 60 === 0) return `Every ${plural(seconds / 60, 'minute', 'minutes')}`;
  return `Every ${plural(seconds, 'second', 'seconds')}`;
}

/* ── Relative time, in plain words ───────────────────────────────────────── */

/**
 * "3 hours ago" from an ISO time, for composing into a sentence. The list and
 * the health readout mostly use silica's <Timestamp> (which updates itself), but
 * a sentence like "last reached you 3 hours ago" needs the words inline.
 */
export function relativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const diffMs = Date.now() - new Date(iso).getTime();
  const seconds = Math.round(diffMs / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${plural(minutes, 'minute', 'minutes')} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${plural(hours, 'hour', 'hours')} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${plural(days, 'day', 'days')} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${plural(months, 'month', 'months')} ago`;
  return `${plural(Math.round(months / 12), 'year', 'years')} ago`;
}

/* ── Errors ──────────────────────────────────────────────────────────────── */

/** The server's own sentence for a 4xx — it names the exact problem ("A header
 *  name is required for header auth") far better than a status code can. */
export function sourceErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/* Local copy of the count-and-pluralise helper, so this module does not reach
 * into the stock list's data file for one function. */
function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}
