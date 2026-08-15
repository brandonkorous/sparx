#!/usr/bin/env node
// Piggles and sparx are two applications. Neither may reference the other.
//
// The test this enforces is the one in piggles/CLAUDE.md RULE #0: either product
// must be deletable tomorrow without affecting the other. Delete `apps/` and
// Piggles keeps working; delete `piggles/` and sparx keeps working.
//
// ── WHY A CHECK AND NOT A CONVENTION ────────────────────────────────────────
//
// It was a convention for a while — written down, in the binding file, at the
// top — and the console still ended up with 84 imports into `apps/workbench`
// behind a tsconfig alias. Coupling does not arrive as a decision; it arrives as
// one convenient import at a time, each of which looks reasonable on its own.
//
// So: a check that fails the build. Cheap, pure Node, no dependencies, in the
// same family as check:events / check:routes / check:docker.
//
// What is ALLOWED, deliberately: `@sparx/*` package imports. Those are
// libraries under `packages/`, not the sparx application — a database client, a
// query wrapper, a UI kit. Deleting the sparx APPS does not delete them, so
// depending on one does not couple the two products.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['node_modules', '.next', '.turbo', 'dist', '.git']);
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.json']);

/** A reference from one app's tree into the other's. */
const PIGGLES_TO_SPARX = [
  // The alias that started it.
  /@workbench\//,
  // Any path, relative or otherwise, that lands in an app directory.
  /['"`][^'"`\n]*\.\.\/apps\/(workbench|web|site|market|admin)\//,
  /['"`]apps\/(workbench|web|site|market|admin)\//,
];

const SPARX_TO_PIGGLES = [/@piggles\//, /['"`][^'"`\n]*piggles\/(apps|packages)\//];

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (EXTENSIONS.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

/** Strip comments, so prose ABOUT the boundary never trips the check on it. */
function code(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => (/^\s*(\/\/|\*|#)/.test(line) ? '' : line.replace(/([^:'"`])\/\/.*$/, '$1')))
    .join('\n');
}

function scan(root, patterns, label) {
  const problems = [];
  for (const file of walk(path.join(ROOT, root))) {
    const source = code(fs.readFileSync(file, 'utf8'));
    source.split('\n').forEach((line, index) => {
      if (patterns.some((pattern) => pattern.test(line))) {
        problems.push(
          `${path.relative(ROOT, file).replace(/\\/g, '/')}:${index + 1}: ${line.trim().slice(0, 120)}`
        );
      }
    });
  }
  if (problems.length) {
    console.error(`\n✖ ${label} — ${problems.length} reference(s):\n`);
    for (const problem of problems) console.error('   ' + problem);
  }
  return problems.length;
}

let failures = 0;
failures += scan('piggles', PIGGLES_TO_SPARX, 'piggles/ reaches into a sparx APP');
failures += scan('apps', SPARX_TO_PIGGLES, 'apps/ reaches into piggles/');

if (failures > 0) {
  console.error(
    '\nPiggles and sparx are separate applications (piggles/CLAUDE.md RULE #0).\n' +
      'Either one must be deletable without breaking the other, so neither may\n' +
      'import from the other. If both products need the same fix, make it twice —\n' +
      'that cost is real, and it is smaller than the coupling.\n' +
      '\n@sparx/* PACKAGE imports are fine: those are libraries under packages/,\n' +
      'not the sparx application.\n'
  );
  process.exit(1);
}

console.log('✓ piggles and sparx share no application code');
