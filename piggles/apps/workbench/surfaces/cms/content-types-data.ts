'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE CONTENT-TYPE DATA LAYER
//
// Content types are the SCHEMA behind everything in the Content editor: a type's
// `schema_json.fields` is exactly what surfaces/cms/schema-form.tsx renders a
// form from. So this module and that one share one vocabulary of field types —
// the `FieldDef` union declared in ./data (a mirror of @sparx/cms-schemas, which
// validates every schema server-side). This file NEVER invents a field type or a
// config the editor cannot render; it authors the same shape the editor consumes.
//
// The wire is snake_case (see serializeContentType in @sparx/cms). We keep those
// names verbatim — `ContentType` here is that exact shape, re-used from ./data.
//
// Writing note: the create route (POST) takes the whole schema in one body under
// the key `schema`; editing an existing type is TWO calls — PATCH the meta, PUT
// the field schema — which is what `useSaveContentType` sequences. Built-in types
// are platform-owned and read-only: the surface never PATCHes/PUTs/DELETEs one.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import { api } from '../../lib/api/client';
// Read-only imports: the wire shape, the field vocabulary the editor renders, and
// the shared content key tree — so a type change here also refreshes the Content
// editor's "kind" picker, which reads contentKeys.types().
import { contentKeys, type ContentType, type FieldDef } from './data';

export type { ContentType, FieldDef } from './data';

/* ── The editable field draft ───────────────────────────────────────────────
 *
 * A `FieldDef` has no stable identity — its `key` is the identity, and the key
 * changes as someone types it. The builder needs a handle that survives an edit
 * AND a reorder, so a draft field carries a session-only `_uid` used ONLY as a
 * React key and drag id (never persisted). `object`/`repeater` recurse, so their
 * nested fields are drafts too. `fromDraftFields` strips the `_uid` and prunes
 * empty optionals back to the exact `FieldDef` the server validates. */

interface DraftBase {
  _uid: string;
  key: string;
  label: string;
  helpText?: string;
  required?: boolean;
}

export interface EnumOption {
  value: string;
  label: string;
}

export type DraftField =
  | (DraftBase & { type: 'text'; placeholder?: string; min?: number; max?: number })
  | (DraftBase & { type: 'long_text'; rows?: number; min?: number; max?: number })
  | (DraftBase & { type: 'rich_text' })
  | (DraftBase & { type: 'slug'; sourceField?: string; max?: number })
  | (DraftBase & { type: 'number'; min?: number; max?: number; integer?: boolean })
  | (DraftBase & { type: 'boolean'; default?: boolean })
  | (DraftBase & { type: 'date' })
  | (DraftBase & { type: 'datetime' })
  | (DraftBase & { type: 'enum'; options: EnumOption[]; multiple?: boolean })
  | (DraftBase & { type: 'url' })
  | (DraftBase & { type: 'email' })
  | (DraftBase & { type: 'reference'; to: string; multiple?: boolean; min?: number; max?: number })
  | (DraftBase & { type: 'asset'; accept?: string[]; multiple?: boolean })
  | (DraftBase & { type: 'object'; fields: DraftField[] })
  | (DraftBase & {
      type: 'repeater';
      itemLabel?: string;
      min?: number;
      max?: number;
      fields: DraftField[];
    });

export type FieldType = DraftField['type'];

/** Every field type this can author — the SAME set schema-form.tsx renders. Adding
 *  one here without a control there would produce a schema the editor can't show. */
export const FIELD_TYPES: FieldType[] = [
  'text',
  'long_text',
  'rich_text',
  'slug',
  'number',
  'boolean',
  'date',
  'datetime',
  'enum',
  'url',
  'email',
  'reference',
  'asset',
  'object',
  'repeater',
];

// Session-only. Not persisted, not a wire value — a plain counter is honest here.
let uidCounter = 0;
function uid(): string {
  uidCounter += 1;
  return `f${String(uidCounter)}`;
}

/** A fresh field of a type, with the minimum its shape requires (an enum needs an
 *  option; a group needs somewhere to add fields). */
export function blankField(type: FieldType): DraftField {
  const base = { _uid: uid(), key: '', label: '' };
  switch (type) {
    case 'enum':
      return { ...base, type, options: [{ value: '', label: '' }] };
    case 'reference':
      return { ...base, type, to: '' };
    case 'object':
      return { ...base, type, fields: [] };
    case 'repeater':
      return { ...base, type, fields: [] };
    default:
      return { ...base, type };
  }
}

/* ── Draft ⇄ wire ───────────────────────────────────────────────────────── */

export function toDraftFields(fields: FieldDef[]): DraftField[] {
  return fields.map(toDraftField);
}

function toDraftField(field: FieldDef): DraftField {
  const base = {
    _uid: uid(),
    key: field.key,
    label: field.label,
    ...(field.helpText !== undefined ? { helpText: field.helpText } : {}),
    ...(field.required !== undefined ? { required: field.required } : {}),
  };
  if (field.type === 'object') {
    return { ...base, type: 'object', fields: toDraftFields(field.fields) };
  }
  if (field.type === 'repeater') {
    return {
      ...base,
      type: 'repeater',
      ...(field.itemLabel !== undefined ? { itemLabel: field.itemLabel } : {}),
      ...(field.min !== undefined ? { min: field.min } : {}),
      ...(field.max !== undefined ? { max: field.max } : {}),
      fields: toDraftFields(field.fields),
    };
  }
  // Every scalar/leaf: the config keys are already the shape the draft wants, so
  // carry them across verbatim on top of the fresh _uid.
  const { key: _k, label: _l, helpText: _h, required: _r, ...rest } = field;
  void _k;
  void _l;
  void _h;
  void _r;
  return { ...base, ...rest };
}

function optNum(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
function optStr(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed;
}
function spreadDefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as Partial<T>;
}

/** Draft → the `FieldDef[]` the server validates: `_uid` gone, blanks pruned. */
export function fromDraftFields(fields: DraftField[]): FieldDef[] {
  return fields.map(fromDraftField);
}

function fromDraftField(field: DraftField): FieldDef {
  const base = {
    key: field.key.trim(),
    label: field.label.trim(),
    ...spreadDefined({ helpText: optStr(field.helpText) }),
    ...(field.required ? { required: true } : {}),
  };
  switch (field.type) {
    case 'text':
      return {
        ...base,
        type: 'text',
        ...spreadDefined({
          placeholder: optStr(field.placeholder),
          min: optNum(field.min),
          max: optNum(field.max),
        }),
      };
    case 'long_text':
      return {
        ...base,
        type: 'long_text',
        ...spreadDefined({
          rows: optNum(field.rows),
          min: optNum(field.min),
          max: optNum(field.max),
        }),
      };
    case 'rich_text':
      return { ...base, type: 'rich_text' };
    case 'slug':
      return {
        ...base,
        type: 'slug',
        ...spreadDefined({ sourceField: optStr(field.sourceField), max: optNum(field.max) }),
      };
    case 'number':
      return {
        ...base,
        type: 'number',
        ...spreadDefined({ min: optNum(field.min), max: optNum(field.max) }),
        ...(field.integer ? { integer: true } : {}),
      };
    case 'boolean':
      return { ...base, type: 'boolean', ...(field.default ? { default: true } : {}) };
    case 'date':
      return { ...base, type: 'date' };
    case 'datetime':
      return { ...base, type: 'datetime' };
    case 'enum':
      return {
        ...base,
        type: 'enum',
        options: field.options.map((o) => ({ value: o.value.trim(), label: o.label.trim() })),
        ...(field.multiple ? { multiple: true } : {}),
      };
    case 'url':
      return { ...base, type: 'url' };
    case 'email':
      return { ...base, type: 'email' };
    case 'reference':
      return {
        ...base,
        type: 'reference',
        to: field.to.trim(),
        ...(field.multiple ? { multiple: true } : {}),
        ...spreadDefined({ min: optNum(field.min), max: optNum(field.max) }),
      };
    case 'asset':
      return {
        ...base,
        type: 'asset',
        ...spreadDefined({
          accept: field.accept && field.accept.length > 0 ? field.accept : undefined,
        }),
        ...(field.multiple ? { multiple: true } : {}),
      };
    case 'object':
      return { ...base, type: 'object', fields: fromDraftFields(field.fields) };
    case 'repeater':
      return {
        ...base,
        type: 'repeater',
        ...spreadDefined({ itemLabel: optStr(field.itemLabel) }),
        ...spreadDefined({ min: optNum(field.min), max: optNum(field.max) }),
        fields: fromDraftFields(field.fields),
      };
  }
}

/* ── Client-side schema validity ─────────────────────────────────────────────
 *
 * Enough to keep Save honest and to point at the first real problem BEFORE the
 * round-trip — the server is still the authority and its 422 sentence is shown
 * verbatim. Returns the first problem in plain words, or null when it is fit to
 * send. */

const FIELD_KEY_RE = /^[a-z][a-zA-Z0-9_]*$/;

export function validateFields(fields: DraftField[], where = 'this type'): string | null {
  if (fields.length === 0) {
    return `Add at least one field to ${where}.`;
  }
  const seen = new Set<string>();
  for (const field of fields) {
    const label = field.label.trim();
    const key = field.key.trim();
    const named = label || 'a field';
    if (label === '') return 'Every field needs a name.';
    if (key === '') return `Give “${named}” a short id.`;
    if (!FIELD_KEY_RE.test(key)) {
      return `The id for “${named}” must start with a lowercase letter and use only letters, numbers and underscores.`;
    }
    if (seen.has(key)) return `Two fields in ${where} share the id “${key}”. Ids must be unique.`;
    seen.add(key);

    if (field.type === 'enum') {
      if (field.options.length === 0) return `“${named}” needs at least one choice.`;
      for (const option of field.options) {
        if (option.value.trim() === '' || option.label.trim() === '') {
          return `Every choice in “${named}” needs both a value and a label.`;
        }
      }
    }
    if (field.type === 'reference' && field.to.trim() === '') {
      return `Choose what “${named}” links to.`;
    }
    if (field.type === 'object' || field.type === 'repeater') {
      const nested = validateFields(field.fields, `“${named}”`);
      if (nested) return nested;
    }
  }
  return null;
}

/* ── Key derivation ─────────────────────────────────────────────────────────
 *
 * A type key is snake_case (`[a-z][a-z0-9_]*`); a field key is camelCase
 * (`[a-z][a-zA-Z0-9_]*`). We seed them from the human name so the person never
 * has to think about ids — they stay editable, but a sensible one is filled in. */

export function toTypeKey(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^[0-9]+/, '');
  return cleaned;
}

export function toFieldKey(label: string): string {
  const words = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '';
  const [first, ...rest] = words;
  const camel = (first ?? '') + rest.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  return camel.replace(/^[0-9]+/, '');
}

/* ── The query-key tree ─────────────────────────────────────────────────── */

export const contentTypeKeys = {
  all: ['cms', 'content-types'] as const,
  list: () => [...contentTypeKeys.all, 'list'] as const,
  detail: (key: string) => [...contentTypeKeys.all, 'detail', key] as const,
  counts: () => [...contentTypeKeys.all, 'counts'] as const,
};

/* ── Reads ──────────────────────────────────────────────────────────────── */

/** Every content type — built-ins plus this business's own. A small, bounded set
 *  (built-ins plus a handful of custom types), so the whole list loads at once and
 *  the surface searches/filters it in the browser. */
export function useContentTypeList() {
  return useQuery({
    queryKey: contentTypeKeys.list(),
    queryFn: () => api.list<ContentType>('/v1/content/types', { take: 250 }).then((r) => r.items),
  });
}

export function useContentType(key: string) {
  return useQuery({
    queryKey: contentTypeKeys.detail(key),
    queryFn: () => api.get<ContentType>(`/v1/content/types/${key}`),
    enabled: key !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

interface SummaryResponse {
  byType: { typeKey: string; name: string; count: number; publishedCount: number }[];
}

/** How many entries use each type, keyed by type key — for the "in use" column and
 *  the delete warning. A live aggregate from the CMS reports endpoint; a missing
 *  key means zero. Bounded and slow-changing, so it is cached for a minute. */
export function useEntryCountsByType() {
  return useQuery({
    queryKey: contentTypeKeys.counts(),
    queryFn: () => api.get<SummaryResponse>('/v1/content/reports/summary'),
    staleTime: 60_000,
    select: (data) => {
      const map = new Map<string, number>();
      for (const row of data.byType) map.set(row.typeKey, row.count);
      return map;
    },
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

function useInvalidateTypes() {
  const queryClient = useQueryClient();
  return (key?: string) => {
    void queryClient.invalidateQueries({ queryKey: contentTypeKeys.list() });
    void queryClient.invalidateQueries({ queryKey: contentTypeKeys.counts() });
    // The Content editor's "kind" picker reads the shared content key tree — keep
    // it in step so a newly-defined type is writable immediately.
    void queryClient.invalidateQueries({ queryKey: contentKeys.types() });
    if (key) void queryClient.invalidateQueries({ queryKey: contentTypeKeys.detail(key) });
  };
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

/** The type's meta, wire-shaped. `null` clears an optional; `undefined` leaves it. */
export interface TypeMetaInput {
  name: string;
  plural_name: string;
  description?: string | null;
  icon?: string | null;
  url_pattern?: string | null;
  is_singleton?: boolean;
}

export interface CreateTypeInput extends TypeMetaInput {
  key: string;
  schema: { fields: FieldDef[] };
}

export function useCreateContentType() {
  const invalidate = useInvalidateTypes();
  return useMutation({
    mutationFn: (input: CreateTypeInput) => api.post<ContentType>('/v1/content/types', input),
    onSuccess: (type) => {
      invalidate(type.key);
    },
  });
}

/** Save an existing CUSTOM type: PATCH the meta, then PUT the field schema. Two
 *  calls because the schema has its own authoring route (the docs/51 keystone);
 *  sequenced so a schema rejection can't leave the meta half-written the other
 *  way round. Returns the type as the schema route serialises it. */
export function useSaveContentType(key: string) {
  const invalidate = useInvalidateTypes();
  return useMutation({
    mutationFn: async (input: { meta: TypeMetaInput; schema: { fields: FieldDef[] } }) => {
      await api.patch<ContentType>(`/v1/content/types/${key}`, input.meta);
      return api.put<ContentType>(`/v1/content/types/${key}/schema`, { schema: input.schema });
    },
    onSuccess: () => {
      invalidate(key);
    },
  });
}

export function useDeleteContentType(key: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`/v1/content/types/${key}`),
    onSuccess: () => {
      // Only the list + counts are refreshed — the detail query is left to
      // garbage-collect when the pane unmounts, so a refetch of the just-deleted
      // key can't 404 into this pane mid-close (see useDeleteEntry in ./data).
      void queryClient.invalidateQueries({ queryKey: contentTypeKeys.list() });
      void queryClient.invalidateQueries({ queryKey: contentTypeKeys.counts() });
      void queryClient.invalidateQueries({ queryKey: contentKeys.types() });
    },
  });
}
