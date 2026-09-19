// Fails when a console puts an api-rest path in an `href`.
//
// ── What this is for ─────────────────────────────────────────────────────────
//
// api-rest is reached with a bearer token, at an origin the console only learns
// at RUNTIME from `/api/token`. An `<a href>` carries neither. So a link to an
// API path is wrong twice over, and both failures are silent:
//
//   1. A path with no origin resolves against the CONSOLE's own origin. Next has
//      no `/v1` route, so it answers with the app shell and the browser saves
//      the HTML. `Download what you have` on Stock's import screen produced
//      146KB of Piggles named `template.html` — a web page, offered to a shop
//      owner as the stock list to count.
//   2. Pointed at the right origin it would 401, and the browser would save the
//      refusal as the file.
//
// Nothing throws. The button is clickable, the classes are right, a file even
// appears in Downloads. Eight call sites across two consoles shipped this way,
// including every "Export" and "Spreadsheet" button in the Stock module, while
// `lib/api/download.ts` sat in the same tree with "a plain `<a download href>`
// can't carry the Authorization header" written in its header comment.
//
// The fix is `DownloadButton`, which fetches with the token and saves the bytes.
// This check is what stops the anchor coming back.
// [[feedback_screen_over_a_function_nobody_calls]]
//
// ── What it looks for ────────────────────────────────────────────────────────
//
// Two shapes, because the defect wore the second one:
//
//   href="/v1/…"            an API path written in place
//   href={reportCsvPath(…)} a helper whose body RETURNS an API path
//
// The second is the one that hides: the call site says nothing about `/v1` at
// all, and the helper is three files away being perfectly reasonable. So the
// first pass reads both consoles for functions that return an api-rest path and
// collects their names, and the second pass flags any href bound to one.
//
// It does NOT object to those helpers existing. `api.get(reportCsvPath(…))` is
// exactly right — the client resolves the origin and attaches the token. The
// objection is only to an anchor.
//
// Zero dependencies on purpose: CI runs it with bare Node, no install.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

import { stripComments } from './lib/strip-comments.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Both consoles. A tree added outside this list is invisible here, which is why
 *  the file count is printed rather than a bare tick.
 *  [[feedback_structural_checks_go_blind]] */
const ROOTS = ['sparx/apps/workbench', 'piggles/apps/workbench'];

/**
 * Hrefs that genuinely may hold an api-rest path, with the reason.
 *
 * A route that is PUBLIC and unauthenticated can legitimately be linked, and
 * `/v1/public/media/...` is one. A name here without a reason beside it is how
 * this check stops meaning anything.
 */
const ALLOWED = {};

/** A string literal that is an api-rest path. */
const API_PATH = /^['"`]\/v1\//;

/** `function name(` — the only declaration form the console uses for these. */
const FUNCTION_AT = /(?:export\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g;

function die(lines) {
  console.error('');
  for (const line of lines) console.error(line);
  console.error('');
  process.exit(1);
}

const slash = (p) => relative(repoRoot, p).split(/[\\/]/).join('/');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'dist') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.ts') || name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

/**
 * Names of functions in this source whose body returns an api-rest path.
 *
 * Found by walking back from each `return '/v1/…'` to the nearest preceding
 * `function NAME(`. Crude on purpose: these helpers are one-expression path
 * builders sitting at the top level of a data module, never nested closures, and
 * a parser here would be more code than the thing it checks.
 */
function apiPathBuilders(code) {
  const names = new Set();
  for (const match of code.matchAll(/return\s+(['"`])\/v1\//g)) {
    const before = code.slice(0, match.index);
    let last = null;
    FUNCTION_AT.lastIndex = 0;
    let fn;
    while ((fn = FUNCTION_AT.exec(before)) !== null) last = fn[1];
    if (last) names.add(last);
  }
  return names;
}

const offenders = [];
let scanned = 0;
let builders = 0;

for (const root of ROOTS) {
  const full = join(repoRoot, root);
  if (!existsSync(full)) {
    die([
      `✖ check:api-hrefs cannot find ${root}.`,
      '   A scan root that no longer exists reports a clean pass over nothing.',
    ]);
  }

  const files = walk(full);
  const code = new Map(files.map((f) => [f, stripComments(readFileSync(f, 'utf8'))]));
  scanned += files.length;

  // Pass 1 — every helper in this console that builds an api-rest path.
  const paths = new Set();
  for (const src of code.values()) for (const name of apiPathBuilders(src)) paths.add(name);
  builders += paths.size;

  // Pass 2 — every href, checked against a literal and against that set.
  for (const [file, src] of code) {
    const rel = slash(file);
    for (const match of src.matchAll(/href=(\{?)([^\s>}]+)/g)) {
      const [, brace, raw] = match;
      const line = src.slice(0, match.index).split('\n').length;
      const where = `${rel}:${line}`;
      if (Object.hasOwn(ALLOWED, where)) continue;

      if (API_PATH.test(raw)) {
        offenders.push({ where, detail: `href=${brace}${raw}` });
        continue;
      }
      if (brace === '{') {
        const called = /^([A-Za-z_$][\w$]*)\(/.exec(raw)?.[1];
        if (called && paths.has(called)) {
          offenders.push({ where, detail: `href={${called}(…)} builds an api-rest path` });
        }
      }
    }
  }
}

if (offenders.length > 0) {
  die([
    `✖ ${String(offenders.length)} href(s) pointing at api-rest:`,
    '',
    ...offenders.map((o) => `   ${o.where}  ${o.detail}`),
    '',
    '   An anchor carries no bearer token, and a path with no origin resolves',
    "   against the console rather than the API — so this saves the console's",
    '   own HTML, or a 401, under the filename you asked for. It does not throw.',
    '',
    '   Use <DownloadButton path={…} filename="…" /> for a file, or',
    '   downloadServerFile() directly. If the route really is public and',
    '   unauthenticated, add the line to ALLOWED with the reason.',
  ]);
}

console.log(
  `✓ check:api-hrefs — no href points at api-rest (${String(scanned)} files, ` +
    `${String(builders)} api-path builders, ${String(Object.keys(ALLOWED).length)} named exceptions).`
);
