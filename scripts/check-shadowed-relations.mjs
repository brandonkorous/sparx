// Fails when a Prisma query asks for a RELATION that a client extension has
// already claimed the name of, so the join comes back null and nobody is told.
//
// WHAT A BUSINESS OWNER SAW. The first wholesale order this platform has ever
// taken, on its own detail screen:
//
//     Who bought it
//       Tamsin Vale
//       tamsin@loomandlarder.com
//
// and nothing else. The line under it reads "Wholesale customer: …" and has
// never rendered for anybody, on any order, in either console.
//
// WHY. `Customer.company` is two things at once:
//
//   20-crm-customers.prisma  company  Company?  @relation(fields: [companyId])
//   packages/db/src/client.ts  company  computed from `companyName`, because
//                                       that is the wire name ~120 payloads use
//
// The computed one wins. MEASURED 2026-09-20 against the running database:
//
//     A. company read directly   { companyName: 'Loom and Larder' }
//     B. relation via customer   { companyId: '9b6d…', company: null }
//     C. same join in raw SQL    [{ company_name: 'Loom and Larder' }]
//
// The row exists (A), raw SQL joins it (C), and Prisma hands back null (B).
// Nothing throws. The `select` is accepted, the query runs, the field is
// overwritten on the way out. [[feedback_absent_behaves_like_fine]]
//
// WHAT THIS CHECK CAN AND CANNOT SEE. It reads the extension in
// `packages/db/src/client.ts` for the model-and-field pairs it computes, and
// then fails on any `<field>:` select nested inside a `<model>:` select in the
// platform's own source. It cannot see a query built at runtime from a
// variable, and it does not try: a check that guesses reports working code as
// broken. [[feedback_codemod_diff_your_own_sweep]]
//
// Zero dependencies on purpose: CI runs it with bare Node, no install.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const CLIENT = 'wizeworks/packages/db/src/client.ts';

/** Where platform queries live. A tree added outside this list is invisible
 *  here, which is why the file count is printed rather than a bare tick.
 *  [[feedback_structural_checks_go_blind]] */
const ROOTS = ['wizeworks/packages', 'wizeworks/services'];

/**
 * Selects that are legitimate despite the name, with the reason.
 *
 * Keyed by `<repo-relative path>:<line>`. A name here without a reason beside
 * it is how this check stops meaning anything.
 */
const ALLOWED = {};

function die(lines) {
  console.error(lines.join('\n'));
  process.exit(1);
}

/** The `{ model: { field: … } }` pairs the client extension computes. */
function computedFields() {
  const full = join(repoRoot, CLIENT);
  if (!existsSync(full)) {
    die([
      `✖ check:shadowed cannot find ${CLIENT}.`,
      '   The extension is the whole question this check asks, so a missing file',
      '   is a failure rather than an empty pass.',
    ]);
  }
  const source = readFileSync(full, 'utf8');
  const at = source.indexOf('result: {');
  if (at < 0) {
    die([
      `✖ check:shadowed found no \`result: {\` block in ${CLIENT}.`,
      '   Either the extension moved or this parser is wrong. Either way the',
      '   answer below would be about the parser, not the code.',
    ]);
  }
  // Two levels of plain keys: model, then field. Enough for the shape this
  // file uses, and it fails loudly above if that shape changes.
  const block = source.slice(at);
  const pairs = [];
  const modelRe = /^\s{4}(\w+):\s*\{$/gm;
  let m;
  while ((m = modelRe.exec(block)) !== null) {
    const model = m[1];
    const rest = block.slice(m.index + m[0].length);
    const fieldRe = /^\s{6}(\w+):\s*\{$/gm;
    let f;
    while ((f = fieldRe.exec(rest)) !== null) {
      pairs.push({ model, field: f[1] });
      if (rest.slice(0, f.index).includes('\n    },')) break;
    }
  }
  if (pairs.length === 0) {
    die([
      `✖ check:shadowed parsed no computed fields out of ${CLIENT}.`,
      '   That is not a clean pass, it is a parse that found nothing.',
    ]);
  }
  return pairs;
}

function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', 'dist', 'generated'].includes(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

/** How far a line is indented. */
function indentOf(line) {
  return /^\s*/.exec(line)[0].length;
}

const offenders = [];
let scanned = 0;
let selects = 0;
const pairs = computedFields();

for (const root of ROOTS) {
  const full = join(repoRoot, root);
  if (!existsSync(full)) {
    die([
      `✖ check:shadowed cannot find ${root}.`,
      '   A scan root that no longer exists reports a clean pass over nothing.',
    ]);
  }
  for (const file of sourceFiles(full)) {
    scanned += 1;
    const rel = relative(repoRoot, file).split(sep).join('/');
    // The extension itself declares these names; it is not a query.
    if (rel === CLIENT) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue;
      for (const { model, field } of pairs) {
        if (!new RegExp(`^\\s*${field}:\\s*(\\{|true)`).test(line)) continue;
        selects += 1;
        const indent = indentOf(line);
        // Walk back for the `model: {` this sits inside, stopping at the first
        // close-brace shallower than us — that is the end of our object.
        for (let j = i - 1; j >= Math.max(0, i - 40); j -= 1) {
          const open = new RegExp(`^(\\s*)${model}:\\s*\\{`).exec(lines[j]);
          if (open && open[1].length < indent) {
            if (!Object.hasOwn(ALLOWED, `${rel}:${String(i + 1)}`)) {
              offenders.push({ rel, line: i + 1, model, field, text: line.trim() });
            }
            break;
          }
          if (/^\s*\}/.test(lines[j]) && indentOf(lines[j]) < indent) break;
        }
      }
    }
  }
}

if (offenders.length > 0) {
  die([
    `✖ ${String(offenders.length)} query(ies) ask for a relation whose name is already taken:`,
    '',
    ...offenders.map((o) => `   ${o.rel}:${String(o.line)}  ${o.model}.${o.field}  "${o.text}"`),
    '',
    '   The Prisma client extension in packages/db/src/client.ts publishes a',
    '   COMPUTED field of that name on that model, and the computed one wins.',
    '   The select is accepted, the query runs, and the field comes back as the',
    '   computed value instead of the join. Nothing throws.',
    '',
    '   Fetch it under a name of its own instead — see `accountsFor` in',
    '   packages/crm/src/services/order-service.ts, which attaches the business',
    '   as `b2bAccount` in one query per page rather than one per row.',
    '',
    '   If a select here is genuinely fine, add it to ALLOWED with the reason.',
  ]);
}

console.log(
  `✓ check:shadowed — ${String(selects)} select(s) of a computed name across ${String(scanned)} files, ` +
    `none of them nested under the model that shadows it (${String(pairs.length)} computed field(s): ` +
    `${pairs.map((p) => `${p.model}.${p.field}`).join(', ')}).`
);
