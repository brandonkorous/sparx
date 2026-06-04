// Field-kind vocabulary for builder-authored content schemas (docs/51 keystone).
//
// CREATE is scoped to the no-extra-config kinds — the ones a label + a kind pick
// fully specify. enum (needs options), reference (needs a target type), and
// object / repeater (need nested field editors) are a fast-follow; until then
// they render read-only in the Fields list but can't be created here. EDITING a
// field's label / required / helpText works for ANY existing kind (see
// fields-panel.tsx) — only creation is gated to CREATABLE_KINDS.

import type { FieldDef } from '@sparx/cms-schemas';

export type CreatableType =
  | 'text'
  | 'long_text'
  | 'rich_text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'url'
  | 'email'
  | 'asset';

export interface CreatableKind {
  type: CreatableType;
  label: string;
  hint: string;
}

export const CREATABLE_KINDS: CreatableKind[] = [
  { type: 'text', label: 'Text', hint: 'A short single-line value.' },
  { type: 'long_text', label: 'Long text', hint: 'A multi-line paragraph.' },
  { type: 'rich_text', label: 'Rich text', hint: 'Formatted body content.' },
  { type: 'number', label: 'Number', hint: 'A numeric value.' },
  { type: 'boolean', label: 'Toggle', hint: 'A true / false switch.' },
  { type: 'date', label: 'Date', hint: 'A calendar date.' },
  { type: 'datetime', label: 'Date & time', hint: 'A date with a time.' },
  { type: 'url', label: 'URL', hint: 'A web link.' },
  { type: 'email', label: 'Email', hint: 'An email address.' },
  { type: 'asset', label: 'Image', hint: 'An uploaded image.' },
];

// A readable label for ANY field kind — including the not-yet-creatable ones, so
// the Fields list can still render existing enum / reference / object / repeater
// fields a built-in ships with.
export const KIND_LABEL: Record<string, string> = {
  text: 'Text',
  long_text: 'Long text',
  rich_text: 'Rich text',
  slug: 'Slug',
  number: 'Number',
  boolean: 'Toggle',
  date: 'Date',
  datetime: 'Date & time',
  enum: 'Choice',
  url: 'URL',
  email: 'Email',
  reference: 'Reference',
  asset: 'Image / file',
  object: 'Group',
  repeater: 'Repeater',
};

/** camelCase a label into a valid FieldKey (^[a-z][a-zA-Z0-9_]*$), de-duped
 *  against the existing keys with a numeric suffix. A label that starts with a
 *  digit (or is empty) falls back to a `field…` prefix so the result is valid. */
export function deriveFieldKey(label: string, existing: readonly { key: string }[]): string {
  const words =
    label
      .trim()
      .toLowerCase()
      .match(/[a-z0-9]+/g) ?? [];
  let base = words.map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1))).join('');
  if (!base || !/^[a-z]/.test(base)) {
    base = `field${base ? base.charAt(0).toUpperCase() + base.slice(1) : ''}`;
  }
  const taken = new Set(existing.map((f) => f.key));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}${n}`)) n += 1;
  return `${base}${n}`;
}

/** Build a fresh FieldDef of a creatable kind. `asset` defaults to image-only;
 *  every other config (max / required / helpText) is left unset for the user to
 *  tune after. The server re-validates the whole schema against the Zod union. */
export function makeFieldDef(type: CreatableType, key: string, label: string): FieldDef {
  if (type === 'asset') return { type: 'asset', key, label, accept: ['image/*'] };
  return { type, key, label };
}
