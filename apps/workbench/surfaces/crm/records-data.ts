'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE CUSTOM-RECORD DATA LAYER (docs/144 §3.6)
//
// The rows of an object a TENANT invented — "Property listing", "Service
// contract", "Vessel". One data layer for all of them, because the platform
// cannot know their names at build time: the object key is a parameter, not a
// type.
//
// A record's fields are entirely its object's property schema (unlike a contact
// or a deal, which have a fixed spine with properties added on top). So the
// object definition is not decoration here — it is the only thing that says what
// a row IS, which is why every hook below is keyed by it.
//
//   ['crm','records', objectKey]           the root for one object's rows
//   ['crm','records', objectKey,'list',{}] one list window
//   ['crm','records','row', id]            one row
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import { api } from '../../lib/api/client';

/** One row of a tenant-invented object. `values` is the whole record. */
export interface CrmRecord {
  id: string;
  objectKey: string;
  propertyId: string | null;
  values: Record<string, unknown>;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecordListParams {
  q?: string;
}

export const recordKeys = {
  forObject: (objectKey: string) => ['crm', 'records', objectKey] as const,
  list: (objectKey: string, params: RecordListParams) =>
    ['crm', 'records', objectKey, 'list', params] as const,
  detail: (id: string) => ['crm', 'records', 'row', id] as const,
};

export function useRecords(objectKey: string, params: RecordListParams = {}) {
  return useQuery({
    queryKey: recordKeys.list(objectKey, params),
    queryFn: () =>
      api.list<CrmRecord>(`/v1/crm/objects/${objectKey}/records`, {
        ...(params.q?.trim() ? { q: params.q.trim() } : {}),
        take: 100,
      }),
    enabled: objectKey !== '',
    placeholderData: (previous) => previous,
  });
}

export function useRecord(id: string) {
  return useQuery({
    queryKey: recordKeys.detail(id),
    queryFn: () => api.get<CrmRecord>(`/v1/crm/records/${id}`),
    enabled: id !== '' && id !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

export function useRecordMutations(objectKey: string) {
  const queryClient = useQueryClient();
  const invalidate = (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: recordKeys.forObject(objectKey) });
    if (id) void queryClient.invalidateQueries({ queryKey: recordKeys.detail(id) });
    // A custom record can be on either end of a relationship, and the panel that
    // shows those reads a different root.
    void queryClient.invalidateQueries({ queryKey: ['crm', 'associations'] });
  };
  return {
    create: useMutation({
      mutationFn: (values: Record<string, unknown>) =>
        api.post<CrmRecord>(`/v1/crm/objects/${objectKey}/records`, { values }),
      onSuccess: (created) => {
        invalidate(created.id);
      },
    }),
    update: useMutation({
      mutationFn: ({ id, values }: { id: string; values: Record<string, unknown> }) =>
        api.patch<CrmRecord>(`/v1/crm/records/${id}`, { values }),
      onSuccess: (saved) => {
        invalidate(saved.id);
      },
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/v1/crm/records/${id}`),
      onSuccess: () => {
        invalidate();
      },
    }),
  };
}

/**
 * What to call one row on screen.
 *
 * The object's `primaryFieldKey` is the business's own answer — they nominated
 * which property is the title. Falling back to the first non-empty string in the
 * bag is deliberate: a record with no title is worse than a slightly wrong one,
 * because a list of "Untitled" is a list nobody can use.
 */
export function recordTitle(
  record: Pick<CrmRecord, 'values'>,
  primaryFieldKey: string | null
): string {
  const values = record.values;
  if (primaryFieldKey) {
    const primary = values[primaryFieldKey];
    if (typeof primary === 'string' && primary.trim()) return primary.trim();
    if (typeof primary === 'number') return String(primary);
  }
  for (const value of Object.values(values)) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return 'Untitled';
}

/** A cell value as text. Deliberately plain — the LIST is a scan, and a list
 *  that renders every field type properly is a detail pane in a table. */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return `${value.length} items`;
  return '—';
}

export function recordErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return error.message;
  return fallback;
}
