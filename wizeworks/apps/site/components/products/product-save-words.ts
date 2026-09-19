// WHICH VERSION A SHOPPER IS SAVING, AND WHAT THE CONTROL SAYS.
//
// Saved items key on a VERSION, not a product: a size 14 in Clay and a size 8 in
// Bone are two rows, and a shop deciding what to re-cut needs to know which. So a
// save control that always saved the FIRST version would quietly file the wrong
// one every time a shopper had chosen anything.
//
// The buy box beside it already holds that choice, in a form field named
// `variantId` — either a radio group when there is more than one version, or a
// hidden input when there is one. This module decides what the control is
// pointing at, given what that field currently says and what the product has.
//
// Pure, so the rule can be tested without a page.

/** What the control is pointing at, or `null` when there is nothing to save. */
export function variantToSave(
  chosen: string | null | undefined,
  available: readonly string[]
): string | null {
  const picked = chosen?.trim();
  // Only a version this product actually has. A stale field — the shopper changed
  // color and the radios re-rendered — must never save something else.
  if (picked && available.includes(picked)) return picked;
  // One version means there is no choice to follow, and the buy box renders a
  // hidden field rather than radios.
  if (available.length === 1) return available[0] ?? null;
  // Several versions and none chosen yet: there is no honest answer, so the
  // control waits rather than guessing one.
  return null;
}

export interface SaveLabels {
  label: string;
  savedLabel: string;
}

/**
 * What the control says right now.
 *
 * The saved state says **what it is**, not what pressing again would do. A heart
 * reading "Remove" at rest makes a shopper work out whether the thing is saved by
 * reading the button that undoes it.
 */
export function saveButtonText(saved: boolean, words: SaveLabels): string {
  return saved ? words.savedLabel : words.label;
}

/**
 * The accessible name, which has to carry the ACT as well as the state.
 *
 * The visible word is the state; a screen reader hearing only "Saved" on a
 * pressable thing is told where it is and not what it does.
 */
export function saveButtonAria(saved: boolean, words: SaveLabels): string {
  return saved ? `${words.savedLabel}. Press to remove it from your saved list.` : words.label;
}

/** What to say when a version has to be chosen before anything can be saved. */
export function chooseFirstText(): string {
  return 'Choose a version first';
}
