// Whether two site documents say the same thing.
//
// The editor's "Unsaved changes" used to be a flag that any edit set and only Save
// cleared. Undo the one change you made and the page was exactly what was saved,
// yet the status still read "Unsaved changes" and closing the pane asked whether
// to throw away changes that did not exist. An owner reads that as "I broke
// something" (sparx persona issue 060).
//
// So after an undo or redo the studio asks this against the last saved document.
// Key order is ignored: applying an inverse op can put a property back in a
// different place in its object, and that is not a change anybody made. Arrays
// keep their order, because the order of pages, children and items IS content.

/** An empty object or list says the same as nothing at all. The editor hands back
 *  `symbols: {}` for a site the load described with no `symbols` key; both mean
 *  "no saved pieces", and Save sends the same thing for either. */
function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  return typeof value === 'object' && Object.keys(value).length === 0;
}

export function sameDocument(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (isEmpty(a) && isEmpty(b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => sameDocument(item, b[i]));
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  // An absent key and a key holding `undefined` are the same document: JSON drops
  // both, and that is what Save sends.
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (!sameDocument(left[key], right[key])) return false;
  }
  return true;
}
