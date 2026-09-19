#!/usr/bin/env node
// The invariant, PROVEN rather than approximated.
//
// `check-boundaries.mjs` answers "is Piggles reaching into sparx?" by reading
// source text. That catches a new import the moment somebody writes one, which
// is what a pre-push guard is for — but it is a proxy. The question the whole
// migration exists to answer is narrower and harsher:
//
//     If sparx were deleted tomorrow, would Piggles still build?
//
// A text scan cannot answer that, because the thing that breaks you is never the
// import you wrote. It is the one four packages down: `@piggles/console` imports
// `@wizeworks/cms-editor`, which imported `@wizeworks/ui`, which imported
// `@sparx/brand`. Nothing in `piggles/` mentioned `@sparx/brand`, the boundary
// check was green, and sparx's mascot was in the Piggles container image.
//
// So this walks the actual dependency CLOSURE from Piggles' own packages through
// every workspace edge, and asserts that nothing it reaches lives in a
// sparx-owned directory. That is a proof, not a heuristic: if no package in the
// closure sits under a deleted path, deleting those paths cannot break the build.
//
// `--build` does the destructive version for when someone wants to watch it
// happen — a throwaway git worktree, the sparx paths actually deleted, then
// install and build. Slower by minutes, so it is not what CI runs.
//
// Pure Node, no dependencies, same family as check:events / check:routes /
// check:docker / check:boundaries.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();

/**
 * What "deleting sparx" means, as paths.
 *
 * A LIST rather than one directory because the tree move (A4 in
 * piggles/docs/migration) has not happened yet — today sparx's apps sit beside
 * the shared platform's under `apps/`, and its two brand packages sit among the
 * brand-blind ones under `packages/`. After A4 this collapses to `sparx/`, and
 * the shape of the check does not change: only this array does.
 *
 * `wizeworks/apps/admin` and `wizeworks/apps/site` are NOT here. Admin is the WizeWorks staff
 * console and site is the tenant site renderer — both serve either brand, so
 * neither is sparx's to delete.
 */
const SPARX_OWNED = ['sparx'];

/** The roots the closure is walked FROM: everything Piggles ships. */
const PIGGLES_GLOBS = ['piggles/apps', 'piggles/packages'];

/** Workspace globs, kept in step with pnpm-workspace.yaml. */
const WORKSPACE_GLOBS = [
  'wizeworks/packages',
  'wizeworks/services',
  'wizeworks/apps',
  'sparx/packages',
  'sparx/apps',
  'piggles/apps',
  'piggles/packages',
];

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

/** Every workspace package: name → { dir, deps }. */
function readWorkspace() {
  const byName = new Map();
  for (const glob of WORKSPACE_GLOBS) {
    const base = path.join(ROOT, glob);
    if (!fs.existsSync(base)) continue;
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(base, entry.name);
      const manifest = path.join(dir, 'package.json');
      if (!fs.existsSync(manifest)) continue;
      let pkg;
      try {
        pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      } catch (err) {
        console.error(`✗ unreadable manifest: ${rel(manifest)} — ${err.message}`);
        continue;
      }
      if (!pkg.name) continue;
      // devDependencies are deliberately included. A build that cannot run its
      // own typecheck is not a build, and `tsconfig`/`eslint-config` packages
      // are exactly the kind of thing that goes missing unnoticed.
      const deps = Object.keys({
        ...(pkg.dependencies ?? {}),
        ...(pkg.devDependencies ?? {}),
        ...(pkg.peerDependencies ?? {}),
      });
      byName.set(pkg.name, { name: pkg.name, dir: rel(dir), deps });
    }
  }
  return byName;
}

/** The Piggles packages themselves — where the walk starts. */
function pigglesRoots(byName) {
  return [...byName.values()].filter((p) =>
    PIGGLES_GLOBS.some((g) => p.dir === g || p.dir.startsWith(`${g}/`))
  );
}

/** Everything reachable from `roots` through workspace edges, with the path that
 *  got there — so a failure can say HOW, not just THAT. */
function closure(byName, roots) {
  const seen = new Map(); // name → chain (array of names, root first)
  const queue = roots.map((p) => [p.name, [p.name]]);
  while (queue.length > 0) {
    const [name, chain] = queue.shift();
    if (seen.has(name)) continue;
    seen.set(name, chain);
    const pkg = byName.get(name);
    if (!pkg) continue; // an external (registry) dependency — not our problem
    for (const dep of pkg.deps) {
      if (!byName.has(dep) || seen.has(dep)) continue;
      queue.push([dep, [...chain, dep]]);
    }
  }
  return seen;
}

function isSparxOwned(dir) {
  return SPARX_OWNED.some((owned) => dir === owned || dir.startsWith(`${owned}/`));
}

function checkClosure() {
  const byName = readWorkspace();
  const roots = pigglesRoots(byName);

  if (roots.length === 0) {
    console.error('✗ no Piggles packages found — the walk would trivially pass.');
    console.error('  Check PIGGLES_GLOBS against pnpm-workspace.yaml.\n');
    return 1;
  }

  // The workspace roots must exist too, and this is not belt-and-braces: after
  // the tree move these still read `apps` / `packages` / `services`, so the walk
  // found only Piggles' own eight packages, reached nothing else, and reported
  // "none of them sparx's" — a green tick over a search that had been performed
  // on an empty set. Exactly the failure this file was written to catch,
  // committed by this file.
  const missingRoots = WORKSPACE_GLOBS.filter((p) => !fs.existsSync(path.join(ROOT, p)));
  if (missingRoots.length > 0) {
    console.error('✗ these workspace roots do not exist:\n');
    for (const p of missingRoots) console.error(`    ${p}`);
    console.error('\n  The closure would be walked over a partial workspace, so a pass');
    console.error('  would mean nothing. Update WORKSPACE_GLOBS to match');
    console.error('  pnpm-workspace.yaml.\n');
    return 1;
  }

  const missingPaths = SPARX_OWNED.filter((p) => !fs.existsSync(path.join(ROOT, p)));
  if (missingPaths.length > 0) {
    // A path that no longer exists proves nothing and hides everything: the
    // check would pass because there was nothing left to reach. Almost always
    // means the tree moved and SPARX_OWNED was not updated with it.
    console.error('✗ these sparx-owned paths do not exist:\n');
    for (const p of missingPaths) console.error(`    ${p}`);
    console.error('\n  Update SPARX_OWNED in this file to match the tree.\n');
    return 1;
  }

  const reached = closure(byName, roots);
  const violations = [];
  for (const [name, chain] of reached) {
    const pkg = byName.get(name);
    if (!pkg || !isSparxOwned(pkg.dir)) continue;
    violations.push({ name, dir: pkg.dir, chain });
  }

  if (violations.length > 0) {
    console.error(`✗ Piggles depends on ${violations.length} sparx-owned package(s).`);
    console.error('  Deleting sparx would break the Piggles build.\n');
    for (const v of violations) {
      console.error(`    ${v.name}  (${v.dir})`);
      console.error(`      via ${v.chain.join(' → ')}\n`);
    }
    console.error('  The chain is the fix: break the FIRST edge in it that should');
    console.error('  not exist, not the last. See piggles/docs/migration/.\n');
    return 1;
  }

  const external = [...reached.keys()].filter((n) => !byName.has(n)).length;
  console.log(
    `✓ deletable: ${roots.length} Piggles package(s) reach ${reached.size - external} ` +
      `workspace package(s), none of them sparx's`
  );
  return 0;
}

// ── The destructive version ─────────────────────────────────────────────────

function run(cmd, args, cwd) {
  execFileSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
}

/**
 * Which step this run is on, so a failure can be reported as what it IS.
 *
 * It used to answer every failure with "Piggles does NOT build without sparx",
 * whatever had gone wrong. Four of the five things that can fail here are not
 * that claim at all: `git worktree add` refusing, the delete failing, `pnpm
 * install` failing, or the install producing a tree that cannot resolve. One of
 * those was measured on Windows — a dangling `@alloc/quick-lru` symlink written
 * with a POSIX `/tmp/...` target, which no Windows process can follow — and the
 * check reported it as a brand-boundary violation, sending the reader to look
 * for a sparx import that does not exist.
 *
 * A failure message that names the wrong cause is worse than no message: it
 * spends somebody's afternoon. [[feedback_one_outcome_two_causes]]
 */
const STEPS = {
  worktree: {
    what: 'the throwaway worktree could not be created',
    means: 'Nothing was proven either way. This is a git problem, not a Piggles one.',
  },
  remove: {
    what: "sparx's directories could not be deleted from the worktree",
    means: 'Nothing was proven either way. Usually a file held open by another process.',
  },
  install: {
    what: 'pnpm install failed in the worktree',
    means:
      'Nothing was proven about imports yet: the build never ran. Read the install output above.',
  },
  build: {
    what: 'Piggles did not build with sparx deleted',
    means:
      'Read the build error above before concluding anything. It names a FILE. If that file is ' +
      'under piggles/ and imports something under sparx/, this is the boundary violation the ' +
      'check exists for. If it names a missing node_modules package, it is an install problem ' +
      'wearing a build error, and `pnpm check:deletability` (no --build) answers the real ' +
      'question from the dependency closure in seconds.',
  },
};

function checkBuild() {
  const worktree = fs.mkdtempSync(path.join(os.tmpdir(), 'deletability-'));
  console.log(`→ worktree: ${worktree}\n`);
  let created = false;
  let step = 'worktree';
  try {
    // Detached from HEAD, so an uncommitted working tree is neither used nor
    // disturbed. What is proven is what is COMMITTED, which is what ships.
    run('git', ['worktree', 'add', '--detach', worktree, 'HEAD'], ROOT);
    created = true;

    step = 'remove';
    for (const owned of SPARX_OWNED) {
      const target = path.join(worktree, owned);
      console.log(`→ rm -rf ${owned}`);
      fs.rmSync(target, { recursive: true, force: true });
    }

    step = 'install';
    console.log('\n→ pnpm install\n');
    run('pnpm', ['install', '--ignore-scripts'], worktree);

    step = 'build';
    console.log('\n→ pnpm --filter "@piggles/*" build\n');
    run('pnpm', ['--filter', '@piggles/*', 'build'], worktree);

    step = 'done';
    console.log('\n✓ Piggles builds with sparx deleted.\n');
    return 0;
  } catch (err) {
    const failure = STEPS[step];
    console.error(`\n✗ ${failure.what}.\n`);
    console.error(`  ${err.message}\n`);
    console.error(`  ${failure.means}\n`);
    console.error(`  The worktree is left in place as the evidence: ${worktree}\n`);
    return 1;
  } finally {
    // Prune on SUCCESS only — on failure the directory above is the evidence,
    // and the message just told the reader to go and look at it. (This used to
    // try the removal either way; it survived only because Windows refuses to
    // delete a directory that is still busy, which is not a plan.)
    if (created && step === 'done') {
      try {
        run('git', ['worktree', 'remove', '--force', worktree], ROOT);
      } catch {
        /* already gone */
      }
    }
  }
}

const wantsBuild = process.argv.includes('--build');
process.exit(wantsBuild ? checkBuild() : checkClosure());
