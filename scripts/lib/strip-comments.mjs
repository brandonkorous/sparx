/**
 * Take the comments out of TypeScript source, leaving strings alone.
 *
 * ── Why this is a shared module and not two regexes ──────────────────────────
 *
 * Every structural check that asks "is this name USED anywhere" has to answer
 * it about code, not about prose, and a comment that happens to mention the
 * name is not a use. `check:orphan-surfaces` learned that twice in one sitting:
 *
 *   • Its first version counted a name appearing ANYWHERE in a file, so the
 *     comment that had just been written about an orphaned component made the
 *     orphan look used, and the check printed a tick over the very defect it
 *     was written for.
 *   • Its second version stripped comments with two regexes, and the
 *     block-comment pattern matched the `/*` inside a LINE comment that
 *     mentions a URL:
 *
 *         // api-rest `/v1/email/[star]` backend (broadcasts, sending domains)
 *
 *     then ran 3,202 characters to the next close and swallowed every import in
 *     `catalog/email.ts`. Nine registered surfaces vanished from the scan at
 *     once, and five plainly-shipping components per console were reported dead.
 *
 * A regex cannot see that a `/*` is inside a comment, or that a `//` is inside a
 * string, because knowing that IS the parse. So: one pass, four states, no
 * lookahead cleverness. [[feedback_codemod_diff_your_own_sweep]]
 *
 * Strings are deliberately KEPT. A name inside a string is almost always a
 * registry key, a route or a dynamic import, all of which are real uses.
 *
 * Zero dependencies on purpose: CI runs the checks with bare Node, no install.
 *
 * @param {string} source
 * @returns {string} the same source with every comment replaced by whitespace
 */
export function stripComments(source) {
  let out = '';
  let i = 0;
  const n = source.length;
  while (i < n) {
    const c = source[i];
    const next = source[i + 1];
    if (c === '/' && next === '/') {
      while (i < n && source[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) i += 1;
      i += 2;
      out += ' ';
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      out += c;
      i += 1;
      while (i < n) {
        if (source[i] === '\\') {
          out += source.slice(i, i + 2);
          i += 2;
          continue;
        }
        out += source[i];
        if (source[i] === quote) {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}
