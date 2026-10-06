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
// ── AND A `where` ONE RELATION DOWN ─────────────────────────────────────────
//
// "`where` IS checked" is true at the top level only. A filter THROUGH a relation
// (`order: { deletedAt: null }`) is typed `XOR<RelationFilter, WhereInput>`, and a
// union defeats excess-property checking just as the mapped type does. Measured:
//
//     tx.orderItem.findMany({ where: { order: { deletedAt: null } } })   → compiles ✗
//
// `Order` has no `deletedAt`. That shipped in the Cores owed list (sparx persona
// issue 057) and answered every request with a Prisma error, past typecheck and a
// service test that mocked the client. So every `where` is walked too: its keys
// against the model, descending through relation filters (`is`, `some`, …), `AND`,
// `OR` and `NOT`, and the `where` inside a nested relation select.
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
// A select held in a `const` in the same file is followed and read like an inline
// one. A select imported from another file, spread in, or reached through a generic helper is
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
        // A compound unique or id is a legal `where` key on its own: the name it was
        // given, or its fields joined by `_` (`tenantId_sku`).
        const compound = /^@@(?:unique|id)\(\s*(?:fields:\s*)?\[([^\]]*)\](.*)\)/.exec(bare);
        if (compound) {
          const named = /name:\s*"(\w+)"/.exec(compound[2] ?? '');
          const key =
            named?.[1] ??
            compound[1]
              .split(',')
              .map((f) => f.trim().replace(/\(.*$/, ''))
              .join('_');
          fields.set(key, 'Compound');
          continue;
        }
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

/* A select written apart from its query — `const PRODUCT_SELECT = {…} as const`
 * and then `select: PRODUCT_SELECT` — used to be counted as not legible and
 * skipped. That is how `optionValues` (no such relation on ProductVariant; it is
 * `optionAssignments`) reached the Core charges set up as choices screen, which
 * answered every request with a Prisma error (sparx persona issue 057). Its row
 * type was written by hand behind a cast, so typecheck had nothing to compare.
 * A `const` object in the same file is as legible as one written inline. */

/** Every `const NAME = { … }` in the file, unwrapped of `as` / `satisfies`. */
function constObjectsOf(sf) {
  const out = new Map();
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isVariableDeclarationList(node.parent) &&
      (node.parent.flags & ts.NodeFlags.Const) !== 0
    ) {
      const literal = unwrap(node.initializer);
      if (ts.isObjectLiteralExpression(literal)) out.set(node.name.text, literal);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

function unwrap(expr) {
  let e = expr;
  while (ts.isAsExpression(e) || ts.isSatisfiesExpression(e) || ts.isParenthesizedExpression(e)) {
    e = e.expression;
  }
  return e;
}

let fileConsts = new Map();

/** The object literal an expression stands for: written inline, or a same-file const. */
function literalOf(expr) {
  const e = unwrap(expr);
  if (ts.isObjectLiteralExpression(e)) return e;
  if (ts.isIdentifier(e)) return fileConsts.get(e.text) ?? null;
  return null;
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
          const innerValue = literalOf(inner.initializer);
          if (innerName === 'where' && innerValue) {
            checkWhere(innerValue, field.relation, file, [...path, name]);
            continue;
          }
          if (innerName !== 'select' && innerName !== 'include') continue;
          if (innerValue) checkSelect(innerValue, field.relation, file, [...path, name]);
        }
      }
    }
  }
}

/** Keys Prisma understands inside a `where`, which are not fields. */
const WHERE_LOGIC = new Set(['AND', 'OR', 'NOT']);
const RELATION_FILTERS = new Set(['is', 'isNot', 'some', 'every', 'none']);

function noteSkipped(file) {
  skipped += 1;
  skippedWhere.set(file, (skippedWhere.get(file) ?? 0) + 1);
}

/** Validate a `where` object's keys against `modelName`, through relations. */
function checkWhere(node, modelName, file, path) {
  const fields = models.get(modelName);
  if (!fields) return;
  for (const prop of node.properties) {
    if (!ts.isPropertyAssignment(prop)) {
      noteSkipped(file);
      continue;
    }
    const name =
      ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? prop.name.text : null;
    if (name === null) continue;
    const value = prop.initializer;
    if (WHERE_LOGIC.has(name)) {
      const parts = ts.isArrayLiteralExpression(value) ? value.elements : [value];
      for (const part of parts) {
        if (ts.isObjectLiteralExpression(part)) checkWhere(part, modelName, file, path);
      }
      continue;
    }
    checked += 1;
    const field = fields.get(name);
    if (!field) {
      const { line } = node.getSourceFile().getLineAndCharacterOfPosition(prop.getStart());
      problems.push({ file, line: line + 1, model: modelName, path: [...path, name].join('.') });
      continue;
    }
    if (!field.relation || !ts.isObjectLiteralExpression(value)) continue;
    const keys = value.properties
      .filter(ts.isPropertyAssignment)
      .map((p) => (ts.isIdentifier(p.name) ? p.name.text : null));
    if (keys.some((k) => k !== null && RELATION_FILTERS.has(k))) {
      for (const inner of value.properties) {
        if (!ts.isPropertyAssignment(inner) || !ts.isIdentifier(inner.name)) continue;
        if (!RELATION_FILTERS.has(inner.name.text)) continue;
        if (ts.isObjectLiteralExpression(inner.initializer)) {
          checkWhere(inner.initializer, field.relation, file, [...path, name]);
        }
      }
    } else {
      // A to-one relation takes its model's where directly.
      checkWhere(value, field.relation, file, [...path, name]);
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
    if (!text.includes('select:') && !text.includes('include:') && !text.includes('where:'))
      continue;
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    fileConsts = constObjectsOf(sf);

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
              if (key === 'where') {
                const where = literalOf(prop.initializer);
                if (where) checkWhere(where, modelName, rel, [modelName]);
                continue;
              }
              if (key !== 'select' && key !== 'include') continue;
              const select = literalOf(prop.initializer);
              if (select) {
                checkSelect(select, modelName, rel, [modelName]);
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
  console.error('✗ A Prisma select or where names a field the model does not have\n');
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
      'a type parameter, and a filter through a relation is a union, so excess-property\n' +
      'checking never runs on either. Read the field\n' +
      'list in wizeworks/packages/db/prisma/schema/ — a relation that is not there is\n' +
      'usually deliberate, and the fix is to read the id column instead.'
  );
  process.exit(1);
}

console.log(
  `✓ Prisma selects and wheres clean (${String(checked)} fields across ${String(models.size)} models · ` +
    `${String(skipped)} not legible from the call site)`
);
