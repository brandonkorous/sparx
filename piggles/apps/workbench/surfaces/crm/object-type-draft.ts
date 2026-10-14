// The editor's draft of one record type, and the pure helpers around it.

import type { CrmObjectType, PropertyField } from './object-types-data';

// A detail being edited, with a `uid` minted once that is NOT its key. The key
// follows the label as you type, so keying rows by it would remount them and lose focus.
export interface DraftField {
  uid: string;
  field: PropertyField;
}

let uidCounter = 0;
export function newUid(): string {
  uidCounter += 1;
  return `f${String(uidCounter)}`;
}

export interface Draft {
  key: string;
  label: string;
  labelPlural: string;
  description: string;
  primaryFieldKey: string;
  fields: DraftField[];
}

// A first guess at the plural, shown as an editable value rather than applied
// silently at save. Handles -y to -ies and the sibilants that need -es.
export function pluralise(singular: string): string {
  const word = singular.trim();
  if (word === '') return '';
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
  return `${word}s`;
}

export const EMPTY_DRAFT: Draft = {
  key: '',
  label: '',
  labelPlural: '',
  description: '',
  primaryFieldKey: '',
  fields: [],
};

/** Everything that would be SENT, and nothing that would not — `uid` is editor
 *  bookkeeping, so including it would make a reload look like an edit. */
export function snapshotOf(draft: Draft): string {
  return JSON.stringify({
    key: draft.key,
    label: draft.label,
    labelPlural: draft.labelPlural,
    description: draft.description,
    primaryFieldKey: draft.primaryFieldKey,
    fields: draft.fields.map((row) => row.field),
  });
}

/** The draft for a type the server returned, each detail given a fresh `uid`. */
export function draftFromType(type: CrmObjectType): Draft {
  return {
    key: type.key,
    label: type.label,
    labelPlural: type.labelPlural,
    description: type.description ?? '',
    primaryFieldKey: type.primaryFieldKey ?? '',
    fields: (type.propertySchema?.fields ?? []).map((field) => ({ uid: newUid(), field })),
  };
}
