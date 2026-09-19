// "shelf" and "shelves" are the same word, and until this file existed the
// search boxes did not know it.
//
// ── What was measured ────────────────────────────────────────────────────
//
// Typing "shelf" into the launcher offered "Shelf labels" and "Expiring stock"
// and NOT "Shelves" — the screen actually called shelves, one row away in the
// same app. Both boxes compare literal text: the launcher on a word start, the
// navigation panel on a substring. Neither can see that one spelling of a word
// is the other.
//
// Across both consoles that is 15 screens out of 287 plural words in screen
// names. Most plurals are fine by accident, because "orders" contains "order".
// The two that are not are the two English endings that CHANGE the stem:
//
//     category  → categories      Categories · Spending categories
//     shelf     → shelves         Shelves
//     company   → companies       Companies
//     reply     → replies         Quick replies
//
// A person who types the singular is told the screen does not exist. That is
// the worst answer a search box can give, because it is indistinguishable from
// the feature not being there.
//
// ── Why extra forms are safe ─────────────────────────────────────────────
//
// Every form this returns is an ADDITIONAL string to look for. Most wrong
// guesses are not words at all ("analysis" → "analysi"), so they match nothing
// and change nothing. A guess can only do harm by being a real word that is
// ALSO inside something unrelated, and the short ones are where that bites
// ("bus" → "bu" would reach "budget"), so nothing under three letters is ever
// produced and the singular rules refuse the endings that are not plurals.
// What is left — a rare extra row below the row that was asked for — is the
// right side to err on, because the alternative is telling somebody a screen
// they are looking at in the menu does not exist.
//
// Proper nouns are left out of this deliberately: a customer is not a word with
// a number, and pluralising somebody's name would match strangers. Records rank
// through `recordRank`, which does not call this.

/** Below this, a form is short enough to appear inside unrelated words. */
const MIN_FORM = 3;

/** Endings that take `-es` rather than `-s`, because English cannot say "batchs". */
const HISSING = ['s', 'x', 'z', 'ch', 'sh'];

/**
 * The other ways somebody might have written this word — the plural of a
 * singular, the singular of a plural — with the word itself always first.
 *
 * Both directions matter. Somebody looking for the Shelves screen may type
 * either, and somebody looking for "Shelf labels" may type either too.
 */
export function wordForms(word: string): string[] {
  const one = word.toLowerCase();
  const forms = [one];

  const add = (form: string) => {
    if (form.length >= MIN_FORM && !forms.includes(form)) forms.push(form);
  };

  // ── Towards the plural ──────────────────────────────────────────────────
  if (/[^aeiou]y$/.test(one)) {
    add(`${one.slice(0, -1)}ies`); // category → categories
  } else if (one.endsWith('fe')) {
    add(`${one.slice(0, -2)}ves`); // knife → knives
  } else if (/[^f]f$/.test(one)) {
    add(`${one.slice(0, -1)}ves`); // shelf → shelves
  } else if (HISSING.some((ending) => one.endsWith(ending))) {
    add(`${one}es`); // batch → batches, address → addresses
  } else {
    add(`${one}s`); // order → orders
  }

  // ── Towards the singular ────────────────────────────────────────────────
  //
  // Guarded so a singular word that merely ENDS in s is not chopped: "address"
  // and "status" keep their last letter, because the letter before it is also
  // an s or is not a vowel-consonant pair a plural would leave behind.
  if (/[^aeiou]ies$/.test(one)) {
    add(`${one.slice(0, -3)}y`); // categories → category
  } else if (/[^f]ves$/.test(one)) {
    add(`${one.slice(0, -3)}f`); // shelves → shelf
    add(`${one.slice(0, -3)}fe`); // knives → knife
  } else if (/(ch|sh|ss|x|z)es$/.test(one)) {
    add(one.slice(0, -2)); // batches → batch
  } else if (/[^su]s$/.test(one)) {
    add(one.slice(0, -1)); // orders → order, but not "status" or "press"
  }

  return forms;
}

/**
 * The best score any spelling of `query` earns, using the caller's own ladder.
 *
 * Written as a fold over `wordForms` rather than inside the ladder itself so the
 * ladder stays one readable list of rules, and so the navigation panel — which
 * has no ladder, only a yes or no — can use the same word list.
 */
export function bestOverForms(query: string, rate: (form: string) => number): number {
  let best = 0;
  for (const form of wordForms(query)) {
    const rank = rate(form);
    if (rank > best) best = rank;
  }
  return best;
}
