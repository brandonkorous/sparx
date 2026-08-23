// The Options tab's DRAFT — what is being typed, and what is wrong with it.
//
// Pure data. No React, no network. The tab renders it, product-options-plan.ts
// works out what committing it would do.

import type { OptionDisplayType, ProductOption } from './products-data';

/** How big a lattice may get. Both are about what a SHOPPER can work through
 *  and what an owner can keep priced, not about what the browser can hold. */
export const MAX_OPTIONS = 8;
export const MAX_VALUES = 250;

/** A local key, because a value being TYPED has no server id yet and its text
 *  changes on every keystroke — neither is usable as a React key.
 *
 *  These keys carry more weight than identity for React. An EXISTING option or
 *  value keeps the server's id as its key, and that is what tells us a renamed
 *  "Size" is still the same axis rather than a new one — see `consequenceOf`. */
let localKeys = 0;
export function nextKey(): string {
  localKeys += 1;
  return `local-${String(localKeys)}`;
}

export interface ValueDraft {
  /** The server's option-value id, or a local key for a value being added. */
  key: string;
  value: string;
  /** `#RRGGBB` — the color of the THING being sold, not a design token. */
  swatchHex: string | null;
}

export interface OptionDraft {
  /** The server's option id, or a local key for an axis being added. */
  key: string;
  name: string;
  displayType: OptionDisplayType;
  values: ValueDraft[];
}

/** A fresh, empty axis with one empty value ready to type into. */
export function blankOption(): OptionDraft {
  return {
    key: nextKey(),
    name: '',
    displayType: 'dropdown',
    values: [{ key: nextKey(), value: '', swatchHex: null }],
  };
}

export function blankValue(): ValueDraft {
  return { key: nextKey(), value: '', swatchHex: null };
}

export function toDraft(options: ProductOption[]): OptionDraft[] {
  return options.map((option) => ({
    key: option.id,
    name: option.name,
    displayType: option.displayType,
    values: option.values.map((value) => ({
      key: value.id,
      value: value.value,
      swatchHex: value.swatchHex,
    })),
  }));
}

/** Compared as text so "did anything move" is one string equality rather than a
 *  hand-written deep compare that forgets a field the day someone adds one. */
export function fingerprint(draft: OptionDraft[]): string {
  return JSON.stringify(
    draft.map((option) => [
      option.name.trim(),
      option.displayType,
      option.values.map((value) => [value.value.trim(), value.swatchHex]),
    ])
  );
}

/** Trimmed, blank-free view of the draft — the only form worth reasoning about.
 *  A half-typed option is not a decision yet, so it counts for nothing. */
export function cleanDraft(draft: OptionDraft[]): OptionDraft[] {
  return draft
    .map((option) => ({
      ...option,
      name: option.name.trim(),
      values: option.values
        .map((value) => ({ ...value, value: value.value.trim() }))
        .filter((value) => value.value !== ''),
    }))
    .filter((option) => option.name !== '' && option.values.length > 0);
}

/** Nothing typed into this card at all — not a decision, so nothing to say
 *  about it and nothing to mark red. */
export function untouchedOption(option: OptionDraft): boolean {
  return option.name.trim() === '' && option.values.every((value) => value.value.trim() === '');
}

/** Reorder without mutating, and without tripping the compiler's index checks. */
export function swap<T>(list: T[], from: number, to: number): T[] {
  const a = list[from];
  const b = list[to];
  if (!a || !b) return list;
  const next = [...list];
  next[from] = b;
  next[to] = a;
  return next;
}

/* ── How each display type is described to a person ─────────────────────── */

// Nobody outside this industry says "swatch". These are the words an owner would
// use for the thing their shopper actually sees.
const DISPLAY_LABELS: Record<OptionDisplayType, string> = {
  dropdown: 'A drop-down list',
  radio: 'A list to pick one from',
  segmented: 'A row of joined buttons',
  swatch: 'Color dots',
  image_swatch: 'Small pictures',
};

/** `image_swatch` needs a picture per value and there is nowhere to choose one
 *  yet — the Media tab is not built. Offering it would be offering a dead end,
 *  so it appears only on a product already using it, where hiding it would
 *  silently change how that product is sold on the next commit. */
export function displayItems(current: OptionDisplayType) {
  const keys: OptionDisplayType[] = ['dropdown', 'radio', 'segmented', 'swatch'];
  if (current === 'image_swatch') keys.push('image_swatch');
  return keys.map((key) => ({ value: key, label: DISPLAY_LABELS[key] }));
}

/* ── What is wrong with the draft ───────────────────────────────────────── */

/**
 * The FIRST real problem, named where it is rather than as a banner at the top.
 * Committing is blocked on it.
 *
 * `field` matters: an option whose VALUES are missing must not put a red ring
 * round its NAME. Marking the wrong control is worse than marking none — it
 * sends someone to retype a word that was already right.
 */
export interface OptionProblem {
  key: string;
  field: 'name' | 'values';
  message: string;
}

export function problemWith(draft: OptionDraft[]): OptionProblem | null {
  const named = new Set<string>();
  for (const option of draft) {
    // A card nobody has typed into is not yet wrong. Pressing "Add a choice"
    // used to answer with a red "Give this choice a name" before the cursor
    // arrived, which is telling somebody off for not doing a thing nobody had
    // asked them to do yet (issue 170). `cleanDraft` discards it anyway.
    if (untouchedOption(option)) continue;

    const name = option.name.trim();
    if (name === '') {
      return {
        key: option.key,
        field: 'name',
        message: 'Give this choice a name, like Size or Color.',
      };
    }
    if (named.has(name.toLowerCase())) {
      return {
        key: option.key,
        field: 'name',
        message: `You already have a choice called “${name}”. Give this one a different name.`,
      };
    }
    named.add(name.toLowerCase());

    const filled = option.values.filter((value) => value.value.trim() !== '');
    if (filled.length === 0) {
      return {
        key: option.key,
        field: 'values',
        message: `Add at least one thing a shopper can pick for ${name}.`,
      };
    }
    const seen = new Set<string>();
    for (const value of filled) {
      const text = value.value.trim().toLowerCase();
      if (seen.has(text)) {
        return {
          key: option.key,
          field: 'values',
          message: `“${value.value.trim()}” is listed twice under ${name}.`,
        };
      }
      seen.add(text);
    }
    if (option.displayType === 'swatch' && filled.some((value) => !value.swatchHex)) {
      return {
        key: option.key,
        field: 'values',
        message: `Every color under ${name} needs a color picked, or shoppers see an empty dot.`,
      };
    }
  }
  return null;
}
