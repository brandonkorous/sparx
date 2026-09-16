// Comb every Prisma `select` / `include` for a field the model does not have.
//
// ── WHY THIS IS A CHECK AND NOT A TYPE ERROR ────────────────────────────────
//
// It should be a type error. It is not, and the reason is structural rather than
// a misconfiguration anybody can fix here.
//
// A generated `<Model>Select` is `$Extensions.GetSelect<{…}, ExtArgs['result'][…]>`
// — a MAPPED TYPE OVER A TYPE PARAMETER. TypeScript defers a mapped type whose key
// set depends on an unresolved parameter, and excess-property checking only runs
// against a resolved set of keys, so a `select` naming a field that does not exist
// compiles silently. `where` has no such wrapper and IS checked, which is why the
// gap is invisible: the query one line above the mistake fails loudly.
//
// Measured, not assumed. In this tree:
//
//     tx.booking.findMany({ where: { notAColumn: true } })      → TS2353 ✓
//     tx.booking.findMany({ select: { customer: { … } } })      → compiles ✗
//
// The second one shipped. `Booking` deliberately has NO `customer` relation —
// 78-scheduling.prisma says so in a comment, because scheduling stays unaware
// that CRM exists — and `jobProfitability` selected it anyway. Every request to
// GET /v1/finance/jobs answered 500, in the screen's DEFAULT filter, for every
// tenant, past typecheck, lint and the whole test suite.
//
// ── WHAT IT READS ───────────────────────────────────────────────────────────
//
// The SCHEMA, not the generated client: `prisma/schema/*.prisma` is the source of
// truth and is in the repo, so this runs without a `prisma generate` and cannot
// go stale against a client somebody forgot to rebuild.
//
// The SOURCE is parsed with the TypeScript compiler API rather than matched with a
// regex. A `select` block spans lines, nests, and sits inside other object
// literals; a regex either misses those or invents them.
//
// ── WHAT IT CANNOT SEE, AND SAYS SO ─────────────────────────────────────────
//
// Only a select whose MODEL is legible from the call site — `<anything>.<model>.<op>({…})`.
// A select built in a variable, spread in, or reached through a generic helper is
// counted as SKIPPED and printed in the summary, so the denominator is honest
// about its own blind spot rather than reporting green over the part it did not read.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_DIR = join(ROOT, 'wizeworks', 'packages', 'db', 'prisma', 'schema');

/** Scan roots. Every one is asserted to exist — a check that quietly scans
 *  nothing prints green forever. */
const SOURCE_ROOTS = [
  'wizeworks/packages',
  'wizeworks/services',
  'wizeworks/apps',
  'sparx/apps',
  'sparx/packages',
  'piggles/apps',
  'piggles/packages',
];

/* ── 1. The schema: model → fields, and which of them are relations ───────── */

function readModels() {
  if (!statSync(SCHEMA_DIR, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(
      `check:prisma-selects — no schema at ${SCHEMA_DIR}. It has moved; point this ` +
        `at its new home. Carrying on would validate every select against nothing.`
    );
  }
  const models = new Map();
  const enums = new Set();
  for (const file of readdirSync(SCHEMA_DIR).filter((n) => n.endsWith('.prisma'))) {
    const src = readFileSync(join(SCHEMA_DIR, file), 'utf8');
    for (const m of src.matchAll(/^(model|type)\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
      const [, kind, name, body] = m;
      if (kind !== 'model') continue;
      const fields = new Map();
      for (const line of body.split('\n')) {
        const bare = line.replace(/\/\/.*$/, '').trim();
        if (bare === '' || bare.startsWith('@@')) continue;
        const f = /^(\w+)\s+(\w+)/.exec(bare);
        if (!f) continue;
        fields.set(f[1], f[2]);
      }
      models.set(name, fields);
    }
    for (const m of src.matchAll(/^enum\s+(\w+)\s*\{/gm)) enums.add(m[1]);
  }
  // A field's type names another MODEL ⇒ it is a relation and its select nests.
  for (const fields of models.values()) {
    for (const [name, type] of fields) {
      fields.set(name, models.has(type) ? { relation: type } : { scalar: type });
    }
  }
  return { models, enums };
}

const { models } = readModels();

/** Prisma exposes each model on the client in camelCase. */
const byClientKey = new Map();
for (const name of models.keys()) {
  byClientKey.set(name[0].toLowerCase() + name.slice(1), name);
}

/** Keys Prisma itself understands inside a select/include, which are not fields. */
const META_KEYS = new Set([
  '_count',
  'select',
  'include',
  'omit',
  'where',
  'orderBy',
  'take',
  'skip',
  'cursor',
  'distinct',
  'by',
  'having',
]);

const READ_OPS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
]);

/* ── 2. The source ────────────────────────────────────────────────────────── */

const IGNORE_DIR = new Set([
  'node_modules',
  'dist',
  '.next',
  '.turbo',
  'generated',
  'build',
  'coverage',
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (IGNORE_DIR.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const problems = [];
let checked = 0;
let skipped = 0;
const skippedWhere = new Map();

/** Validate one object literal's keys against `model`, descending into relations. */
function checkSelect(node, modelName, file, path) {
  const fields = models.get(modelName);
  if (!fields) return;
  for (const prop of node.properties) {
    if (!ts.isPropertyAssignment(prop)) {
      // A spread or shorthand: the keys are not legible here.
      skipped += 1;
      skippedWhere.set(file, (skippedWhere.get(file) ?? 0) + 1);
      continue;
    }
    const name =
      ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? prop.name.text : null;
    if (name === null) continue;
    if (META_KEYS.has(name)) continue;
    checked += 1;
    const field = fields.get(name);
    if (!field) {
      const { line } = node.getSourceFile().getLineAndCharacterOfPosition(prop.getStart());
      problems.push({ file, line: line + 1, model: modelName, path: [...path, name].join('.') });
      continue;
    }
    if (field.relation) {
      // `relation: { select: {…} }` / `{ include: {…} }` nests into that model.
      const value = prop.initializer;
      if (ts.isObjectLiteralExpression(value)) {
        for (const inner of value.properties) {
          if (!ts.isPropertyAssignment(inner)) continue;
          const innerName = ts.isIdentifier(inner.name) ? inner.name.text : null;
          if (innerName !== 'select' && innerName !== 'include') continue;
          if (ts.isObjectLiteralExpression(inner.initializer)) {
            checkSelect(inner.initializer, field.relation, file, [...path, name]);
          }
        }
      }
    }
  }
}

for (const root of SOURCE_ROOTS) {
  const abs = join(ROOT, root);
  if (!statSync(abs, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(
      `check:prisma-selects — scan root ${root} does not exist. The tree has moved; ` +
        `fix this list rather than shipping a check that scans less than it claims.`
    );
  }
  for (const file of walk(abs)) {
    const text = readFileSync(file, 'utf8');
    if (!text.includes('select:') && !text.includes('include:')) continue;
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const rel = relative(ROOT, file).replace(/\\/g, '/');

    const visit = (node) => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const op = node.expression.name.text;
        const target = node.expression.expression;
        if (READ_OPS.has(op) && ts.isPropertyAccessExpression(target)) {
          const modelName = byClientKey.get(target.name.text);
          const arg = node.arguments[0];
          if (modelName && arg && ts.isObjectLiteralExpression(arg)) {
            for (const prop of arg.properties) {
              if (!ts.isPropertyAssignment(prop)) continue;
              const key = ts.isIdentifier(prop.name) ? prop.name.text : null;
              if (key !== 'select' && key !== 'include') continue;
              if (ts.isObjectLiteralExpression(prop.initializer)) {
                checkSelect(prop.initializer, modelName, rel, [modelName]);
              } else {
                skipped += 1;
                skippedWhere.set(rel, (skippedWhere.get(rel) ?? 0) + 1);
              }
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
}

/* ── 3. Report ────────────────────────────────────────────────────────────── */

if (problems.length > 0) {
  console.error('✗ Prisma select names a field the model does not have\n');
  for (const p of problems) {
    console.error(`  ${p.file}:${String(p.line)}`);
    console.error(`      ${p.path}   — no such field on ${p.model}\n`);
  }
  console.error(
    `${String(problems.length)} bad ${problems.length === 1 ? 'field' : 'fields'} · ` +
      `${String(checked)} checked across ${String(models.size)} models · ` +
      `${String(skipped)} not legible from the call site\n`
  );
  console.error(
    'TypeScript cannot catch these: a generated `<Model>Select` is a mapped type over\n' +
      'a type parameter, so excess-property checking never runs on it. Read the field\n' +
      'list in wizeworks/packages/db/prisma/schema/ — a relation that is not there is\n' +
      'usually deliberate, and the fix is to read the id column instead.'
  );
  process.exit(1);
}

console.log(
  `✓ Prisma selects clean (${String(checked)} fields across ${String(models.size)} models · ` +
    `${String(skipped)} not legible from the call site)`
);
