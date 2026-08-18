#!/usr/bin/env node
// A4 — the tree move. Three product trees, one shared floor.
//
//   wizeworks/packages/*   the brand-blind platform (96 minus the two below)
//   wizeworks/services/*   every service
//   wizeworks/apps/*       admin (WizeWorks staff console) + site (tenant renderer)
//   sparx/packages/*       brand + ui — sparx's marks and compositions
//   sparx/apps/*           web + market + workbench + b2b-portal
//   piggles/*              unchanged; it was already its own tree
//
// The point is that the DIRECTORY finally says what the dependency rule already
// says. `check-deletability` can then be one path instead of a hand-kept list,
// and A0's dormant rule 1 — `wizeworks/` may not import `sparx/` or `piggles/` —
// becomes checkable by looking at where a file sits.
//
// ── WHY RELATIVE PATHS ARE RESOLVED, NOT PATTERN-MATCHED ────────────────────
//
// Moving a directory breaks every relative path that crosses into it, and the
// breakage is not uniform: `wizeworks/apps/site/app/globals.css` reaching
// `../../../packages/ui` has to become a DIFFERENT number of `../` than
// `wizeworks/apps/admin/app/globals.css` reaching the same place, because the two files
// end up at different depths in different trees.
//
// So each relative reference is resolved to an absolute repo path, looked up in
// the move map, and re-derived from the referring file's NEW location to the
// target's NEW location. A regex over `../../../packages/` would have produced
// paths that are wrong in exactly the cases nobody checks.
//
// Pure Node, no dependencies. `--write` to apply; default is a dry run.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();

/** sparx's own — the five that kept the `@sparx/*` scope in A3, plus the empty
 *  b2b-portal placeholder, which is a sparx surface that was never built. */
const SPARX_PACKAGES = ['brand', 'ui'];
const SPARX_APPS = ['web', 'market', 'workbench', 'b2b-portal'];

/** Shared: the staff console and the tenant site renderer both serve either
 *  brand, so neither is sparx's. Root CLAUDE.md is explicit that admin is the
 *  WizeWorks-staff console and not a tenant surface. */
const WIZEWORKS_APPS = ['admin', 'site'];

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const exists = (p) => fs.existsSync(path.join(ROOT, p));

/** old repo-relative dir → new repo-relative dir. */
function buildMoveMap() {
  const map = new Map();
  for (const name of fs.readdirSync(path.join(ROOT, 'packages'))) {
    if (!fs.statSync(path.join(ROOT, 'packages', name)).isDirectory()) continue;
    const tree = SPARX_PACKAGES.includes(name) ? 'sparx' : 'wizeworks';
    map.set(`packages/${name}`, `${tree}/packages/${name}`);
  }
  for (const name of fs.readdirSync(path.join(ROOT, 'services'))) {
    if (!fs.statSync(path.join(ROOT, 'services', name)).isDirectory()) continue;
    map.set(`services/${name}`, `wizeworks/services/${name}`);
  }
  for (const name of fs.readdirSync(path.join(ROOT, 'apps'))) {
    if (!fs.statSync(path.join(ROOT, 'apps', name)).isDirectory()) continue;
    const tree = SPARX_APPS.includes(name)
      ? 'sparx'
      : WIZEWORKS_APPS.includes(name)
        ? 'wizeworks'
        : null;
    if (!tree) {
      console.error(`✗ apps/${name} is in neither list — classify it before moving.`);
      process.exit(1);
    }
    map.set(`apps/${name}`, `${tree}/apps/${name}`);
  }
  return map;
}

/** Where a repo-relative path ends up, following the move map. */
function relocate(p, moves) {
  for (const [from, to] of moves) {
    if (p === from) return to;
    if (p.startsWith(`${from}/`)) return to + p.slice(from.length);
  }
  return p;
}

const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.turbo',
  'dist',
  '.git',
  'coverage',
  'build',
  '.vercel',
]);
const TEXT_EXT = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.jsonc',
  '.css',
  '.scss',
  '.md',
  '.mdx',
  '.yaml',
  '.yml',
  '.sh',
  '.txt',
  '.html',
  '.prisma',
  '.tf',
]);

function isText(name) {
  if (name.startsWith('Dockerfile')) return true;
  if (name.startsWith('.env')) return true;
  if (['.npmrc', '.prettierignore', '.gitignore', '.dockerignore'].includes(name)) return true;
  return TEXT_EXT.has(path.extname(name));
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name !== 'pnpm-lock.yaml' && isText(entry.name)) out.push(full);
  }
  return out;
}

// ── Pass 1: relative references that cross into a moved directory ───────────

/** `'../../../packages/ui/src/**'`, `"../../tsconfig.base.json"`, `@source '../x'`. */
const RELATIVE = /(['"`])((?:\.\.\/)+[^'"`\n]*)\1/g;

function fixRelative(fileOld, fileNew, text, moves) {
  const dirOld = path.posix.dirname(fileOld);
  const dirNew = path.posix.dirname(fileNew);
  let changed = 0;
  const out = text.replace(RELATIVE, (whole, q, ref) => {
    // Resolve against the file's OLD directory to learn what it points at.
    const targetOld = path.posix.normalize(path.posix.join(dirOld, ref));
    if (targetOld.startsWith('..')) return whole; // escapes the repo — not ours
    const targetNew = relocate(targetOld, moves);
    // Nothing moved on either end → the path is still correct as written.
    if (targetNew === targetOld && dirNew === dirOld) return whole;
    let next = path.posix.relative(dirNew, targetNew);
    if (!next.startsWith('.')) next = `./${next}`;
    // Preserve a trailing slash, which matters for a Dockerfile COPY target.
    if (ref.endsWith('/') && !next.endsWith('/')) next += '/';
    if (next === ref) return whole;
    changed++;
    return `${q}${next}${q}`;
  });
  return { out, changed };
}

// ── Pass 2: repo-rooted paths (globs, filters, COPY sources, path filters) ──

/** `sparx/packages/ui/src/**`, `sparx/apps/web/**`, `wizeworks/services/api-rest` — anywhere a path is
 *  written from the repo root rather than relatively. */
function fixRooted(text, moves) {
  let changed = 0;
  let out = text;
  for (const [from, to] of moves) {
    // Word-ish boundary: must not be preceded by a path character, and must be
    // followed by a delimiter — so `sparx/packages/ui` never matches inside
    // `wizeworks/packages/ui` (already moved) or `packages/ui-kit`.
    const re = new RegExp(
      `(^|[^\\w./-])${from.replace(/[/]/g, '\\/')}(?=[/'"\`\\s,)\\]}:*]|$)`,
      'g'
    );
    out = out.replace(re, (whole, pre) => {
      changed++;
      return `${pre}${to}`;
    });
  }
  return { out, changed };
}

/**
 * The workspace globs, which the path passes cannot reach.
 *
 * `'packages/*'` is a pattern, not a path — nothing in the move map matches it,
 * so it survives both passes untouched and pnpm would find no packages at all.
 * The one place the move has to be spelled out by hand.
 */
function fixWorkspaceGlobs(write) {
  const file = path.join(ROOT, 'pnpm-workspace.yaml');
  const text = fs.readFileSync(file, 'utf8');
  const OLD = "  - 'apps/*'\n  - 'packages/*'\n  - 'services/*'\n";
  const NEW = [
    '  # The shared platform. Brand-blind by construction: nothing under here may',
    '  # import from `sparx/` or `piggles/` (check-boundaries rule 1).',
    "  - 'wizeworks/packages/*'",
    "  - 'wizeworks/services/*'",
    "  - 'wizeworks/apps/*'",
    "  # sparx's own — its marks, its compositions, its four surfaces.",
    "  - 'sparx/packages/*'",
    "  - 'sparx/apps/*'",
    '',
  ].join('\n');
  if (!text.includes(OLD)) {
    // Already done, or the file was reformatted. Either way, do not guess.
    console.error('  note: pnpm-workspace.yaml globs not in the expected shape — fix by hand.');
    return 0;
  }
  if (write) fs.writeFileSync(file, text.replace(OLD, NEW));
  return 1;
}

function gitMv(from, to) {
  const parent = path.dirname(path.join(ROOT, to));
  fs.mkdirSync(parent, { recursive: true });
  execFileSync('git', ['mv', from, to], { cwd: ROOT, stdio: 'pipe' });
}

function main() {
  const write = process.argv.includes('--write');

  if (!exists('packages') || !exists('services') || !exists('apps')) {
    console.error('✗ packages/, services/ or apps/ is missing — the move already ran.');
    console.error('  This script is not idempotent: it moves directories, and once');
    console.error('  they are gone there is nothing to move. Check `git status`.\n');
    return 1;
  }

  const moves = buildMoveMap();
  console.log(`${write ? 'moving' : 'would move'} ${moves.size} director(ies):`);
  const byTree = new Map();
  for (const to of moves.values()) {
    const tree = to.split('/').slice(0, 2).join('/');
    byTree.set(tree, (byTree.get(tree) ?? 0) + 1);
  }
  for (const [tree, n] of [...byTree].sort()) console.log(`    ${String(n).padStart(3)}  ${tree}/`);

  // Rewrite references FIRST, while the old paths still exist to resolve
  // against. Every file is considered at its future location.
  const files = walk(ROOT);
  let relCount = 0;
  let rootCount = 0;
  const touched = [];

  for (const abs of files) {
    const oldPath = rel(abs);
    const newPath = relocate(oldPath, moves);
    let text;
    try {
      text = fs.readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    const a = fixRelative(oldPath, newPath, text, moves);
    const b = fixRooted(a.out, moves);
    const n = a.changed + b.changed;
    if (n === 0) continue;
    relCount += a.changed;
    rootCount += b.changed;
    touched.push({ file: oldPath, n });
    if (write) fs.writeFileSync(abs, b.out);
  }

  console.log(
    `\n  ${relCount} relative + ${rootCount} repo-rooted reference(s) across ${touched.length} file(s)`
  );
  for (const t of [...touched].sort((x, y) => y.n - x.n).slice(0, 12)) {
    console.log(`    ${String(t.n).padStart(4)}  ${t.file}`);
  }

  const globs = fixWorkspaceGlobs(write);
  console.log(`  ${globs ? '+' : '·'} pnpm-workspace.yaml globs`);

  if (!write) {
    console.log('\n  Dry run — nothing moved, nothing written.');
    console.log('  Re-run with --write, then `pnpm install`.');
    return 0;
  }

  console.log('\n  Moving directories…');
  for (const [from, to] of moves) {
    try {
      gitMv(from, to);
    } catch (err) {
      console.error(`✗ git mv ${from} → ${to}: ${err.stderr?.toString().trim() ?? err.message}`);
      return 1;
    }
  }
  // The now-empty parents. `rmdir` refuses if anything is left, which is the
  // check we want: something unclassified was in there.
  for (const dir of ['packages', 'services', 'apps']) {
    try {
      fs.rmdirSync(path.join(ROOT, dir));
    } catch {
      console.error(`  note: ${dir}/ is not empty — something was not classified.`);
    }
  }

  console.log('\n  Moved. `pnpm install` now — every workspace path changed.');
  return 0;
}

process.exit(main());
