'use client';

// ══════════════════════════════════════════════════════════════════════════
// LOCATIONS DATA LAYER
//
// A location is a place stock is kept — a warehouse, a shop floor, a van. The
// server calls these "warehouses"; "location" is the word an owner uses, so it
// is the word this whole surface uses. Every read and write behind the Locations
// list and the create-and-edit pane lives here: no surface declares a query key,
// a fetch or a row type of its own.
//
//   GET    /v1/inventory/locations            list, with search / kind / closed
//   POST   /v1/inventory/locations            create
//   GET    /v1/inventory/locations/:id         one
//   PATCH  /v1/inventory/locations/:id         edit
//   DELETE /v1/inventory/locations/:id         archive (soft-delete)
//
// ── Two caches onto the same rows, kept in step ──────────────────────────
//
// The Stock surfaces read a FULL, unpaged picker list under the key
// `['inventory','locations']` (see surfaces/inventory/data.ts → useStockLocations).
// This surface reads its own filtered, paged windows under `locationKeys`. They
// are two questions over the same rows, so every write here invalidates BOTH —
// otherwise a location renamed on this pane would still read by its old name in
// the Stock item pane docked next to it, with no sign which is true.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { api } from '../../lib/api/client';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

/**
 * One place stock is kept, in full.
 *
 * The list endpoint returns this whole row (not the narrower `StockLocation` the
 * picker uses), so the list can show a location's address and kind without a
 * second read, and the edit pane can hydrate straight from the list cache.
 */
export interface Location {
  id: string;
  name: string;
  /** The short code printed on shelf labels and paperwork. Unique per business. */
  code: string;
  /** `owned` | `3pl` | `dropship` | `virtual`. See `locationTypeLabel`. */
  type: string;
  line1: string | null;
  line2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  defaultForChannel: string[];
  /** Whether this location is currently in use. A closed location keeps its
   *  history but takes no new stock. Distinct from archiving, which removes it. */
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ── Query keys ─────────────────────────────────────────────────────────── */

export interface LocationsQuery {
  q?: string;
  /** Narrow to one kind of place. Undefined means every kind. */
  type?: string;
  /** Include locations that have been switched off. Off by default. */
  includeClosed: boolean;
  take: number;
  skip: number;
}

export const locationKeys = {
  all: ['inventory', 'locations-admin'] as const,
  list: (query: LocationsQuery) => [...locationKeys.all, 'list', query] as const,
  one: (id: string) => [...locationKeys.all, 'one', id] as const,
};

/** The FULL picker list the Stock surfaces read (surfaces/inventory/data.ts →
 *  `stockKeys.locations()`). Spelled identically on purpose so a write here can
 *  refresh it — the two caches describe the same rows. */
const SHARED_PICKER_KEY = ['inventory', 'locations'] as const;

/* ── Reads ──────────────────────────────────────────────────────────────── */

/**
 * One window of the locations list.
 *
 * Every narrowing — the search, the kind, and "show closed" — is a SERVER
 * filter, so a page of results is always the answer to the whole question and
 * never fifty rows sieved in the browser.
 */
export function useLocations(query: LocationsQuery) {
  return useQuery({
    queryKey: locationKeys.list(query),
    queryFn: () =>
      api.list<Location>('/v1/inventory/locations', {
        ...(query.q ? { q: query.q } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.includeClosed ? { include_archived: true } : {}),
        take: query.take,
        skip: query.skip,
      }),
    // Keep the current window on screen while the next one loads, so paging and
    // filtering don't blink the list out to empty and back.
    placeholderData: (previous) => previous,
  });
}

/** One location, for the edit pane. Not fetched for a brand-new one. */
export function useLocation(id: string) {
  return useQuery({
    queryKey: locationKeys.one(id),
    queryFn: () => api.get<Location>(`/v1/inventory/locations/${id}`),
    enabled: id !== 'new',
    // A 404 means the location is gone — an answer, not a fault worth retrying.
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

function useInvalidateLocations() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: locationKeys.all });
    // Refresh the Stock surfaces' location picker too — same rows, other cache.
    void queryClient.invalidateQueries({ queryKey: SHARED_PICKER_KEY });
    if (id) void queryClient.invalidateQueries({ queryKey: locationKeys.one(id) });
  };
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

/** The address a location keeps. Optional parts are omitted when blank rather
 *  than sent as empty strings, so the server stores a real null. */
export interface LocationAddressInput {
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode?: string;
  country: string;
  phone?: string;
}

export interface CreateLocationInput {
  name: string;
  code: string;
  type: string;
  address: LocationAddressInput;
  isActive: boolean;
}

export function useCreateLocation() {
  const invalidate = useInvalidateLocations();
  return useMutation({
    mutationFn: (input: CreateLocationInput) =>
      api.post<{ id: string }>('/v1/inventory/locations', input),
    onSuccess: (result) => {
      invalidate(result.id);
    },
  });
}

/** A patch: only the fields that actually changed. `address` is sent whole or
 *  not at all — the server treats a present address as a full replacement. */
export interface UpdateLocationInput {
  name?: string;
  code?: string;
  type?: string;
  address?: LocationAddressInput;
  isActive?: boolean;
}

export function useUpdateLocation(id: string) {
  const invalidate = useInvalidateLocations();
  return useMutation({
    mutationFn: (input: UpdateLocationInput) =>
      api.patch<Location>(`/v1/inventory/locations/${id}`, input),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

/** Archive a location. The server refuses while it still holds stock and says
 *  so in a sentence worth showing verbatim — see `locationErrorMessage`. */
export function useArchiveLocation(id: string) {
  const invalidate = useInvalidateLocations();
  return useMutation({
    mutationFn: () => api.delete(`/v1/inventory/locations/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

/* ── Saying what a location is, in plain words ──────────────────────────── */

export type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

/** The kinds of place, in the order they are offered. The stored value is the
 *  engineer's (`3pl`, `virtual`); the label and hint are the shop's. */
export const LOCATION_TYPES = [
  {
    value: 'owned',
    label: 'Your own place',
    hint: 'A warehouse, shop or unit you run yourself.',
  },
  {
    value: '3pl',
    label: 'Run by a partner',
    hint: 'A fulfilment company stores your stock and ships it for you.',
  },
  {
    value: 'dropship',
    label: 'Shipped by a supplier',
    hint: 'Stock you never hold — a supplier ships each order straight to the customer.',
  },
  {
    value: 'virtual',
    label: 'On paper only',
    hint: 'Not a real building — a holding place for stock in transit or counted elsewhere.',
  },
] as const;

const TYPE_LABEL = new Map<string, string>(LOCATION_TYPES.map((t) => [t.value, t.label]));
const TYPE_HINT = new Map<string, string>(LOCATION_TYPES.map((t) => [t.value, t.hint]));

/** A location's kind as a short label, for a badge or a select. */
export function locationTypeLabel(type: string): string {
  return TYPE_LABEL.get(type) ?? 'Location';
}

/** A one-line explanation of a kind, for a field description. */
export function locationTypeHint(type: string): string {
  return TYPE_HINT.get(type) ?? '';
}

export interface LocationState {
  label: string;
  tone: Tone;
}

/** Whether a location is in use, as a state with its own color. */
export function locationState(location: { isActive: boolean }): LocationState {
  return location.isActive
    ? { label: 'In use', tone: 'success' }
    : { label: 'Closed', tone: 'warning' };
}

/** The town-and-country line for a location, or null when it has no address —
 *  which a virtual or freshly-seeded location legitimately does not. */
export function locationPlace(
  location: Pick<Location, 'city' | 'region' | 'country'>
): string | null {
  const parts = [location.city, location.region, location.country].filter((part): part is string =>
    Boolean(part?.trim())
  );
  return parts.length > 0 ? parts.join(', ') : null;
}

/* ── Errors ─────────────────────────────────────────────────────────────── */

/**
 * The server's own sentence for a 4xx, shown verbatim: these routes name the
 * exact problem ("Warehouse code "MAIN" is already in use", "Cannot archive a
 * warehouse that still holds stock…") far better than anything this side could
 * infer from a status code. A 5xx carries no such sentence, so it falls back to
 * the caller's wording.
 */
export function locationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}

/** The field a conflict was about, when the server named one — used to put the
 *  "already in use" message under the code box rather than in a banner. */
export function conflictField(error: unknown): string | null {
  if (
    error instanceof ApiError &&
    error.code === 'CONFLICT' &&
    error.details !== null &&
    typeof error.details === 'object' &&
    'field' in error.details
  ) {
    const field = (error.details as { field?: unknown }).field;
    return typeof field === 'string' ? field : null;
  }
  return null;
}

/** True when the location behind the edit pane no longer exists. */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
