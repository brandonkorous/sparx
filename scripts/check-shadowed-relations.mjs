// Fails when platform code asks for, or reads, a RELATION that a Prisma client
// extension has already claimed the name of, so the join comes back as the
// computed value (or null) and nobody is told.
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
// Nothing throws. And the client is cast back to the plain `PrismaClient`
// type, so TypeScript still believes `customer.company` is the account and
// happily compiles `customer.company.creditLimit`, which is always undefined.
// [[feedback_absent_behaves_like_fine]]
//
// IT KEPT HAPPENING. The first version of this check was a regex that looked
// for `company:` nested under a key spelled `customer:`. It passed while four
// more shipped: the approvals queue's account names (issue 751), the held-order
// approval reading payment terms, the customer search projection, and segment
// rules on `b2bAccount.*`, which compared every pricing tier and credit
// utilization against the employer string. Two of those were a top-level
// `tx.customer.findUnique({ include: { company: … } })`, a shape the regex
// could not see because nothing above it was spelled `customer:`.
//
// ── WHAT IT READS NOW ───────────────────────────────────────────────────────
//
// The source is parsed with the TypeScript compiler API, and the model at every
// level of a select is worked out from the SCHEMA, so the shape does not matter:
//
//   1. a query ON the model:   tx.customer.findUnique({ include: { company } })
//   2. a select THROUGH it:    order: { include: { customer: { select: { company } } } }
//      under any relation name that points at Customer, at any depth
//   3. a select written apart: `const X = {…} satisfies Prisma.CustomerSelect`,
//      a same-file const passed in, or a `Prisma.CustomerGetPayload<{…}>` type
//   4. a select defined in one file and used in another: any object anywhere
//      with `customer: { select|include: { company } }` (the old net, kept)
//   5. a READ that treats the computed string as the account:
//      `x.customer.company.creditLimit`, `customer?.company?.status`, a
//      destructured `{ company }` read the same way, or a row of a
//      `tx.customer.find*` result read the same way. A String method
//      (`customer.company?.trim()`) is the computed field used correctly and
//      passes.
//
// ── WHAT IT CANNOT SEE, AND WHAT IT DOES ABOUT IT ───────────────────────────
//
// A select on the shadowed model that is not legible here (imported from
// another file, built by a call, spread in from a parameter) cannot be cleared
// by reading it. That is not a pass: it is REFUSED by name, and the only way
// past is an UNREADABLE entry below with the reason a person checked it. A
// read of `company` on a value whose name says nothing about being a customer
// (`row.company.x` on a row from an untyped helper) is beyond a syntax check,
// and the summary says so rather than implying it looked.
//
// It proves itself before every run: a set of fixtures, one per shape, each of
// which must come out red, plus the legitimate shapes, which must come out
// green. A parser change that blinds it fails the check, not the build after.
// [[feedback_a_test_that_cannot_go_red]] [[feedback_structural_checks_go_blind]]
//
// It parses with the `typescript` package, so it runs after an install: in the
// pre-push guard and in CI's Prettier job, beside check:prisma-selects.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT = 'wizeworks/packages/db/src/client.ts';
const SCHEMA_DIR = 'wizeworks/packages/db/prisma/schema';

/** Where platform queries and the screens over them live. Every root is
 *  asserted to exist, and the file count is printed, so a moved tree cannot
 *  turn this into a clean pass over nothing. */
const SOURCE_ROOTS = [
  'wizeworks/packages',
  'wizeworks/services',
  'wizeworks/apps',
  'sparx/apps',
  'sparx/packages',
  'piggles/apps',
  'piggles/packages',
];

/**
 * Selects on the shadowed model that this check cannot read, each checked by a
 * person, with the reason. Keyed by `<repo-relative path>#<the expression as
 * written>`, so an entry survives a line moving and dies with the code it
 * describes. A key here without a reason is how this check stops meaning
 * anything.
 */
const UNREADABLE = {};

function die(lines) {
  console.error(lines.join('\n'));
  process.exit(1);
}

/* ── 1. The schema: model → field → relation target ────────────────────────── */

function readModels() {
  const dir = join(ROOT, SCHEMA_DIR);
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
    die([
      `✖ check:shadowed cannot find the schema at ${SCHEMA_DIR}.`,
      '   Without it no select can be traced to its model, so carrying on would',
      '   report a clean pass over a guess.',
    ]);
  }
  const models = new Map();
  for (const file of readdirSync(dir).filter((n) => n.endsWith('.prisma'))) {
    const src = readFileSync(join(dir, file), 'utf8');
    for (const m of src.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
      const fields = new Map();
      for (const line of m[2].split('\n')) {
        const bare = line.replace(/\/\/.*$/, '').trim();
        if (bare === '' || bare.startsWith('@@')) continue;
        const f = /^(\w+)\s+(\w+)/.exec(bare);
        if (f) fields.set(f[1], f[2]);
      }
      models.set(m[1], fields);
    }
  }
  if (models.size === 0) die([`✖ check:shadowed parsed no models out of ${SCHEMA_DIR}.`]);
  // Keep only relation targets; a scalar field nests nothing.
  for (const fields of models.values()) {
    for (const [name, type] of fields) fields.set(name, models.has(type) ? type : null);
  }
  return models;
}

const models = readModels();
const byClientKey = new Map([...models.keys()].map((n) => [n[0].toLowerCase() + n.slice(1), n]));

/* ── 2. The extension: which model-and-field pairs it computes ──────────────── */

function unwrap(expr) {
  let e = expr;
  while (
    ts.isAsExpression(e) ||
    ts.isSatisfiesExpression(e) ||
    ts.isParenthesizedExpression(e) ||
    ts.isNonNullExpression(e) ||
    ts.isTypeAssertionExpression(e) ||
    ts.isAwaitExpression(e)
  ) {
    e = e.expression;
  }
  return e;
}

function keyOf(prop) {
  const n = prop.name;
  if (!n) return null;
  if (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
    return n.text;
  }
  return null;
}

function computedFields() {
  const full = join(ROOT, CLIENT);
  if (!statSync(full, { throwIfNoEntry: false })?.isFile()) {
    die([
      `✖ check:shadowed cannot find ${CLIENT}.`,
      '   The extension is the whole question this check asks, so a missing file',
      '   is a failure rather than an empty pass.',
    ]);
  }
  const sf = ts.createSourceFile(full, readFileSync(full, 'utf8'), ts.ScriptTarget.Latest, true);
  let result = null;
  const visit = (node) => {
    if (
      ts.isPropertyAssignment(node) &&
      keyOf(node) === 'result' &&
      ts.isObjectLiteralExpression(unwrap(node.initializer))
    ) {
      result = unwrap(node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (!result) {
    die([
      `✖ check:shadowed found no \`result: { … }\` extension in ${CLIENT}.`,
      '   Either the extension moved or this parser is wrong. Either way the',
      '   answer below would be about the parser, not the code.',
    ]);
  }
  const pairs = [];
  for (const modelProp of result.properties) {
    const clientKey = ts.isPropertyAssignment(modelProp) ? keyOf(modelProp) : null;
    const fields = clientKey ? unwrap(modelProp.initializer) : null;
    const model = clientKey ? byClientKey.get(clientKey) : null;
    if (!model || !fields || !ts.isObjectLiteralExpression(fields)) {
      die([
        `✖ check:shadowed cannot read an entry of the result extension in ${CLIENT}:`,
        `   ${modelProp.getText(sf).split('\n')[0]}`,
        '   Every entry must be `<model>: { <field>: { needs, compute } }` written out,',
        '   or this check would not know which names it is guarding.',
      ]);
    }
    for (const fieldProp of fields.properties) {
      const field = ts.isPropertyAssignment(fieldProp) ? keyOf(fieldProp) : null;
      if (!field) {
        die([
          `✖ check:shadowed cannot read a computed field of ${clientKey} in ${CLIENT}:`,
          `   ${fieldProp.getText(sf).split('\n')[0]}`,
        ]);
      }
      pairs.push({ model, field, relation: models.get(model).get(field) ?? null });
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

const pairs = computedFields();
/** Model → the names on it a computed field has taken. */
const shadowed = new Map();
for (const { model, field } of pairs) {
  if (!shadowed.has(model)) shadowed.set(model, new Set());
  shadowed.get(model).add(field);
}
/** Relation names that only ever point at a model with a shadowed name, so an
 *  object keyed by one is a select on that model wherever it is written. */
const relationNamesInto = new Map();
for (const fields of models.values()) {
  for (const [name, target] of fields) {
    if (!target) continue;
    if (!relationNamesInto.has(name)) relationNamesInto.set(name, new Set());
    relationNamesInto.get(name).add(target);
  }
}
const onlyInto = new Map();
for (const [name, targets] of relationNamesInto) {
  if (targets.size === 1) {
    const [target] = targets;
    if (shadowed.has(target)) onlyInto.set(name, target);
  }
}

/** Members a string answers, so reading one off the computed value is the
 *  computed value used as what it is. */
const STRING_MEMBERS = new Set(Object.getOwnPropertyNames(String.prototype));

const QUERY_OPS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'create',
  'createManyAndReturn',
  'update',
  'updateManyAndReturn',
  'upsert',
  'delete',
]);
const ARRAY_OPS = new Set(['findMany', 'createManyAndReturn', 'updateManyAndReturn']);
const ARRAY_CALLBACKS = new Set([
  'map',
  'forEach',
  'filter',
  'find',
  'findLast',
  'some',
  'every',
  'flatMap',
  'sort',
  'toSorted',
]);
const SELECTION_KEYS = new Set(['select', 'include', 'omit']);
const ARGS_TYPE_SUFFIXES = [
  'FindManyArgs',
  'FindFirstArgs',
  'FindFirstOrThrowArgs',
  'FindUniqueArgs',
  'FindUniqueOrThrowArgs',
  'CreateArgs',
  'UpdateArgs',
  'UpsertArgs',
  'DeleteArgs',
  'DefaultArgs',
];
const SELECTION_TYPE_SUFFIXES = ['Select', 'Include', 'Omit'];

/** `Prisma.<Model>Select` → [model, 'selection'], `Prisma.<Model>FindManyArgs` → [model, 'args']. */
function typedAs(typeNode) {
  if (!typeNode || !ts.isTypeReferenceNode(typeNode)) return null;
  const name = ts.isQualifiedName(typeNode.typeName)
    ? typeNode.typeName.right.text
    : typeNode.typeName.text;
  for (const suffix of ARGS_TYPE_SUFFIXES) {
    if (name.endsWith(suffix) && models.has(name.slice(0, -suffix.length))) {
      return [name.slice(0, -suffix.length), 'args'];
    }
  }
  for (const suffix of SELECTION_TYPE_SUFFIXES) {
    if (name.endsWith(suffix) && models.has(name.slice(0, -suffix.length))) {
      return [name.slice(0, -suffix.length), 'selection'];
    }
  }
  return null;
}

/** Exported consts written as a typed select (`export const X = {…} satisfies
 *  Prisma.CustomerSelect`). Each is walked in its own file, so a file that
 *  imports one has had it read already: name → Set of `<Model>:<kind>`. */
function typedExportsOf(rel, text, into) {
  if (!text.includes('export') || !/(?:Select|Include|Omit|Args)\b/.test(text)) return;
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    if (!stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
      let t = typedAs(decl.type);
      let e = decl.initializer;
      while (!t && (ts.isSatisfiesExpression(e) || ts.isAsExpression(e))) {
        t = typedAs(e.type);
        e = e.expression;
      }
      if (!t) continue;
      if (!into.has(decl.name.text)) into.set(decl.name.text, new Set());
      into.get(decl.name.text).add(`${t[0]}:${t[1]}`);
    }
  }
}

/* ── 3. One file ────────────────────────────────────────────────────────────── */

/**
 * Everything wrong with one source file. Exported in spirit for the self-test
 * below: the fixtures go through exactly this function.
 */
function analyze(rel, text, typedExports) {
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const offenders = [];
  const refusals = [];
  const seen = new Set();
  const stats = { selects: 0, reads: 0 };

  const lineOf = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  const offend = (node, kind, what) => {
    const at = `${String(node.getStart(sf))}`;
    if (seen.has(at)) return;
    seen.add(at);
    offenders.push({ rel, line: lineOf(node), kind, what, text: node.getText(sf).split('\n')[0] });
  };
  const refuse = (node, model, why) => {
    const at = `r${String(node.getStart(sf))}`;
    if (seen.has(at)) return;
    seen.add(at);
    const snippet = node.getText(sf).replace(/\s+/g, ' ').slice(0, 120);
    if (Object.hasOwn(UNREADABLE, `${rel}#${snippet}`)) return;
    refusals.push({ rel, line: lineOf(node), model, why, text: snippet });
  };

  // Same-file `const NAME = …`, so a select written apart is read like an inline one.
  const consts = new Map();
  (function collect(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isVariableDeclarationList(node.parent) &&
      (node.parent.flags & ts.NodeFlags.Const) !== 0
    ) {
      consts.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, collect);
  })(sf);

  // Imported names, local → exported, so an imported typed select is known.
  const imports = new Map();
  for (const stmt of sf.statements) {
    const named = ts.isImportDeclaration(stmt) ? stmt.importClause?.namedBindings : undefined;
    if (!named || !ts.isNamedImports(named)) continue;
    for (const el of named.elements) imports.set(el.name.text, (el.propertyName ?? el.name).text);
  }

  /** The object literals an expression can stand for, or null when it is not
   *  legible here. `true`/`false`/`undefined` stand for no literal at all. */
  function literalsOf(expr, depth = 0) {
    if (depth > 8) return null;
    const e = unwrap(expr);
    if (ts.isObjectLiteralExpression(e)) return [e];
    if (
      e.kind === ts.SyntaxKind.TrueKeyword ||
      e.kind === ts.SyntaxKind.FalseKeyword ||
      e.kind === ts.SyntaxKind.NullKeyword ||
      (ts.isIdentifier(e) && e.text === 'undefined')
    ) {
      return [];
    }
    if (ts.isIdentifier(e) && consts.has(e.text)) return literalsOf(consts.get(e.text), depth + 1);
    // Imported: legible only as a typed select its own file was checked for.
    if (ts.isIdentifier(e) && imports.has(e.text))
      return [{ imported: imports.get(e.text), node: e }];
    if (ts.isConditionalExpression(e)) {
      const a = literalsOf(e.whenTrue, depth + 1);
      const b = literalsOf(e.whenFalse, depth + 1);
      return a && b ? [...a, ...b] : null;
    }
    if (
      ts.isBinaryExpression(e) &&
      e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
    ) {
      return literalsOf(e.right, depth + 1);
    }
    return null;
  }

  /** The `{ where, select, include, … }` argument of a query on `model`. */
  function walkArgs(expr, model) {
    const lits = literalsOf(expr);
    if (lits === null) {
      if (shadowed.has(model)) refuse(expr, model, `the arguments of a query on ${model}`);
      return;
    }
    for (const lit of lits) {
      if (lit.imported) {
        if (shadowed.has(model) && !typedExports.get(lit.imported)?.has(`${model}:args`)) {
          refuse(lit.node, model, `the arguments of a query on ${model}, imported untyped`);
        }
        continue;
      }
      for (const prop of lit.properties) {
        if (ts.isSpreadAssignment(prop)) {
          walkArgs(prop.expression, model);
          continue;
        }
        const key = keyOf(prop);
        if (!key || !SELECTION_KEYS.has(key)) continue;
        if (ts.isShorthandPropertyAssignment(prop)) {
          walkSelection(prop.name, model);
        } else if (ts.isPropertyAssignment(prop)) {
          walkSelection(prop.initializer, model);
        }
      }
    }
  }

  /** A `select` / `include` / `omit` object on `model`. */
  function walkSelection(expr, model) {
    const lits = literalsOf(expr);
    if (lits === null) {
      if (shadowed.has(model)) refuse(expr, model, `a select on ${model}`);
      return;
    }
    const taken = shadowed.get(model);
    for (const lit of lits) {
      if (lit.imported) {
        if (shadowed.has(model) && !typedExports.get(lit.imported)?.has(`${model}:selection`)) {
          refuse(lit.node, model, `a select on ${model}, imported untyped`);
        }
        continue;
      }
      for (const prop of lit.properties) {
        if (ts.isSpreadAssignment(prop)) {
          walkSelection(prop.expression, model);
          continue;
        }
        const key = keyOf(prop);
        if (!key) {
          if (taken && ts.isPropertyAssignment(prop)) {
            refuse(prop, model, `a computed key in a select on ${model}`);
          }
          continue;
        }
        stats.selects += 1;
        if (taken?.has(key)) {
          offend(prop, 'select', `${model}.${key}`);
          continue;
        }
        const target = models.get(model)?.get(key);
        if (!target || !ts.isPropertyAssignment(prop)) continue;
        // `relation: { select | include: … }` nests into the target model.
        walkArgs(prop.initializer, target);
      }
    }
  }

  /** The same walk over a TYPE: `Prisma.CustomerGetPayload<{ include: { company: true } }>`. */
  function walkTypeArgs(typeNode, model) {
    if (ts.isTypeQueryNode(typeNode) && ts.isIdentifier(typeNode.exprName)) {
      const init = consts.get(typeNode.exprName.text);
      if (init) walkArgs(init, model);
      else if (shadowed.has(model)) refuse(typeNode, model, `a payload type on ${model}`);
      return;
    }
    if (!ts.isTypeLiteralNode(typeNode)) return;
    for (const member of typeNode.members) {
      const key = ts.isPropertySignature(member) ? keyOf(member) : null;
      if (key && SELECTION_KEYS.has(key) && member.type) walkTypeSelection(member.type, model);
    }
  }
  function walkTypeSelection(typeNode, model) {
    if (!ts.isTypeLiteralNode(typeNode)) return;
    const taken = shadowed.get(model);
    for (const member of typeNode.members) {
      const key = ts.isPropertySignature(member) ? keyOf(member) : null;
      if (!key) continue;
      stats.selects += 1;
      if (taken?.has(key)) {
        offend(member, 'select', `${model}.${key}`);
        continue;
      }
      const target = models.get(model)?.get(key);
      if (target && member.type) walkTypeArgs(member.type, target);
    }
  }

  // ── Names in this file that hold a customer row, by the scope they live in.
  /** scope node → Set of names bound to a row of a model with a shadowed name. */
  const rowNames = new Map();
  /** scope node → Set of names bound to the shadowed VALUE itself (`const { company } = customer`). */
  const valueNames = new Map();
  const bind = (map, scope, name) => {
    if (!map.has(scope)) map.set(scope, new Set());
    map.get(scope).add(name);
  };
  const scopeOf = (node) => {
    let n = node.parent;
    while (n && !ts.isFunctionLike(n) && !ts.isSourceFile(n) && !ts.isBlock(n)) n = n.parent;
    // A block inside a function is still that function's for our purpose.
    while (n && ts.isBlock(n) && n.parent && ts.isFunctionLike(n.parent)) n = n.parent;
    return n ?? sf;
  };
  const boundIn = (map, node, name) => {
    for (let n = node; n; n = n.parent) {
      if (map.get(n)?.has(name)) return true;
    }
    return false;
  };

  /** A query on a model with a shadowed name: `[model, isArray]`, else null. */
  function queryOn(expr) {
    const e = unwrap(expr);
    if (!ts.isCallExpression(e) || !ts.isPropertyAccessExpression(e.expression)) return null;
    const op = e.expression.name.text;
    const target = e.expression.expression;
    if (!QUERY_OPS.has(op) || !ts.isPropertyAccessExpression(target)) return null;
    const model = byClientKey.get(target.name.text);
    return model && shadowed.has(model) ? [model, ARRAY_OPS.has(op)] : null;
  }

  /** Does this expression name a row of a model with a shadowed name? */
  function isRow(expr) {
    const e = unwrap(expr);
    if (ts.isIdentifier(e)) return /customer$/i.test(e.text) || boundIn(rowNames, e, e.text);
    if (ts.isPropertyAccessExpression(e)) {
      return /customer$/i.test(e.name.text) || onlyInto.has(e.name.text);
    }
    if (ts.isElementAccessExpression(e)) {
      const base = unwrap(e.expression);
      const name = ts.isIdentifier(base)
        ? base.text
        : ts.isPropertyAccessExpression(base)
          ? base.name.text
          : '';
      return /customers$/i.test(name) || boundIn(rowNames, e, `${name}[]`);
    }
    return false;
  }

  function bindPattern(pattern, scope, fromRow) {
    for (const el of pattern.elements) {
      const prop = el.propertyName
        ? keyOf({ name: el.propertyName })
        : ts.isIdentifier(el.name)
          ? el.name.text
          : null;
      if (!fromRow || !prop || !shadowed.get('Customer')?.has(prop)) continue;
      if (ts.isIdentifier(el.name)) bind(valueNames, scope, el.name.text);
      else if (ts.isObjectBindingPattern(el.name)) {
        for (const inner of el.name.elements) {
          const member = inner.propertyName
            ? keyOf({ name: inner.propertyName })
            : ts.isIdentifier(inner.name)
              ? inner.name.text
              : null;
          if (member && !STRING_MEMBERS.has(member)) offend(inner, 'read', `company.${member}`);
        }
      }
    }
  }

  // First pass: bindings, so a read later in the file is judged with them.
  (function bindings(node) {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      const q = queryOn(node.initializer);
      if (!q && ts.isIdentifier(node.name) && isRow(node.initializer)) {
        // `const buyer = order.customer` is a customer row under another name.
        bind(rowNames, scopeOf(node), node.name.text);
      }
      if (q && ts.isIdentifier(node.name)) {
        bind(rowNames, scopeOf(node), q[1] ? `${node.name.text}[]` : node.name.text);
      }
      if (ts.isObjectBindingPattern(node.name)) {
        bindPattern(node.name, scopeOf(node), isRow(node.initializer) || (q !== null && !q[1]));
      }
    }
    // `rows.map((row) => …)` / `for (const row of rows)` over a find on the model.
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ARRAY_CALLBACKS.has(node.expression.name.text)
    ) {
      const base = unwrap(node.expression.expression);
      const isRows =
        (ts.isIdentifier(base) && boundIn(rowNames, base, `${base.text}[]`)) ||
        (queryOn(base)?.[1] ?? false);
      const fn = node.arguments[0];
      if (isRows && fn && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))) {
        const param = fn.parameters[0];
        if (param && ts.isIdentifier(param.name)) bind(rowNames, fn, param.name.text);
        if (param && ts.isObjectBindingPattern(param.name)) bindPattern(param.name, fn, true);
      }
    }
    if (
      ts.isForOfStatement(node) &&
      ts.isVariableDeclarationList(node.initializer) &&
      node.initializer.declarations[0]
    ) {
      const base = unwrap(node.expression);
      const decl = node.initializer.declarations[0];
      const isRows =
        (ts.isIdentifier(base) && boundIn(rowNames, base, `${base.text}[]`)) ||
        (queryOn(base)?.[1] ?? false);
      if (isRows && ts.isIdentifier(decl.name)) bind(rowNames, node, decl.name.text);
      if (isRows && ts.isObjectBindingPattern(decl.name)) bindPattern(decl.name, node, true);
    }
    ts.forEachChild(node, bindings);
  })(sf);

  /** A read off the computed value: fine for a String member, wrong for anything else. */
  function judgeMember(valueNode, what) {
    const parent = valueNode.parent;
    if (ts.isPropertyAccessExpression(parent) && parent.expression === valueNode) {
      stats.reads += 1;
      const member = parent.name.text;
      if (!STRING_MEMBERS.has(member)) offend(parent, 'read', `${what}.${member}`);
      return;
    }
    if (ts.isElementAccessExpression(parent) && parent.expression === valueNode) {
      stats.reads += 1;
      const arg = parent.argumentExpression;
      if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
        if (!STRING_MEMBERS.has(arg.text)) offend(parent, 'read', `${what}[${arg.text}]`);
      } else if (!ts.isNumericLiteral(arg)) {
        refuse(parent, 'Customer', `an indexed read of ${what}`);
      }
    }
  }

  const customerTaken = shadowed.get('Customer') ?? new Set();

  // Second pass: queries, typed selects, the lexical net, and reads.
  (function visit(node) {
    // 1. A query on any model: walk its arguments with the model known.
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const op = node.expression.name.text;
      const target = node.expression.expression;
      if (QUERY_OPS.has(op) && ts.isPropertyAccessExpression(target)) {
        const model = byClientKey.get(target.name.text);
        // With no argument a query selects nothing it was not given by default.
        if (model && node.arguments[0]) walkArgs(node.arguments[0], model);
      }
    }
    // 3. A select written apart and typed as one.
    if (ts.isVariableDeclaration(node) && node.type && node.initializer) {
      const t = typedAs(node.type);
      if (t)
        t[1] === 'args' ? walkArgs(node.initializer, t[0]) : walkSelection(node.initializer, t[0]);
    }
    if (ts.isSatisfiesExpression(node) || ts.isAsExpression(node)) {
      const t = typedAs(node.type);
      if (t)
        t[1] === 'args' ? walkArgs(node.expression, t[0]) : walkSelection(node.expression, t[0]);
    }
    // `Prisma.CustomerGetPayload<{ include: { company: true } }>`.
    if (ts.isTypeReferenceNode(node) && node.typeArguments?.[0]) {
      const name = ts.isQualifiedName(node.typeName)
        ? node.typeName.right.text
        : node.typeName.text;
      if (name.endsWith('GetPayload')) {
        const model = name.slice(0, -'GetPayload'.length);
        if (models.has(model)) walkTypeArgs(node.typeArguments[0], model);
      }
    }
    // 4. The lexical net: `customer: { select | include: { company } }` anywhere,
    //    so a select exported from one file and used in another is still read.
    if (ts.isPropertyAssignment(node) && onlyInto.has(keyOf(node) ?? '')) {
      const model = onlyInto.get(keyOf(node));
      const value = unwrap(node.initializer);
      if (ts.isObjectLiteralExpression(value)) {
        const keys = value.properties.map((p) => keyOf(p));
        if (keys.some((k) => k && SELECTION_KEYS.has(k))) walkArgs(value, model);
      }
    }
    // 5. Reads of the computed value as if it were the account.
    if (
      ts.isPropertyAccessExpression(node) &&
      customerTaken.has(node.name.text) &&
      isRow(node.expression)
    ) {
      judgeMember(node, `customer.${node.name.text}`);
    }
    if (
      ts.isElementAccessExpression(node) &&
      (ts.isStringLiteral(node.argumentExpression) ||
        ts.isNoSubstitutionTemplateLiteral(node.argumentExpression)) &&
      customerTaken.has(node.argumentExpression.text) &&
      isRow(node.expression)
    ) {
      judgeMember(node, `customer.${node.argumentExpression.text}`);
    }
    if (ts.isIdentifier(node) && boundIn(valueNames, node, node.text)) {
      // `const { company } = customer; company.creditLimit`
      const parent = node.parent;
      const isUse =
        (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) &&
        parent.expression === node;
      if (isUse) judgeMember(node, node.text);
    }
    ts.forEachChild(node, visit);
  })(sf);

  return { offenders, refusals, stats };
}

/* ── 4. The self-test: every shape must come out red, every fine one green ──── */

const FIXTURES = [
  // The shapes that shipped, or would have.
  {
    name: 'a top-level include on a query ON the model (segment-projection, issue 751)',
    red: 1,
    src: `await tx.customer.findUnique({ where: { id }, include: { company: { include: { pricingTierFk: true } } } });`,
  },
  {
    name: 'a top-level select on findMany',
    red: 1,
    src: `await prisma.customer.findMany({ select: { id: true, company: { select: { companyName: true } } } });`,
  },
  {
    name: 'the select on an update',
    red: 1,
    src: `await tx.customer.update({ where: { id }, data: {}, select: { company: true } });`,
  },
  {
    name: 'a nested select under `customer:`',
    red: 1,
    src: `await tx.order.findMany({ include: { customer: { select: { id: true, company: { select: { companyName: true } } } } } });`,
  },
  {
    name: 'a nested select two levels down, under a relation not spelled customer',
    red: 1,
    src: `await tx.orderItem.findMany({ select: { order: { select: { customer: { include: { company: true } } } } } });`,
  },
  {
    name: 'a same-file const passed as the include',
    red: 1,
    src: `const INC = { company: true } as const;\nawait tx.customer.findFirst({ include: INC });`,
  },
  {
    name: 'a const typed as Prisma.CustomerInclude',
    red: 1,
    src: `const inc = { company: { select: { id: true } } } satisfies Prisma.CustomerInclude;`,
  },
  {
    name: 'a select exported for another file (the old net)',
    red: 1,
    src: `export const ORDER_INCLUDE = { customer: { select: { company: { select: { companyName: true } } } } };`,
  },
  {
    name: 'a payload type that includes the relation',
    red: 1,
    src: `type Row = Prisma.CustomerGetPayload<{ include: { company: true } }>;`,
  },
  {
    name: 'a spread of a same-file const',
    red: 1,
    src: `const BASE = { company: true };\nawait tx.customer.findMany({ select: { ...BASE, id: true } });`,
  },
  {
    name: 'a conditional include',
    red: 1,
    src: `await tx.customer.findUnique({ where: { id }, include: wantAccount ? { company: true } : undefined });`,
  },
  {
    name: 'a property read through `.customer.company.`',
    red: 1,
    src: `const terms = existing.customer.company.paymentTerms;`,
  },
  {
    name: 'an optional read through `customer?.company?.`',
    red: 1,
    src: `const name = order.customer?.company?.companyName ?? null;`,
  },
  {
    name: 'a read off a row of a customer find, by any name',
    red: 1,
    src: `const c = await tx.customer.findUnique({ where: { id } });\nconst limit = c?.company?.creditLimit;`,
  },
  {
    name: 'a read off a row of a findMany, inside .map',
    red: 1,
    src: `const rows = await tx.customer.findMany({});\nrows.map((r) => r.company.status);`,
  },
  {
    name: 'a read off a customer row held under another name',
    red: 1,
    src: `const buyer = order.customer;\nconst t = buyer?.company?.paymentTerms;`,
  },
  {
    name: 'a destructured company read as the account',
    red: 1,
    src: `const { company } = customer;\nconst t = company.paymentTerms;`,
  },
  {
    name: 'a nested destructure of the account',
    red: 1,
    src: `const { company: { creditLimit } } = customer;`,
  },
  {
    name: 'two reads in the old segment-projection shape',
    red: 2,
    src: `const u = customer.company ? Number(customer.company.creditUsed) / Number(customer.company.creditLimit) : 0;`,
  },
  // What it cannot read is refused, not passed.
  {
    name: 'an include imported from another file (refused)',
    refused: 1,
    src: `import { INC } from './x';\nawait tx.customer.findMany({ include: INC });`,
  },
  {
    name: 'arguments built by a call (refused)',
    refused: 1,
    src: `await tx.customer.findMany(buildArgs());`,
  },
  {
    name: 'an indexed read with a computed key (refused)',
    refused: 1,
    src: `const v = customer.company[key];`,
  },
  {
    name: 'an imported select nobody typed, beside a typed one (refused once)',
    refused: 1,
    src: `import { NAME_SELECT, OTHER_SELECT } from './x';\nawait tx.deal.findMany({ select: { customer: { select: NAME_SELECT } } });\nawait tx.customer.findMany({ include: OTHER_SELECT });`,
  },
  // The legitimate shapes. Every one of these must stay green.
  {
    name: 'an imported select typed as Prisma.CustomerSelect (read in its own file)',
    red: 0,
    src: `import { NAME_SELECT } from './x';\nawait tx.order.findMany({ select: { customer: { select: NAME_SELECT } } });\nawait tx.customer.findMany({ select: { id: true, ...NAME_SELECT } });`,
  },
  {
    name: 'the scalar employer column',
    red: 0,
    src: `await tx.customer.findMany({ select: { companyName: true, companyId: true } });`,
  },
  {
    name: 'a where through the relation (filters are not extended)',
    red: 0,
    src: `await tx.customer.findMany({ where: { company: { companyName: { contains: q } } } });`,
  },
  {
    name: 'the account read by its id',
    red: 0,
    src: `await tx.company.findUnique({ where: { id: customer.companyId }, select: { companyName: true } });`,
  },
  {
    name: 'a company relation on a model that is not shadowed',
    red: 0,
    src: `await tx.deal.findMany({ include: { company: { select: { companyName: true } } } });`,
  },
  {
    name: 'the computed string used as a string',
    red: 0,
    src: `if (customer.company?.trim()) return customer.company.trim().toLowerCase();`,
  },
  {
    name: 'a findUnique with no shadowed name selected',
    red: 0,
    src: `const c = await tx.customer.findUnique({ where: { id }, select: { id: true } });\nconst n = c?.id;`,
  },
];

/** What the fixtures may import as already-checked typed selects. */
const FIXTURE_EXPORTS = new Map([['NAME_SELECT', new Set(['Customer:selection'])]]);

function selfTest() {
  const failures = [];
  // The legitimate-shape fixtures must name real models, or they test nothing.
  for (const required of ['Customer', 'Company', 'Deal', 'Order', 'OrderItem']) {
    if (!models.has(required)) failures.push(`the schema has no ${required} model any more`);
  }
  if (models.get('Deal')?.get('company') !== 'Company') {
    failures.push('Deal.company is no longer a relation to Company; pick another unshadowed one');
  }
  for (const f of FIXTURES) {
    const { offenders, refusals } = analyze(`<fixture>`, f.src, FIXTURE_EXPORTS);
    const wantRed = f.red ?? 0;
    const wantRefused = f.refused ?? 0;
    if (offenders.length !== wantRed || refusals.length !== wantRefused) {
      failures.push(
        `${f.name}: expected ${String(wantRed)} red and ${String(wantRefused)} refused, ` +
          `got ${String(offenders.length)} red and ${String(refusals.length)} refused`
      );
    }
  }
  if (failures.length > 0) {
    die([
      '✖ check:shadowed failed its own self-test, so its answer about the code would be',
      '   an answer about a broken parser:',
      '',
      ...failures.map((f) => `   - ${f}`),
    ]);
  }
  return FIXTURES.length;
}

/* ── 5. The tree ─────────────────────────────────────────────────────────────── */

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
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIR.has(entry.name)) continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mts|cts)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const fixtureCount = selfTest();
const names = [...shadowed.values()].flatMap((set) => [...set]);
const files = [];
const offenders = [];
const refusals = [];
let scanned = 0;
let selects = 0;
let reads = 0;

for (const root of SOURCE_ROOTS) {
  const abs = join(ROOT, root);
  if (!statSync(abs, { throwIfNoEntry: false })?.isDirectory()) {
    die([
      `✖ check:shadowed cannot find the scan root ${root}.`,
      '   A scan root that no longer exists reports a clean pass over nothing.',
      '   Fix the list rather than shipping a check that scans less than it claims.',
    ]);
  }
  for (const file of walk(abs)) {
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    files.push({ rel, text: readFileSync(file, 'utf8') });
  }
}

const typedExports = new Map();
for (const { rel, text } of files) typedExportsOf(rel, text, typedExports);

// A file that spells none of these cannot reach a shadowed model: it names no
// such model, no relation into one, and no shadowed field. Every relation name
// into the model is listed, not only the unambiguous ones, so a select imported
// under a relation like `createdBy` is still parsed and, if unreadable, refused.
const reach = new Set(names);
for (const model of shadowed.keys()) {
  reach.add(model);
  reach.add(model[0].toLowerCase() + model.slice(1));
}
for (const [name, targets] of relationNamesInto) {
  if ([...targets].some((t) => shadowed.has(t))) reach.add(name);
}
const reachTokens = [...reach];

for (const { rel, text } of files) {
  scanned += 1;
  // The extension itself declares these names; it is not a query.
  if (rel === CLIENT) continue;
  if (!reachTokens.some((t) => text.includes(t))) continue;
  const result = analyze(rel, text, typedExports);
  offenders.push(...result.offenders);
  refusals.push(...result.refusals);
  selects += result.stats.selects;
  reads += result.stats.reads;
}

if (scanned === 0) die(['✖ check:shadowed scanned no files. That is not a pass.']);

if (offenders.length > 0 || refusals.length > 0) {
  const lines = [];
  if (offenders.length > 0) {
    lines.push(
      `✖ ${String(offenders.length)} place(s) ask for or read a relation whose name is already taken:`,
      '',
      ...offenders.map(
        (o) => `   ${o.rel}:${String(o.line)}  ${o.kind} ${o.what}  "${o.text.trim()}"`
      ),
      '',
      '   The Prisma client extension in packages/db/src/client.ts publishes a',
      '   COMPUTED field of that name on that model, and the computed one wins.',
      '   The select is accepted, the query runs, and the field comes back as the',
      '   computed value instead of the join. TypeScript still types it as the',
      '   relation, so a read like `customer.company.creditLimit` compiles and is',
      '   always undefined. Nothing throws.',
      '',
      '   Read the account by its id instead: `tx.company.findUnique({ where: { id:',
      '   customer.companyId } })`, or one batched `findMany` by the ids for a page',
      '   (see `accountsFor` in packages/crm/src/services/order-service.ts). For the',
      '   typed employer string, select `companyName`.',
      ''
    );
  }
  if (refusals.length > 0) {
    lines.push(
      `✖ ${String(refusals.length)} select(s) on a model with a shadowed name cannot be read here:`,
      '',
      ...refusals.map((r) => `   ${r.rel}:${String(r.line)}  ${r.why}  "${r.text}"`),
      '',
      '   This check cannot tell whether these ask for the shadowed relation, so it',
      '   will not report them as fine. Write the select inline or as a same-file',
      '   const, or, if a person has read it and it is fine, add it to UNREADABLE in',
      '   scripts/check-shadowed-relations.mjs with the reason.',
      ''
    );
  }
  die(lines);
}

console.log(
  `✓ check:shadowed: ${String(scanned)} files across ${String(SOURCE_ROOTS.length)} roots, ` +
    `${String(selects)} select key(s) traced to their model and ${String(reads)} read(s) of ` +
    `${pairs.map((p) => `${p.model}.${p.field}`).join(', ')} judged; none ask for or read the ` +
    `shadowed relation. Self-test: ${String(fixtureCount)} fixtures, every shape red, every fine one green. ` +
    `Blind spot: a read of \`company\` on a value whose name and origin say nothing about a customer.`
);
