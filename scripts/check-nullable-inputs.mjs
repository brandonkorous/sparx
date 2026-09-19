#!/usr/bin/env node
// check:nullable-inputs — a schema that refuses the null its own service writes.
//
// THE FAILURE THIS CATCHES. Every form in both consoles follows one convention:
// an empty text box sends `null`, not an empty string and not nothing (40-odd
// call sites write `trim() === '' ? null : trim()`). A service that writes
// `input.X ?? null` has agreed — undefined means "leave it alone", null means
// "clear it". But if the Zod field is `.optional()` and not `.nullable()` /
// `.nullish()`, that null is rejected and the save comes back a bare 422.
//
// Found by hand on shipping profiles: a box labelled "Note (optional)" could not
// be left empty, so a product group could not be created at all, and a note once
// written could never be cleared. The screen said "Could not save this group —
// nothing was changed" and named no field. 105 more fields were in the same
// state, across 26 files in two packages.
//
// NOTHING ELSE CATCHES IT. It typechecks (the console's type says
// `string | null`, the schema's says `string | undefined`, and they never meet
// in TypeScript — the wire is between them). It lints. Every unit test passes,
// because a test builds a valid object rather than the one a blank form sends.
// It only shows up when somebody leaves a field empty and presses Save.
//
// HOW THE LINK IS MADE. An earlier version of this check joined on field NAME
// across a whole module and turned up 173 hits, most of them a `notes` in one
// file matched to an `input.notes` in an unrelated one. A name is not a link.
// This one follows the real one:
//
//     service function  →  the schema it calls .parse() with  →  that field
//
// so every hit is one function, one schema, one field.
//
// FIXING ONE means widening `.optional()` to `.nullish()`. That is safe by
// construction rather than by judgment: the service's own `?? null` proves the
// column takes null, because that is what it already writes when the field is
// absent, and an explicit null maps to the same `null ?? null` and the same
// write. Every payload that parsed before still parses, to the same value.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve the repo root from THIS FILE, never by counting `..` from the cwd:
// a check run from the wrong directory that scans nothing prints green.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SERVICE_DIRS = [
  'wizeworks/packages/commerce/src',
  'wizeworks/packages/crm/src',
  'wizeworks/packages/inventory/src',
  'wizeworks/packages/cms/src',
  'wizeworks/packages/scheduling/src',
];
const SCHEMA_DIRS = [
  'wizeworks/packages/commerce-schemas/src',
  'wizeworks/packages/crm-schemas/src',
  'wizeworks/packages/cms-schemas/src',
  'wizeworks/packages/scheduling-schemas/src',
  'wizeworks/packages/field-schema/src',
];

// Floors, so a tree move that empties a scan root fails instead of passing.
const MIN_SERVICE_FILES = 200;
const MIN_SCHEMA_FILES = 40;
const MIN_SCHEMAS = 200;

const SKIP = new Set(['node_modules', 'dist', '.next', '.turbo', 'coverage']);

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, out);
    else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

function requireDir(rel) {
  const full = join(ROOT, rel);
  try {
    if (statSync(full).isDirectory()) return full;
  } catch {
    /* fall through */
  }
  console.error(`✗ check:nullable-inputs — scan root is missing: ${rel}`);
  console.error('  A check that scans nothing prints green. Fix the path, do not delete the root.');
  process.exit(1);
}

/* ── every exported Zod object schema, by name ─────────────────────────────── */

const schemas = new Map();
let schemaFileCount = 0;
for (const rel of SCHEMA_DIRS) {
  const files = walk(requireDir(rel));
  schemaFileCount += files.length;
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const m =
        /^export const ([A-Za-z0-9_]+)\s*=\s*(z\.object\(\{|[A-Za-z0-9_]+\.extend\(\{)/.exec(line);
      if (!m) return;
      const body = [];
      for (let j = i + 1; j < lines.length; j++) {
        if (/^\}\)/.test(lines[j])) break;
        body.push(lines[j]);
      }
      schemas.set(m[1], { file: relative(ROOT, file), line: i + 1, body, base: m[2] });
    });
  }
}

/** Where one field's declaration ends and the next begins. */
const FIELD_START = /^\s{2,}([A-Za-z_][A-Za-z0-9_]*)\s*:\s*[A-Za-z_]/;

/** A schema's fields, following `.extend()` back to its base. */
function fieldsOf(name, depth = 0) {
  const s = schemas.get(name);
  if (!s || depth > 3) return new Map();
  const out = s.base.endsWith('.extend({')
    ? new Map(fieldsOf(s.base.replace('.extend({', ''), depth + 1))
    : new Map();
  s.body.forEach((line, k) => {
    // Any identifier-rooted chain, not just `z.…`. Schemas here build most of
    // their fields from shared aliases — `Uuid`, `MoneyCents`, `Currency`, an
    // exported enum — and a `z.`-only pattern could not see ANY of them.
    //
    // MEASURED 2026-09-18 when this was widened: 377 fields were invisible
    // against 1,339 visible, and 146 of the 377 were `Uuid` — exactly the shape
    // of a "which supplier / which location / which person" field that a blank
    // <select> nulls. Among them was `CreatePoApprovalRuleInput.supplierId`,
    // which made the Spending limits form unsaveable in its own default state
    // and left ZERO spending limits on the platform, with this check printing
    // green over it the whole time. [[feedback_structural_checks_go_blind]]
    const m = /^\s{2,}([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_]*\.[^\n]*)$/.exec(line);
    if (!m) return;
    // This field's OWN chain: from its first line up to wherever the next field
    // starts. It used to take a flat three-line window, which reaches straight
    // into the following fields — so once most of a schema's fields were
    // `.nullish()`, narrowing one of them was masked by its NEIGHBOUR and the
    // check went quiet about it. Proved by narrowing
    // `CreateTaxExemptionInput.customerId` and watching the check stay green
    // because `companyId` on the next line was nullish.
    const chunkLines = [m[2]];
    for (let n = k + 1; n < s.body.length; n++) {
      if (FIELD_START.test(s.body[n])) break;
      chunkLines.push(s.body[n]);
    }
    const chunk = chunkLines.join(' ');
    out.set(m[1], {
      chain: m[2].trim().slice(0, 90),
      acceptsNull: /\.nullable\(\)|\.nullish\(\)/.test(chunk),
      at: `${s.file}:${String(s.line + 1 + k)}`,
    });
  });
  return out;
}

/* ── each service function: which schema it parses, which fields it nulls ──── */

const findings = [];
let serviceFileCount = 0;
for (const rel of SERVICE_DIRS) {
  const files = walk(requireDir(rel));
  serviceFileCount += files.length;
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const chunk of text.split(/\n(?=export (?:async )?function )/)) {
      const parsed = [
        ...chunk.matchAll(/([A-Za-z0-9_]+)\.parse\(raw|([A-Za-z0-9_]+Input)\.parse\(/g),
      ]
        .map((m) => m[1] ?? m[2])
        .filter(Boolean);
      if (parsed.length === 0) continue;
      const nulled = new Set(
        [...chunk.matchAll(/input\.([A-Za-z_][A-Za-z0-9_]*)\s*\?\?\s*null/g)].map((m) => m[1])
      );
      if (nulled.size === 0) continue;
      const fn = /export (?:async )?function ([A-Za-z0-9_]+)/.exec(chunk)?.[1] ?? '(top level)';
      for (const schemaName of new Set(parsed)) {
        const fields = fieldsOf(schemaName);
        if (fields.size === 0) continue;
        for (const field of nulled) {
          const f = fields.get(field);
          if (!f || f.acceptsNull) continue;
          findings.push({
            key: `${schemaName}.${field}`,
            at: f.at,
            chain: f.chain,
            service: `${relative(ROOT, file)} ${fn}()`,
          });
        }
      }
    }
  }
}

if (
  serviceFileCount < MIN_SERVICE_FILES ||
  schemaFileCount < MIN_SCHEMA_FILES ||
  schemas.size < MIN_SCHEMAS
) {
  console.error(
    `✗ check:nullable-inputs — scanned only ${String(serviceFileCount)} service files, ${String(
      schemaFileCount
    )} schema files, ${String(schemas.size)} schemas.`
  );
  console.error('  That is below the floor. The scan has gone blind; it has not gone clean.');
  process.exit(1);
}

const unique = new Map();
for (const f of findings) if (!unique.has(f.key)) unique.set(f.key, f);

if (unique.size > 0) {
  console.error(
    `✗ check:nullable-inputs — ${String(unique.size)} field(s) a service writes null into that its own schema refuses:\n`
  );
  for (const f of unique.values()) {
    console.error(`  ${f.key}`);
    console.error(`      schema : ${f.at}   ${f.chain}`);
    console.error(`      service: ${f.service}`);
  }
  console.error(
    '\n  A console form sends null for an empty field, so each of these is a save that' +
      '\n  comes back 422 with no field named. Widen `.optional()` to `.nullish()`: the' +
      '\n  service already writes null there, so it is the same write and no payload that' +
      '\n  parsed before stops parsing.'
  );
  process.exit(1);
}

console.log(
  `✓ check:nullable-inputs — every field a service nulls is a field its schema accepts` +
    `\n  (${String(serviceFileCount)} service files, ${String(schemaFileCount)} schema files, ${String(
      schemas.size
    )} schemas)`
);
