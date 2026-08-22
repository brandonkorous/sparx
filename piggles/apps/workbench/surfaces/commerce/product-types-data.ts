'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE PRODUCT-TYPE DATA LAYER (docs/143)
//
// Product types are the commerce mirror of CMS content types: a type declares an
// `attributeSchema.fields` list, and every product of that type fills + validates
// against it. So this module and surfaces/commerce/product-attributes.tsx share
// ONE vocabulary of field kinds — the `FieldDef` union below, a mirror of
// @wizeworks/field-schema (the SAME engine the CMS content types use, validated
// server-side). This file never invents a field kind the attribute form cannot
// render; it authors the exact shape that form consumes.
//
// The wire is camelCase (see WireProductType — the shape productTypeService
// serialises). We keep those names verbatim.
//
// ── Fork-on-edit ──────────────────────────────────────────────────────────
// Built-in types are platform-owned and shared across every business. Editing a
// built-in's schema transparently FORKS it into a tenant-owned copy (same key,
// isBuiltIn=false) via PUT :key/schema, whose response carries `forked: true`.
// `useSaveProductType` sequences the fork so a built-in becomes "your copy" on
// first save; a custom type saves in place.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { apiErrorMessage } from '../../lib/api-error';
import { api } from '../../lib/api/client';

/* ── The attribute-field schema ──────────────────────────────────────────────
 *
 * A local mirror of the `FieldDef` union that @wizeworks/field-schema validates on
 * the server. The browser only carries the SHAPE (never the zod schema), so the
 * workbench stays free of a schemas dependency and the two can drift by one
 * release without a crash. */

interface BaseField {
  key: string;
  label: string;
  helpText?: string;
  required?: boolean;
}

export type FieldDef =
  | (BaseField & { type: 'text'; placeholder?: string; max?: number; min?: number })
  | (BaseField & { type: 'long_text'; rows?: number; max?: number; min?: number })
  | (BaseField & { type: 'rich_text' })
  | (BaseField & { type: 'slug'; sourceField?: string; max?: number })
  | (BaseField & { type: 'number'; min?: number; max?: number; integer?: boolean })
  | (BaseField & { type: 'boolean'; default?: boolean })
  | (BaseField & { type: 'date' })
  | (BaseField & { type: 'datetime' })
  | (BaseField & { type: 'enum'; options: { value: string; label: string }[]; multiple?: boolean })
  | (BaseField & { type: 'url' })
  | (BaseField & { type: 'email' })
  | (BaseField & { type: 'reference'; to: string; multiple?: boolean; min?: number; max?: number })
  | (BaseField & { type: 'asset'; accept?: string[]; multiple?: boolean })
  | ObjectFieldDef
  | RepeaterFieldDef;

export type ObjectFieldDef = BaseField & { type: 'object'; fields: FieldDef[] };

export type RepeaterFieldDef = BaseField & {
  type: 'repeater';
  itemLabel?: string;
  min?: number;
  max?: number;
  fields: FieldDef[];
};

/** A product type, exactly as productTypeService serialises it (camelCase). */
export interface ProductType {
  id: string;
  key: string;
  name: string;
  pluralName: string | null;
  description: string | null;
  icon: string | null;
  propertyId: string | null;
  isBuiltIn: boolean;
  attributeSchema: { fields: FieldDef[] };
  createdAt: string;
  updatedAt: string;
}

/* ── The editable field draft ───────────────────────────────────────────────
 *
 * A `FieldDef` has no stable identity — its `key` is the identity, and the key
 * changes as someone types it. The builder needs a handle that survives an edit
 * AND a reorder, so a draft field carries a session-only `_uid` used ONLY as a
 * React key and drag id (never persisted). `object`/`repeater` recurse, so their
 * nested fields are drafts too. */

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

/** Every field type this can author — the SAME set the attribute form renders. */
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

/** A fresh field of a type, with the minimum its shape requires. */
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
    return `Add at least one attribute to ${where}.`;
  }
  const seen = new Set<string>();
  for (const field of fields) {
    const label = field.label.trim();
    const key = field.key.trim();
    const named = label || 'an attribute';
    if (label === '') return 'Every attribute needs a name.';
    if (key === '') return `Give “${named}” a short id.`;
    if (!FIELD_KEY_RE.test(key)) {
      return `The id for “${named}” must start with a lowercase letter and use only letters, numbers and underscores.`;
    }
    if (seen.has(key))
      return `Two attributes in ${where} share the id “${key}”. Ids must be unique.`;
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
 * (`[a-z][a-zA-Z0-9_]*`). Seeded from the human name so nobody has to think
 * about ids — they stay editable, but a sensible one is filled in. */

export function toTypeKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^[0-9]+/, '');
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

export const productTypeKeys = {
  all: ['commerce', 'product-types'] as const,
  list: () => [...productTypeKeys.all, 'list'] as const,
  detail: (key: string) => [...productTypeKeys.all, 'detail', key] as const,
};

/* ── Reads ──────────────────────────────────────────────────────────────── */

/** Every product type — built-ins plus this business's own. A small, bounded set,
 *  so the whole list loads at once and the surface searches/filters it in the
 *  browser. */
export function useProductTypeList() {
  return useQuery({
    queryKey: productTypeKeys.list(),
    queryFn: () =>
      api.list<ProductType>('/v1/commerce/product-types', { take: 250 }).then((r) => r.items),
  });
}

export function useProductType(key: string) {
  return useQuery({
    queryKey: productTypeKeys.detail(key),
    queryFn: () => api.get<ProductType>(`/v1/commerce/product-types/${key}`),
    enabled: key !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

function useInvalidateTypes() {
  const queryClient = useQueryClient();
  return (key?: string) => {
    void queryClient.invalidateQueries({ queryKey: productTypeKeys.list() });
    if (key) void queryClient.invalidateQueries({ queryKey: productTypeKeys.detail(key) });
  };
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

/** The type's presentation, wire-shaped. `null` clears an optional. */
export interface TypeMetaInput {
  name: string;
  pluralName: string | null;
  description: string | null;
  icon: string | null;
}

export interface CreateTypeInput {
  key: string;
  name: string;
  pluralName?: string;
  description?: string;
  icon?: string;
  attributeSchema: { fields: FieldDef[] };
}

export function useCreateProductType() {
  const invalidate = useInvalidateTypes();
  return useMutation({
    mutationFn: (input: CreateTypeInput) =>
      api.post<ProductType>('/v1/commerce/product-types', input),
    onSuccess: (type) => {
      invalidate(type.key);
    },
  });
}

/** What a schema-save returns: the persisted type, plus whether this save just
 *  FORKED a platform built-in into the tenant's own copy. */
export interface SaveResult {
  productType: ProductType;
  forked: boolean;
}

/**
 * Save an existing type.
 *
 * A CUSTOM type saves in place: PATCH the presentation, then PUT the schema.
 *
 * A BUILT-IN forks: the schema PUT is what creates the tenant-owned copy (same
 * key, isBuiltIn=false), so it runs FIRST — a PATCH against a built-in is
 * rejected. Once forked, the same key resolves to the custom copy, so the
 * presentation PATCH lands on it. The PUT response carries `forked` so the caller
 * can say "this is now your copy".
 */
export function useSaveProductType(key: string) {
  const invalidate = useInvalidateTypes();
  return useMutation({
    mutationFn: async (input: {
      meta: TypeMetaInput;
      schema: { fields: FieldDef[] };
      isBuiltIn: boolean;
    }): Promise<SaveResult> => {
      if (input.isBuiltIn) {
        const forkedType = await api.put<ProductType & { forked?: boolean }>(
          `/v1/commerce/product-types/${key}/schema`,
          { attributeSchema: input.schema }
        );
        const applied = await api.patch<ProductType>(
          `/v1/commerce/product-types/${key}`,
          input.meta
        );
        return { productType: applied, forked: forkedType.forked === true };
      }
      await api.patch<ProductType>(`/v1/commerce/product-types/${key}`, input.meta);
      const saved = await api.put<ProductType & { forked?: boolean }>(
        `/v1/commerce/product-types/${key}/schema`,
        { attributeSchema: input.schema }
      );
      return { productType: saved, forked: saved.forked === true };
    },
    onSuccess: () => {
      invalidate(key);
    },
  });
}

export function useDeleteProductType(key: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`/v1/commerce/product-types/${key}`),
    onSuccess: () => {
      // Only the list is refreshed — the detail query is left to garbage-collect
      // when the pane unmounts, so a refetch of the just-deleted key can't 404
      // into this pane mid-close.
      void queryClient.invalidateQueries({ queryKey: productTypeKeys.list() });
    },
  });
}

/* ── Errors ─────────────────────────────────────────────────────────────── */

/** The server's own sentence for a 4xx (it names the exact problem — a duplicate
 *  key, an attribute the products already use); a 5xx falls back to the caller's
 *  wording. */
export function productTypeErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}
