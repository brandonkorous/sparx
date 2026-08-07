#!/usr/bin/env node
// Every workspace package a Next.js app depends on must be COPYed into its image.
//
// WHY THIS EXISTS. The Node services share one base image built from the whole
// workspace, so they cannot get this wrong. The five Next.js apps do the opposite:
// each Dockerfile lists its dependency closure by hand and runs a FILTERED install
// (`pnpm install --filter @sparx/<app>...`), because copying the whole workspace into
// five app images is what took a release generation to ~18 GB. The hand-written list is
// the price of that, and a hand-written list drifts the moment a new package appears:
// `@sparx/field-schema` landed under commerce-schemas and cms-schemas, both apps' images
// were built without it, and `Module not found: Can't resolve '@sparx/field-schema'` came
// back three minutes into the release — for a fact that was knowable from two package.json
// files before the push.
//
// The check is the closure, not the direct deps: the filtered install resolves what a
// package DECLARES, not what a surface imports, so a transitive member left out of the
// COPY list leaves a dangling symlink the build cannot resolve.
//
// Usage:  node scripts/check-dockerfile-deps.mjs        (exit 1 on drift)
// Pure Node, no install — runs in CI before anything is built.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Read every workspace package: name → { dir, workspace deps }. */
function readWorkspace() {
  const pkgs = new Map();
  for (const group of ['apps', 'services', 'packages']) {
    const groupDir = join(repoRoot, group);
    if (!existsSync(groupDir)) continue;
    for (const entry of readdirSync(groupDir)) {
      const manifest = join(groupDir, entry, 'package.json');
      if (!existsSync(manifest)) continue;
      const json = JSON.parse(readFileSync(manifest, 'utf8'));
      const deps = Object.entries({ ...json.dependencies, ...json.devDependencies })
        .filter(([, range]) => String(range).startsWith('workspace:'))
        .map(([name]) => name);
      pkgs.set(json.name, { dir: `${group}/${entry}`, deps });
    }
  }
  return pkgs;
}

/** The full transitive workspace closure of a package, excluding itself. */
function closure(pkgs, name, seen = new Set()) {
  for (const dep of pkgs.get(name)?.deps ?? []) {
    if (seen.has(dep)) continue;
    seen.add(dep);
    closure(pkgs, dep, seen);
  }
  return seen;
}

const pkgs = readWorkspace();
const byDir = new Map([...pkgs].map(([name, p]) => [p.dir, name]));

// The subject is what the RELEASE BUILDS — the build matrix in release.yml, read from
// the workflow rather than restated here, so adding an image to the pipeline covers it
// automatically and this file cannot fall out of step with what ships.
//
// Within that set, only the Dockerfiles that hand-list packages are checked: one with no
// `COPY packages/…` line builds FROM the shared base (the whole workspace) and cannot get
// this wrong.
const releaseYml = readFileSync(join(repoRoot, '.github/workflows/release.yml'), 'utf8');
const shipped = new Set(
  [...releaseYml.matchAll(/dockerfile:\s*([\w./-]+\/Dockerfile)/g)].map((m) => m[1])
);

const targets = [];
const orphans = [];
for (const group of ['apps', 'services', 'packages']) {
  const groupDir = join(repoRoot, group);
  if (!existsSync(groupDir)) continue;
  for (const entry of readdirSync(groupDir)) {
    const rel = `${group}/${entry}/Dockerfile`;
    if (!existsSync(join(repoRoot, rel))) continue;
    if (!shipped.has(rel)) {
      orphans.push(rel);
      continue;
    }
    const text = readFileSync(join(repoRoot, rel), 'utf8');
    if (!/^COPY packages\//m.test(text)) continue;
    targets.push({ dir: `${group}/${entry}`, text });
  }
}

const problems = [];
for (const { dir, text } of targets) {
  const name = byDir.get(dir);
  if (!name) continue;

  // Two shapes are in use, and both are fine:
  //
  //   two-phase (the Next.js apps) — every package.json first, so the filtered install can
  //     resolve the links, then the source trees after it. BOTH lines are required: a
  //     manifest with no source is a dangling symlink, a source with no manifest never
  //     gets installed.
  //   one-phase (the small workers) — the whole package dir up front, then install.
  //
  // Which one a Dockerfile uses is read off the file rather than configured, so neither
  // has to be declared anywhere and a third shape is a check change, not a silent pass.
  const manifestCopies = new Set(
    [...text.matchAll(/^COPY packages\/([a-z0-9-]+)\/package\.json/gm)].map((m) => m[1])
  );
  const dirCopies = new Set(
    [...text.matchAll(/^COPY packages\/([a-z0-9-]+) +\.?\/?packages\//gm)].map((m) => m[1])
  );
  const twoPhase = manifestCopies.size > 0;

  for (const dep of closure(pkgs, name)) {
    const depDir = pkgs.get(dep)?.dir;
    if (!depDir?.startsWith('packages/')) continue;
    const slug = depDir.slice('packages/'.length);
    if (twoPhase && !manifestCopies.has(slug)) {
      problems.push(
        `${dir}/Dockerfile: missing  COPY packages/${slug}/package.json packages/${slug}/`
      );
    }
    if (!dirCopies.has(slug)) {
      problems.push(`${dir}/Dockerfile: missing  COPY packages/${slug} packages/${slug}`);
    }
  }
}

if (problems.length) {
  console.error('Dockerfile dependency drift — an image would be built without code it imports:\n');
  for (const p of problems) console.error(`  ${p}`);
  console.error(
    `\n${problems.length} missing COPY line(s). Add them (both spellings, in the matching block)` +
      ' — or drop the unused workspace dependency from the app package.json.'
  );
  process.exit(1);
}

console.log(
  `check-dockerfile-deps: ${targets.length} hand-listed image(s), every workspace dependency copied.`
);

// Not a failure — a Dockerfile the release does not build is dead weight, not a broken
// image. Said out loud so it stays a decision (delete it, or add it to the matrix) rather
// than a file that quietly rots until someone tries to build it.
if (orphans.length) {
  console.log(`\nNot built by release.yml (unchecked): ${orphans.join(', ')}`);
}
