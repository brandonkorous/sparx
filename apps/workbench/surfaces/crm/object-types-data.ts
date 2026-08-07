'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE RECORD-TYPE DATA LAYER
//
// What a record IS, for this business: the four sparx ships (customer, company,
// deal, request) plus anything they invented, and for each one the extra details
// they track on it.
//
// The field vocabulary is NOT redeclared here. It is the same `FieldDef` shape
// the CMS content-type editor already speaks — one field engine across content,
// products and CRM (docs/144 §3) — so the types are structurally identical and a
// renderer written for one reads the other.
//
//   ['crm','objects']              root
//   ['crm','objects','list',{…}]   the type list
//   ['crm','objects', key]         one type with its property schema
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import { api } from '../../lib/api/client';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

/** One typed field. Mirrors `FieldDef` in @sparx/field-schema. */
export interface PropertyField {
  key: string;
  label: string;
  type: PropertyFieldType;
  helpText?: string;
  required?: boolean;
  // Per-type extras — present only on the types that use them.
  options?: { value: string; label: string }[];
  multiple?: boolean;
  min?: number;
  max?: number;
  rows?: number;
  integer?: boolean;
  currency?: string;
  expression?: string;
  resultType?: 'number' | 'currency';
  precision?: number;
  fields?: PropertyField[];
  itemLabel?: string;
  to?: string;
  accept?: string[];
  placeholder?: string;
  pattern?: string;
  sourceField?: string;
  default?: unknown;
}

export type PropertyFieldType =
  | 'text'
  | 'long_text'
  | 'rich_text'
  | 'slug'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'enum'
  | 'url'
  | 'email'
  | 'reference'
  | 'asset'
  | 'currency'
  | 'user'
  | 'calculated'
  | 'object'
  | 'repeater';

export interface PropertySchema {
  fields: PropertyField[];
}

export interface CrmObjectType {
  id: string;
  key: string;
  kind: 'builtin' | 'custom';
  label: string;
  labelPlural: string;
  iconKey: string | null;
  description: string | null;
  propertySchema: PropertySchema;
  primaryFieldKey: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CrmRecordRow {
  id: string;
  objectKey: string;
  propertyId: string | null;
  ownerId: string | null;
  title: string | null;
  values: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export const objectTypeKeys = {
  all: ['crm', 'objects'] as const,
  list: (params: { kind?: string; includeArchived?: boolean }) =>
    [...objectTypeKeys.all, 'list', params] as const,
  detail: (key: string) => [...objectTypeKeys.all, key] as const,
  records: (objectKey: string, params: Record<string, unknown>) =>
    [...objectTypeKeys.all, objectKey, 'records', params] as const,
};

/* ── Presentation ───────────────────────────────────────────────────────── */

/**
 * What each field type is called, in the words of someone who has never heard
 * the word "schema". These strings are the whole difference between a property
 * editor a business owner can use and one only a developer can.
 */
export const FIELD_TYPE_LABELS: Record<PropertyFieldType, string> = {
  text: 'Short text',
  long_text: 'Long text',
  rich_text: 'Formatted text',
  slug: 'Web address piece',
  number: 'Number',
  boolean: 'Yes or no',
  date: 'Date',
  datetime: 'Date and time',
  enum: 'Pick from a list',
  url: 'Link',
  email: 'Email address',
  reference: 'Another record',
  asset: 'File or image',
  currency: 'Money',
  user: 'Someone on your team',
  calculated: 'Worked out for you',
  object: 'A group of details',
  repeater: 'A repeating list',
};

export const FIELD_TYPE_HINTS: Record<PropertyFieldType, string> = {
  text: 'A single line — a reference number, a nickname.',
  long_text: 'A paragraph or two of plain notes.',
  rich_text: 'Notes with bold, links and lists.',
  slug: 'Lowercase, dashes instead of spaces.',
  number: 'A quantity, a count, a rating.',
  boolean: 'A simple yes-or-no switch.',
  date: 'A day, with no time of day.',
  datetime: 'A day and a time.',
  enum: 'A fixed set of choices you write.',
  url: 'A web address.',
  email: 'An email address.',
  reference: 'Points at another record you keep.',
  asset: 'An uploaded file or picture.',
  currency: 'An amount, with its currency.',
  user: 'One of the people on your team.',
  calculated: 'A number worked out from the other details — you never type it.',
  object: 'Several related details kept together.',
  repeater: 'The same set of details, as many times as needed.',
};

/** The types worth offering first. The rest are real but rarely what someone wants. */
export const COMMON_FIELD_TYPES: PropertyFieldType[] = [
  'text',
  'long_text',
  'number',
  'currency',
  'boolean',
  'date',
  'enum',
  'user',
  'email',
  'url',
];

export const ADVANCED_FIELD_TYPES: PropertyFieldType[] = [
  'datetime',
  'rich_text',
  'asset',
  'reference',
  'calculated',
  'object',
  'repeater',
  'slug',
];

/** A camelCase key from a human label — "Warranty expires" → "warrantyExpires". */
export function keyFromLabel(label: string): string {
  const words = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '';
  const [first, ...rest] = words;
  const key = first! + rest.map((w) => w[0]!.toUpperCase() + w.slice(1)).join('');
  // Must start with a letter — "2ndContact" is not a valid key.
  return /^[a-z]/.test(key) ? key.slice(0, 63) : `f${key}`.slice(0, 63);
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export function useObjectTypes(
  params: { kind?: 'builtin' | 'custom'; includeArchived?: boolean } = {}
) {
  return useQuery({
    queryKey: objectTypeKeys.list(params),
    queryFn: () =>
      api.list<CrmObjectType>('/v1/crm/objects', {
        ...(params.kind ? { kind: params.kind } : {}),
        ...(params.includeArchived ? { include_archived: true } : {}),
      }),
    placeholderData: (previous) => previous,
  });
}

export function useObjectType(key: string) {
  return useQuery({
    queryKey: objectTypeKeys.detail(key),
    queryFn: () => api.get<CrmObjectType>(`/v1/crm/objects/${key}`),
    enabled: key !== '' && key !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/**
 * The property schema for ONE object, for the panels that render a record's
 * extra details. Cached under the same key as the full type, so a detail pane
 * and the property editor share one fetch.
 */
export function usePropertySchema(objectKey: string): PropertyField[] {
  const { data } = useObjectType(objectKey);
  return data?.propertySchema?.fields ?? [];
}

export function useCrmRecords(
  objectKey: string,
  params: { q?: string; take?: number; skip?: number } = {}
) {
  return useQuery({
    queryKey: objectTypeKeys.records(objectKey, params),
    queryFn: () =>
      api.list<CrmRecordRow>(`/v1/crm/objects/${objectKey}/records`, {
        ...(params.q?.trim() ? { q: params.q.trim() } : {}),
        take: params.take ?? 50,
        ...(params.skip ? { skip: params.skip } : {}),
      }),
    enabled: objectKey !== '',
    placeholderData: (previous) => previous,
  });
}

export function useCrmRecord(recordId: string) {
  return useQuery({
    queryKey: [...objectTypeKeys.all, 'record', recordId] as const,
    queryFn: () => api.get<CrmRecordRow>(`/v1/crm/records/${recordId}`),
    enabled: recordId !== '' && recordId !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

export function useInvalidateObjectTypes() {
  const queryClient = useQueryClient();
  return (key?: string) => {
    void queryClient.invalidateQueries({ queryKey: objectTypeKeys.all });
    if (key) void queryClient.invalidateQueries({ queryKey: objectTypeKeys.detail(key) });
    // A schema change alters what every record detail pane renders, so the
    // records themselves are stale too.
    void queryClient.invalidateQueries({ queryKey: ['crm', 'customers'] });
    void queryClient.invalidateQueries({ queryKey: ['crm', 'deals'] });
    void queryClient.invalidateQueries({ queryKey: ['crm', 'accounts'] });
  };
}

/* ── Mutations ──────────────────────────────────────────────────────────── */

export interface ObjectTypeInput {
  key?: string;
  label: string;
  labelPlural: string;
  iconKey?: string | null;
  description?: string | null;
  propertySchema?: PropertySchema;
  primaryFieldKey?: string | null;
}

export function useCreateObjectType() {
  const invalidate = useInvalidateObjectTypes();
  return useMutation({
    mutationFn: (input: ObjectTypeInput) => api.post<CrmObjectType>('/v1/crm/objects', input),
    onSuccess: (created) => {
      invalidate(created.key);
    },
  });
}

export function useUpdateObjectType(key: string) {
  const invalidate = useInvalidateObjectTypes();
  return useMutation({
    mutationFn: (patch: Partial<ObjectTypeInput>) =>
      api.patch<CrmObjectType>(`/v1/crm/objects/${key}`, patch),
    onSuccess: () => {
      invalidate(key);
    },
  });
}

export function useArchiveObjectType(key: string) {
  const invalidate = useInvalidateObjectTypes();
  return useMutation({
    mutationFn: () => api.delete(`/v1/crm/objects/${key}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useCreateCrmRecord(objectKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { values: Record<string, unknown>; ownerId?: string | null }) =>
      api.post<CrmRecordRow>(`/v1/crm/objects/${objectKey}/records`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: objectTypeKeys.all });
    },
  });
}

export function useUpdateCrmRecord(recordId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: { values?: Record<string, unknown>; ownerId?: string | null }) =>
      api.patch<CrmRecordRow>(`/v1/crm/records/${recordId}`, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: objectTypeKeys.all });
    },
  });
}

export function useDeleteCrmRecord(recordId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`/v1/crm/records/${recordId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: objectTypeKeys.all });
    },
  });
}

export function objectTypeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}

/**
 * CRM switched off, as opposed to anything else that can go wrong. The two need
 * different words: one is a thing to turn on, the other is a thing to retry.
 */
export function isModuleDisabled(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'MODULE_DISABLED';
}
