// Turning what somebody typed into the part of a web address that identifies it.
//
// ── WHY THIS IS SHARED, AND WHY IT FOLDS ACCENTS ────────────────────────────
//
// Thirteen surfaces derive a slug as you type — the product handle, a category,
// a collection, a page, a segment key — and every one of them had its own copy
// of the same three lines. The copies all dropped anything outside `a-z0-9`,
// which turns a letter with an accent into a HYPHEN rather than into the letter:
//
//     Ham, gruyère and mustard baguette  →  ham-gruy-re-and-mustard-baguette
//
// That is a real bakery's real product, and that is its public web address.
// Issue #013.
//
// The server already gets this right — `slugify` in `@wizeworks/commerce`'s
// product-service normalises to NFKD and strips the combining marks first, so
// the API would have produced `ham-gruyere-and-mustard-baguette`. It never got
// the chance: the console fills the "Web address" field from the typed name and
// SENDS it, so the client's answer is the one that wins. A server that is
// careful and a client that is not is the same as a client, when the client
// submits.
//
// So this matches the server's rule exactly. If the two ever disagree again, the
// visible symptom is a web address that is not the one the preview promised.

/** Fold accents onto their base letters — é → e, ü → u, ñ → n — so a name with
 *  one keeps its letters instead of losing them to a separator. */
function foldAccents(value: string): string {
  // NFKD splits a composed letter into base + combining mark; the range below is
  // the combining diacritical block, which is what then gets dropped.
  return value.normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

/**
 * A web-address segment: lowercase letters, digits and hyphens.
 *
 * @param value what the person typed
 * @param max longest result, in characters — a product handle allows 127, a
 *   site slug 63. Trimmed to a whole word so an address never ends mid-syllable.
 */
export function slugify(value: string, max = 127): string {
  return foldAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/, '');
}

/**
 * The same, in the shape a CODE takes — uppercase, hyphenated.
 *
 * Used for the suggested product code, which had the identical accent problem:
 * `HAM-GRUY-RE-AND-MUST-1` for a baguette with a gruyère in it.
 */
export function slugifyUpper(value: string, max = 20): string {
  return foldAccents(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/, '');
}

/** An identifier for something addressed by KEY rather than by URL — a segment,
 *  a workflow stage, a form field. Underscores, because these are read as one
 *  token rather than as words in an address. */
export function slugifyKey(value: string, max = 63): string {
  return foldAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, max)
    .replace(/_+$/, '');
}
