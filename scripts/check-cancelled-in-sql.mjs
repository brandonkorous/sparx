// Every hand-written SQL query that compares a status to 'canceled' (one L).
//
// ── WHY ─────────────────────────────────────────────────────────────────────
//
// sparx stores the word with two L's: orders, pick lists, boxes, supplier bills,
// purchase orders and approvals are all CHECK-constrained to 'cancelled'. A raw
// query written with the American spelling compares against a value no row can
// hold, so `status <> 'canceled'` is true for EVERY row and quietly filters
// nothing. Eleven queries did it at once (sparx persona issue 059):
//
//   - the revenue report and the B2B report counted cancelled orders as sales;
//   - a cancelled pick list or box kept its units "claimed" forever, so they could
//     never be picked or packed again;
//   - the fill-rate report, the landing-page revenue report, the GL reconciliation
//     and the packing slip all read cancelled rows as live.
//
// Nothing fails. Typecheck cannot see inside a SQL string and the queries return
// rows, just the wrong ones. The American-spelling rule is right for words a
// person reads and wrong for this one, which is a stored value; the spelling check
// already exempts it as a wire value, and this is the other half.
//
// A payment provider's own status ('canceled', as Stripe spells it) is not this
// and is never compared in raw SQL here. A query that genuinely means a
// provider's word can say so with `-- provider spelling` on the same line.
//
// ── WHAT IT READS ───────────────────────────────────────────────────────────
//
// Tagged templates whose tag is `$queryRaw`, `$executeRaw`, `Prisma.sql` or
// `sql`, parsed with the TypeScript compiler API. The count of queries read is
// printed, so a scan of nothing cannot pass for a clean tree.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_ROOTS = [
  'wizeworks/packages',
  'wizeworks/services',
  'wizeworks/apps',
  'sparx/apps',
  'sparx/packages',
  'piggles/apps',
  'piggles/packages',
];
const IGNORE_DIR = new Set([
  'node_modules',
  'dist',
  '.next',
  '.turbo',
  'generated',
  'build',
  'coverage',
]);
const SQL_TAG = /(?:\$queryRaw|\$executeRaw|Prisma\.sql|^sql)$/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (IGNORE_DIR.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mts)$/.test(name) && !name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const problems = [];
let queries = 0;

for (const root of SOURCE_ROOTS) {
  const abs = join(ROOT, root);
  if (!statSync(abs, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(
      `check:cancelled-in-sql — scan root ${root} does not exist. The tree has moved; ` +
        `fix this list rather than shipping a check that scans less than it claims.`
    );
  }
  for (const file of walk(abs)) {
    const text = readFileSync(file, 'utf8');
    if (!/queryRaw|executeRaw|sql`/.test(text)) continue;
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node) => {
      if (ts.isTaggedTemplateExpression(node) && SQL_TAG.test(node.tag.getText(sf))) {
        queries += 1;
        const body = node.template.getText(sf);
        body.split('\n').forEach((line, i) => {
          if (!/'canceled'/i.test(line) || /--\s*provider spelling/.test(line)) return;
          const start = sf.getLineAndCharacterOfPosition(node.template.getStart(sf)).line;
          problems.push({
            file: relative(ROOT, file).replace(/\\/g, '/'),
            line: start + i + 1,
            text: line.trim(),
          });
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
}

if (queries === 0) {
  console.error('✗ check:cancelled-in-sql read no SQL at all. The tags or the roots have moved.');
  process.exit(1);
}

if (problems.length > 0) {
  console.error("✗ A SQL query compares a status to 'canceled'; sparx stores 'cancelled'\n");
  for (const p of problems) console.error(`  ${p.file}:${String(p.line)}\n      ${p.text}\n`);
  console.error(
    `${String(problems.length)} of ${String(queries)} queries. The comparison matches no row,\n` +
      "so the filter it was meant to apply does nothing. Write 'cancelled'."
  );
  process.exit(1);
}

console.log(`✓ No SQL compares a status to 'canceled' (${String(queries)} queries read)`);
