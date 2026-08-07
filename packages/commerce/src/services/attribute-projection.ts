// Attribute projection (docs/143 §6.4, §7) — turns a product's stored attribute
// bag + its resolved type schema into the two shapes a site's PDP binds:
//
//   - `attributes`: Record<fieldKey, string> — one resolved DISPLAY value per
//     field, for INDIVIDUAL binding (`commerce.product.attributes.fabric`).
//   - `attributeSections`: an ORDERED list (the type's field order) of
//     { key, label, kind, value, items } — for the AUTO-RENDER repeat. `items`
//     carries repeater/object rows so a template can sub-repeat them; it's []
//     for scalar fields, so the repeat binding path is uniform across kinds.
//
// Pure + synchronous — no DB, fully testable. The route resolves the schema once
// (batched across a product list) and calls this per product.

import type { FieldDef, FieldSchema } from '@sparx/field-schema';

export interface AttributeSectionItem {
  label: string;
  value: string;
}

export interface AttributeSection {
  key: string;
  label: string;
  kind: string;
  value: string;
  items: AttributeSectionItem[];
}

export interface AttributeProjection {
  attributes: Record<string, string>;
  attributeSections: AttributeSection[];
}

function isEmpty(raw: unknown): boolean {
  if (raw === null || raw === undefined) return true;
  if (typeof raw === 'string') return raw.trim() === '';
  if (Array.isArray(raw)) return raw.length === 0;
  return false;
}

// Render a repeater/object row array into label/value pairs. Convention: the
// first field is the label, the second (if any) the value — which fits every
// built-in repeater (materials name/percent, specs label/value, nutrition
// label/value, details label/body).
function renderRows(field: FieldDef, raw: unknown): AttributeSectionItem[] {
  if (field.type !== 'repeater' && field.type !== 'object') return [];
  const subFields = field.fields ?? [];
  const labelKey = subFields[0]?.key;
  const valueKey = subFields[1]?.key;
  const rows = Array.isArray(raw) ? raw : [raw];
  const items: AttributeSectionItem[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const label = labelKey != null ? stringify(r[labelKey]) : '';
    const value = valueKey != null ? stringify(r[valueKey]) : '';
    if (!label && !value) continue;
    items.push({ label, value });
  }
  return items;
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

// A scalar field's single display value (the joined summary for enum-multiple).
function renderScalar(field: FieldDef, raw: unknown): string {
  switch (field.type) {
    case 'enum': {
      const labelFor = (val: string) => field.options.find((o) => o.value === val)?.label ?? val;
      if (field.multiple && Array.isArray(raw))
        return raw.map((v) => labelFor(stringify(v))).join(', ');
      return labelFor(stringify(raw));
    }
    case 'boolean':
      return raw ? 'Yes' : 'No';
    case 'currency':
    case 'calculated':
      // A money value travels as { amount, currency } (docs/144 field engine); a
      // calculated field resolves to a number or the same money object. Render a
      // plain display string so the PDP can bind it like any other attribute.
      return renderMoneyOrNumber(raw);
    default:
      return stringify(raw);
  }
}

// A currency/calculated value is either a bare number or a { amount, currency }
// object; render whichever it is as a display string.
function renderMoneyOrNumber(raw: unknown): string {
  if (raw && typeof raw === 'object') {
    const m = raw as { amount?: unknown; currency?: unknown };
    if (typeof m.amount === 'number') {
      const cur = typeof m.currency === 'string' ? m.currency : '';
      return cur ? `${m.amount} ${cur}` : String(m.amount);
    }
    return '';
  }
  return stringify(raw);
}

// Join repeater rows into one string for the individual-bind `attributes.<key>`.
function summarizeRows(items: AttributeSectionItem[]): string {
  return items.map((i) => [i.label, i.value].filter(Boolean).join(' — ')).join(', ');
}

export function projectProductAttributes(
  schema: FieldSchema,
  bag: Record<string, unknown> | null | undefined
): AttributeProjection {
  const source = bag && typeof bag === 'object' ? bag : {};
  const attributes: Record<string, string> = {};
  const attributeSections: AttributeSection[] = [];

  for (const field of schema.fields) {
    const raw = source[field.key];
    if (isEmpty(raw)) continue;

    if (field.type === 'repeater' || field.type === 'object') {
      const items = renderRows(field, raw);
      if (items.length === 0) continue;
      // Keyed `attributes.<key>` keeps a joined summary for an INDIVIDUAL bind; the
      // section's own `value` is left EMPTY so the auto-render repeat drives the field
      // from `items` (a nested sub-repeat) instead of double-printing the summary.
      attributes[field.key] = summarizeRows(items);
      attributeSections.push({
        key: field.key,
        label: field.label,
        kind: field.type,
        value: '',
        items,
      });
    } else {
      const value = renderScalar(field, raw);
      if (!value) continue;
      attributes[field.key] = value;
      attributeSections.push({
        key: field.key,
        label: field.label,
        kind: field.type,
        value,
        items: [],
      });
    }
  }

  return { attributes, attributeSections };
}
