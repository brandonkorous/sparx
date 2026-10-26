// Unsent form typing, kept in this tab's sessionStorage so a forced reload does not lose it.

export type DraftValue = string | boolean | string[];
export type Draft = Record<string, DraftValue>;

/** The slice of Storage a draft needs, so tests can hand in a fake. */
export type DraftStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const PREFIX = 'piggles.draft.';

/** Keys that never reach storage, whatever a caller passes. */
const NEVER_KEPT = /pass|secret|token|card|cvc/i;

/** This tab's sessionStorage, or null on the server or when storage is blocked. */
export function tabStorage(): DraftStore | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function isDraftValue(value: unknown): value is DraftValue {
  if (typeof value === 'string' || typeof value === 'boolean') return true;
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/** Only the keys that may be kept, holding values of a kept shape. */
function keepable(raw: Record<string, unknown>): Draft {
  const draft: Draft = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!NEVER_KEPT.test(key) && isDraftValue(value)) draft[key] = value;
  }
  return draft;
}

/** The saved draft for this form, or null when there is none or it cannot be read. */
export function readDraft(name: string, store: DraftStore | null = tabStorage()): Draft | null {
  try {
    const raw: unknown = JSON.parse(store?.getItem(PREFIX + name) ?? 'null');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    return keepable(raw as Record<string, unknown>);
  } catch {
    return null;
  }
}

/** Saves the draft, minus anything secret. Never throws: a full or blocked store just forgets. */
export function saveDraft(name: string, values: Draft, store: DraftStore | null = tabStorage()) {
  try {
    store?.setItem(PREFIX + name, JSON.stringify(keepable(values)));
  } catch {
    // Not kept; the form still works.
  }
}

/** Forgets the draft once the form has done its job. */
export function clearDraft(name: string, store: DraftStore | null = tabStorage()) {
  try {
    store?.removeItem(PREFIX + name);
  } catch {
    // Nothing to clear.
  }
}

export function draftText(d: Draft | null, key: string): string | undefined {
  const value = d?.[key];
  return typeof value === 'string' ? value : undefined;
}

export function draftFlag(d: Draft | null, key: string): boolean | undefined {
  const value = d?.[key];
  return typeof value === 'boolean' ? value : undefined;
}

export function draftList(d: Draft | null, key: string): string[] | undefined {
  const value = d?.[key];
  return Array.isArray(value) ? value : undefined;
}
