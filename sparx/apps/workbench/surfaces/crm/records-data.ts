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

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { apiErrorMessage } from '../../lib/api-error';
import { api } from '../../lib/api/client';
import type { PropertyField } from './object-types-data';

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

/**
 * A cell value as text.
 *
 * IT NEEDS THE FIELD, not just the value. Half the field types do not store a
 * scalar — money is `{amount, currency}`, a choice stores the option's value
 * rather than its label, a date stores an ISO string — so a formatter that sees
 * only the value cannot tell "not filled in" from "filled in with a shape I do
 * not recognise". It printed an em dash for both, which meant a course priced at
 * $95 showed a blank Price column: the list said the business had not entered
 * something it plainly had.
 *
 * Still deliberately plain — one line, no markup. The list is a scan; a cell
 * that renders every type properly is a detail pane wearing a table.
 */
export function cellText(value: unknown, field?: PropertyField): string {
  if (value === null || value === undefined || value === '') return '—';

  switch (field?.type) {
    case 'currency': {
      const money = value as { amount?: unknown; currency?: unknown };
      if (typeof money.amount !== 'number') return '—';
      const code = typeof money.currency === 'string' ? money.currency : (field.currency ?? 'USD');
      return formatMoney(money.amount, code);
    }
    case 'calculated':
      // Worked out on the server, and the answer is a number OR money depending
      // on how the business set it up.
      if (typeof value === 'number') return value.toLocaleString();
      return cellText(value, { ...field, type: 'currency' });
    case 'enum': {
      // The bag stores the option's value; a person picked its LABEL.
      const options = field.options ?? [];
      const label = (v: unknown) => options.find((o) => o.value === v)?.label ?? String(v);
      return Array.isArray(value) ? value.map(label).join(', ') : label(value);
    }
    case 'date':
      return formatDay(value);
    case 'datetime':
      return formatMoment(value);
    case 'user':
    case 'reference':
    case 'asset':
      // A uuid in a column is noise, and resolving names here would make the
      // list wait on a second request per column. Say that it is set; the record
      // itself shows who or what.
      return Array.isArray(value) ? `${String(value.length)} linked` : 'Linked';
    case 'object':
      return 'Set';
    default:
      break;
  }

  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return `${String(value.length)} items`;
  return '—';
}

/** Money in the currency the VALUE carries, not the one this browser prefers —
 *  a business selling in two currencies must not see them rendered alike. */
function formatMoney(amount: number, code: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(amount);
  } catch {
    // An unknown code is a data problem, not a reason to show nothing.
    return `${code} ${amount.toLocaleString()}`;
  }
}

/**
 * A calendar DAY, formatted without ever becoming an instant.
 *
 * `new Date('2026-09-15')` is UTC midnight, so anywhere west of Greenwich it
 * formats as the 14th — a course starting on the 15th listed as starting the day
 * before. A date field has no time and no timezone; it is three numbers, and the
 * only safe thing to do with them is read them.
 */
function formatDay(value: unknown): string {
  if (typeof value !== 'string') return '—';
  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!parts) return value;
  const [, year, month, day] = parts;
  return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString();
}

/** A datetime IS an instant, so it converts to the reader's own clock. */
function formatMoment(value: unknown): string {
  if (typeof value !== 'string') return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export function recordErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}
