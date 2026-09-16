/**
 * Response headers a BROWSER is allowed to read.
 *
 * Why this file exists, and why it is separate from `app.ts`.
 *
 * A cross-origin `fetch` can read exactly seven response headers by default —
 * Cache-Control, Content-Language, Content-Length, Content-Type, Expires,
 * Last-Modified, Pragma. Everything else is invisible to JavaScript unless the
 * server names it in `Access-Control-Expose-Headers`. There is no error, no
 * console warning and no failed request: `headers.get('x-sparx-…')` simply
 * answers null, and every caller's `?? '0'` fallback turns that into a number
 * that reads like good news.
 *
 * That had already happened three times, in both consoles:
 *
 *  - the accounting export's filename fell back to `expenses.csv`, so August and
 *    September saved over each other;
 *  - its "N costs were left out" warning had never once fired;
 *  - the staff timesheet export's "these hours could not be costed, and they
 *    still have to be paid" warning had never once fired either.
 *
 * The list is explicit rather than `*` so that adding a header is a decision
 * somebody makes, and `pnpm check:exposed-headers` fails the build when a
 * console reads a header that is not on it.
 */
export const EXPOSED_RESPONSE_HEADERS = [
  // The filename of every download. Without it the browser saves each export
  // under its caller's hardcoded fallback, so two periods collide.
  'content-disposition',
  // Accounting export: rows the server left out, and rows it wrote. A download
  // cannot carry a warning, so the facts that change how the file is read ride
  // beside it.
  'x-sparx-skipped-rows',
  'x-sparx-row-count',
  // Timesheet export: hours that are in the hours column and not the cost
  // column, because nobody has a pay rate covering them.
  'x-sparx-unpriced-minutes',
] as const;
