// Custom fields on inventory records (docs/146 Phase 11.8).
//
// Every business has one or two facts about its stock that no product schema
// anticipates: the shelf a part lives on in the old numbering, the customer a
// batch is earmarked for, the certification a supplier holds, the internal
// project a purchase order belongs to. Today those live in a column of the
// spreadsheet sparx is asking them to abandon, and "you'd lose that column" is a
// complete reason not to switch.
//
// ── Why definitions are a table and values are a column ──────────────────────
//
// The DEFINITION is data the tenant authors: a label, a type, a list of choices,
// an order. It is small, it is read on every screen that renders the record, and
// it needs a real identity so a field can be renamed without orphaning what was
// typed under the old name.
//
// The VALUE is a JSON column on the record itself. Not a value table: the stock
// grid renders three hundred rows with their custom columns, and an entity-
// attribute-value join makes that query four times the size for no benefit sparx
// would ever use. A definition deleted leaves its values in place, unread — the
// cheapest possible undo for a field somebody removed by mistake.
//
// ── The rule this file exists to keep ────────────────────────────────────────
//
// A field's TYPE is a promise about what is in it. Coercion is the one place
// that promise is kept, and it refuses rather than guesses: an unparseable
// number is an error the person sees, never a silent zero, and never a string
// left sitting in a column the reports will try to add up.

import { z } from 'zod';

/** The four records a custom field can hang on. Deliberately not "everything" —
 *  each of these is somewhere a person keeps a column today. */
export const CustomFieldEntity = z.enum(['variant', 'level', 'supplier', 'purchase_order']);
export type CustomFieldEntity = z.infer<typeof CustomFieldEntity>;

export const CUSTOM_FIELD_ENTITIES = CustomFieldEntity.options;

export const CUSTOM_FIELD_ENTITY_LABELS: Record<CustomFieldEntity, string> = {
  variant: 'Item',
  level: 'Stock at a location',
  supplier: 'Supplier',
  purchase_order: 'Purchase order',
};

export const CustomFieldType = z.enum([
  'text',
  'number',
  'money',
  'date',
  'boolean',
  'select',
  'multi_select',
  'url',
]);
export type CustomFieldType = z.infer<typeof CustomFieldType>;

export const CUSTOM_FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: 'Text',
  number: 'Number',
  money: 'Money',
  date: 'Date',
  boolean: 'Yes / no',
  select: 'One of a list',
  multi_select: 'Any of a list',
  url: 'Link',
};

/**
 * The stored key, derived from the label once and then frozen.
 *
 * Frozen because the key is what appears in the JSON on every record, in the CSV
 * header, in the API response and in the MCP tool. Renaming the label must not
 * move the data; that is the entire reason a key exists separately from a label.
 */
export function normalizeFieldKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

/** The CSV heading a field exports and imports under. Prefixed so a field called
 *  "note" cannot collide with the importer's own `note` column. */
export function customFieldColumn(key: string): string {
  return `cf_${key}`;
}

export const CreateCustomFieldInput = z.object({
  entity: CustomFieldEntity,
  /** Optional: derived from the label when absent. Accepted explicitly so an
   *  import can recreate a field under the key its data already uses. */
  key: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z][a-z0-9_]*$/, 'Use lower-case letters, numbers and underscores')
    .optional(),
  label: z.string().min(1).max(80),
  type: CustomFieldType,
  /** The choices, for `select` / `multi_select`. Ignored for every other type. */
  options: z.array(z.string().min(1).max(80)).max(100).default([]),
  helpText: z.string().max(300).nullable().default(null),
  required: z.boolean().default(false),
  /** Show this as a column in lists and grids. Off by default — a tenant with
   *  twelve custom fields does not want twelve more columns by surprise. */
  showInList: z.boolean().default(false),
  position: z.number().int().min(0).max(999).default(0),
});
export type CreateCustomFieldInput = z.infer<typeof CreateCustomFieldInput>;

/**
 * Written out, not `.partial()` of the create schema.
 *
 * `.partial()` keeps every `.default()`, so editing only a label would reset
 * `required`, `showInList`, `position` and the choice list. `entity`, `key` and
 * `type` are absent on purpose: changing any of them re-points the field at data
 * that was written under different rules, which is a new field, not an edit.
 */
export const UpdateCustomFieldInput = z.object({
  label: z.string().min(1).max(80).optional(),
  options: z.array(z.string().min(1).max(80)).max(100).optional(),
  helpText: z.string().max(300).nullable().optional(),
  required: z.boolean().optional(),
  showInList: z.boolean().optional(),
  position: z.number().int().min(0).max(999).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateCustomFieldInput = z.infer<typeof UpdateCustomFieldInput>;

export interface CustomFieldDefinition {
  id: string;
  entity: CustomFieldEntity;
  key: string;
  label: string;
  type: CustomFieldType;
  options: string[];
  helpText: string | null;
  required: boolean;
  showInList: boolean;
  position: number;
  isActive: boolean;
}

export type CustomFieldValue = string | number | boolean | string[] | null;

export type CoerceResult = { ok: true; value: CustomFieldValue } | { ok: false; error: string };

/** Whatever arrived, as text. A plain `String(x)` on an unknown renders an
 *  object as "[object Object]" and stores that — a value that looks like data,
 *  passes every later check, and means nothing. */
function asText(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number' || typeof raw === 'boolean' || typeof raw === 'bigint') {
    return String(raw);
  }
  return JSON.stringify(raw) ?? '';
}

/**
 * Turn whatever arrived — a typed cell, a JSON body, a spreadsheet string — into
 * the value the field's type promises, or say why it cannot.
 *
 * Empty is always `null`, never the type's zero. A blank number field means
 * nobody filled it in; storing 0 there would put a measurement where an absence
 * belongs, and the reports downstream cannot tell the difference afterwards.
 */
export function coerceCustomFieldValue(
  definition: Pick<CustomFieldDefinition, 'type' | 'label' | 'options' | 'required'>,
  raw: unknown
): CoerceResult {
  const blank =
    raw === null ||
    raw === undefined ||
    (typeof raw === 'string' && raw.trim() === '') ||
    (Array.isArray(raw) && raw.length === 0);

  if (blank) {
    if (definition.required) return { ok: false, error: `${definition.label} is required` };
    return { ok: true, value: null };
  }

  switch (definition.type) {
    case 'text':
      return { ok: true, value: asText(raw).slice(0, 2000) };

    case 'url': {
      const text = asText(raw).trim();
      // A person types "example.com". Accepting it and storing it as typed is
      // right; rewriting it to add a scheme would put words in their mouth, and
      // rejecting it would be pedantry about a field called "Link".
      if (/\s/.test(text)) return { ok: false, error: `${definition.label} cannot contain spaces` };
      return { ok: true, value: text.slice(0, 500) };
    }

    case 'number':
    case 'money': {
      const text = typeof raw === 'number' ? String(raw) : asText(raw).trim();
      const cleaned = text.replace(/[$£€¥,\s]/g, '');
      const value = Number(cleaned);
      if (!Number.isFinite(value)) {
        return { ok: false, error: `${definition.label} must be a number` };
      }
      // Money is stored in cents, as everywhere else in this platform, so a
      // figure typed as 12.50 and one typed as 1250 cannot mean the same thing
      // in two different screens.
      return { ok: true, value: definition.type === 'money' ? Math.round(value * 100) : value };
    }

    case 'date': {
      const text = asText(raw).trim();
      const parsed = new Date(text);
      if (Number.isNaN(parsed.getTime())) {
        return { ok: false, error: `${definition.label} must be a date` };
      }
      // Date only. A custom field called "Certified until" has no business
      // carrying a timezone-shifted midnight.
      return { ok: true, value: parsed.toISOString().slice(0, 10) };
    }

    case 'boolean': {
      if (typeof raw === 'boolean') return { ok: true, value: raw };
      const text = asText(raw).trim().toLowerCase();
      if (['true', 'yes', 'y', '1'].includes(text)) return { ok: true, value: true };
      if (['false', 'no', 'n', '0'].includes(text)) return { ok: true, value: false };
      return { ok: false, error: `${definition.label} must be yes or no` };
    }

    case 'select': {
      const text = asText(raw).trim();
      const match = definition.options.find(
        (option) => option.toLowerCase() === text.toLowerCase()
      );
      if (!match) {
        return {
          ok: false,
          error: `${definition.label} must be one of: ${definition.options.join(', ')}`,
        };
      }
      // The stored value is the option as DEFINED, not as typed, so a list can
      // be grouped and counted without case variants splitting it in two.
      return { ok: true, value: match };
    }

    case 'multi_select': {
      const parts = Array.isArray(raw)
        ? raw.map((entry) => asText(entry))
        : asText(raw)
            .split(/[|;,]/)
            .map((entry) => entry.trim());
      const chosen: string[] = [];
      for (const part of parts) {
        if (part === '') continue;
        const match = definition.options.find(
          (option) => option.toLowerCase() === part.toLowerCase()
        );
        if (!match) {
          return {
            ok: false,
            error: `${definition.label} does not have an option called ${part}`,
          };
        }
        if (!chosen.includes(match)) chosen.push(match);
      }
      return { ok: true, value: chosen.length === 0 ? null : chosen };
    }

    default:
      return { ok: false, error: `${definition.label} has an unknown type` };
  }
}

export interface CustomFieldError {
  key: string;
  message: string;
}

export interface ValidatedCustomFields {
  /** Merged over what was already stored: a patch that mentions two fields
   *  leaves the other ten alone. Only keys the definitions know about survive,
   *  so a stale key in a request body cannot write into the record. */
  values: Record<string, CustomFieldValue>;
  errors: CustomFieldError[];
}

/**
 * Validate an incoming patch of custom-field values against the definitions.
 *
 * Required fields are enforced only on keys the caller SENT plus keys the record
 * has never had a value for — so an existing record does not become unsaveable
 * the moment somebody marks an old field required. The alternative locks a
 * tenant out of editing their own data as a side effect of a settings change.
 */
export function validateCustomFieldValues(
  definitions: readonly CustomFieldDefinition[],
  incoming: Record<string, unknown>,
  existing: Record<string, CustomFieldValue> = {}
): ValidatedCustomFields {
  const values: Record<string, CustomFieldValue> = { ...existing };
  const errors: CustomFieldError[] = [];
  const active = definitions.filter((definition) => definition.isActive);

  for (const definition of active) {
    if (!(definition.key in incoming)) continue;
    const result = coerceCustomFieldValue(definition, incoming[definition.key]);
    if (result.ok) values[definition.key] = result.value;
    else errors.push({ key: definition.key, message: result.error });
  }

  return { values, errors };
}

/** Read a record's stored blob back as a typed map, dropping anything no live
 *  definition claims. Values for a deleted field stay in the database and stop
 *  appearing here, which is what makes deleting a field survivable. */
export function readCustomFields(
  definitions: readonly CustomFieldDefinition[],
  stored: unknown
): Record<string, CustomFieldValue> {
  const blob =
    stored && typeof stored === 'object' && !Array.isArray(stored)
      ? (stored as Record<string, unknown>)
      : {};
  const out: Record<string, CustomFieldValue> = {};
  for (const definition of definitions) {
    if (!definition.isActive) continue;
    const value = blob[definition.key];
    out[definition.key] = (value ?? null) as CustomFieldValue;
  }
  return out;
}

/** One value, as a person reads it. Null renders as an em dash by the caller —
 *  never as "0", "false" or "—" decided here. */
export function formatCustomFieldValue(
  definition: Pick<CustomFieldDefinition, 'type'>,
  value: CustomFieldValue
): string | null {
  if (value === null || value === undefined) return null;
  switch (definition.type) {
    case 'boolean':
      return value ? 'Yes' : 'No';
    case 'money':
      return typeof value === 'number' ? `${(value / 100).toFixed(2)}` : String(value);
    case 'multi_select':
      return Array.isArray(value) ? value.join(', ') : String(value);
    default:
      return String(value);
  }
}

/** The value as it goes into a CSV cell — arrays pipe-joined so a comma inside a
 *  choice cannot be mistaken for a new column when the file comes back. */
export function customFieldCsvValue(value: CustomFieldValue): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.join('|');
  return value;
}
