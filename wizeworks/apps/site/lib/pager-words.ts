// What a list's pager says: which ones are shown, of how many (sparx persona
// issue 194). One sentence for every account list; the copies had drifted into
// three.

/** "1 to 20 of 45". Null when everything fits on one page, so no pager shows. */
export function pagerWords(offset: number, pageSize: number, total: number): string | null {
  if (total <= pageSize) return null;
  return `${String(offset + 1)} to ${String(Math.min(offset + pageSize, total))} of ${String(total)}`;
}
