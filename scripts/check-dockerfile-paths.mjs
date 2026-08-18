#!/usr/bin/env node
/**
 * Does every Dockerfile path still point at something?
 *
 * ---------------------------------------------------------------------------
 * The problem this exists for
 * ---------------------------------------------------------------------------
 *
 * A Dockerfile names the repository's layout in three places that must agree:
 * what it COPIES, where it copies it TO, and the WORKDIR it then runs from.
 * Nothing checks that they do. `check-dockerfile-deps.mjs` — the sibling of
 * this file — asks whether an image includes the workspace packages it imports,
 * which is a question about the dependency graph, not about paths.
 *
 * So when the three-tree move rewrote `apps/`, `packages/` and `services/` into
 * `wizeworks/`, `sparx/` and `piggles/`, it went wrong in two different ways at
 * once and neither was caught by anything:
 *
 *   • Five Next.js images had their builder stage and CMD updated and their
 *     RUNNER stage missed, so they still copied from `/repo/apps/<app>`. That
 *     one at least failed the build — buildx cannot checksum a directory that
 *     is not there.
 *
 *   • Two worker images had their COPY SOURCES updated and their DESTINATIONS
 *     left on the old layout, landing the code at `/app/services/<name>` while
 *     WORKDIR pointed at `/app/wizeworks/services/<name>`. That builds green.
 *     The container starts in a directory Docker helpfully created and left
 *     empty, and dies looking for its entrypoint. A build says nothing about
 *     where a file ended up.
 *
 * The second kind is why this is worth a check rather than a careful read: it
 * is invisible until something tries to run, and the thing that tries to run is
 * production.
 *
 * ---------------------------------------------------------------------------
 * The three rules
 * ---------------------------------------------------------------------------
 *
 *   1. Every COPY source resolves to something that exists in the repo.
 *   2. A source under a product tree lands at the SAME path in the image.
 *      Dropping the prefix breaks both the pnpm-workspace globs (which name
 *      `wizeworks/packages/*`) and every path written relative to the root.
 *   3. Every WORKDIR naming a product tree is a path something was copied to.
 *
 * Pure Node, no install. Same family as check:events / check:routes /
 * check:docker / check:boundaries / check:deletability.
 */
import fs from 'node:fs';
import path from 'node:path';

/** Resolve the repo root by its marker, never by counting `..` up from here. */
function repoRoot() {
  let dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  for (let i = 0; i < 10; i += 1) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  throw new Error('check:dockerfile-paths — could not find pnpm-workspace.yaml above this script');
}

const ROOT = repoRoot();
const TREES = ['wizeworks', 'sparx', 'piggles'];
const SKIP = new Set(['node_modules', '.git', '.next', '.turbo', 'dist', 'build']);

/** Every Dockerfile in the repo. */
function dockerfiles() {
  const found = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.startsWith('Dockerfile')) found.push(path.relative(ROOT, p));
    }
  })(ROOT);
  return found.sort();
}

const files = dockerfiles();
if (files.length === 0) {
  // The scan root going empty is the failure mode this whole family of checks
  // keeps re-learning: a check that inspects nothing reports success.
  console.error('check:dockerfile-paths — found no Dockerfiles at all. Is the scan root right?');
  process.exit(1);
}

const norm = (p) => p.replace(/^\.\//, '').replace(/\/+$/, '');
const inTree = (p) => TREES.some((t) => p === t || p.startsWith(`${t}/`));

const problems = [];
let copies = 0;

for (const file of files) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  // Line continuations first, so a wrapped COPY is one statement.
  const lines = src.replace(/\\\r?\n\s*/g, ' ').split('\n');
  const copiedTo = [];

  lines.forEach((line, index) => {
    const at = `${file}:${index + 1}`;

    // A stage-to-stage copy. The source is the BUILDER's filesystem, not the
    // repo, so it cannot simply be stat'd — but the builder's WORKDIR is /repo,
    // so everything under it is a repo path with build OUTPUT appended. Strip
    // the output (`.next/...`) and what remains must exist here.
    //
    // This is the rule that covers the five Next.js images the tree move broke:
    // their runner stages still read `/repo/apps/workbench/...` long after
    // `apps/` stopped existing.
    const staged = /^\s*COPY\s+--from=\S+\s+(?:--\S+\s+)*(\/repo\/\S+)/.exec(line);
    if (staged) {
      const rel = norm(staged[1].replace(/^\/repo\//, ''));
      const upToOutput = rel.split('/');
      const cut = upToOutput.findIndex((seg) => seg.startsWith('.'));
      const check = (cut === -1 ? upToOutput : upToOutput.slice(0, cut)).join('/');
      copies += 1;
      if (check && !fs.existsSync(path.join(ROOT, check))) {
        problems.push(
          `${at}\n    COPY --from=… /repo/${rel}\n` +
            `    …but "${check}" does not exist in the repo, so the builder stage never\n` +
            `    produced it either. buildx fails computing the checksum.`
        );
      }
      return;
    }

    const copy = /^\s*COPY\s+(?!--from)(.+)$/.exec(line);
    if (copy) {
      const parts = copy[1]
        .trim()
        .split(/\s+/)
        .filter((p) => !p.startsWith('--'));
      if (parts.length < 2) return;
      const dest = norm(parts[parts.length - 1]);
      for (const raw of parts.slice(0, -1)) {
        const from = norm(raw);
        copies += 1;

        // Rule 1 — the source is really there. Globs are left alone; a `*` is a
        // deliberate "whatever matches" and has no single path to resolve.
        if (!from.includes('*') && !fs.existsSync(path.join(ROOT, from))) {
          problems.push(
            `${at}\n    COPY ${from}\n    …but nothing is at that path. It has moved or been deleted.`
          );
          continue;
        }

        // Rule 2 — a tree-prefixed source keeps its full path in the image.
        if (!inTree(from)) continue;
        const isFile =
          !from.includes('*') &&
          fs.existsSync(path.join(ROOT, from)) &&
          fs.statSync(path.join(ROOT, from)).isFile();
        const expected = isFile ? path.posix.dirname(from) : from;
        copiedTo.push(dest);
        if (dest !== expected && dest !== from) {
          problems.push(
            `${at}\n    COPY ${from} ${dest}\n` +
              `    …lands at "${dest}" but should land at "${expected}". Dropping the tree\n` +
              `    prefix breaks the pnpm-workspace globs (which name ${TREES[0]}/packages/*)\n` +
              `    and every path written relative to the repo root. This BUILDS — it fails\n` +
              `    when the container starts.`
          );
        }
      }
      return;
    }

    // Rule 3 — a WORKDIR naming a product tree must be somewhere we copied to.
    //
    // Only for images that assemble their OWN workspace. Most services are
    // three lines on top of Dockerfile.base, which already carries the whole
    // tree, so their WORKDIR is populated by the base and this file copies
    // nothing — asking where it came from would fail all eight of them.
    const workdir = /^\s*WORKDIR\s+(\S+)\s*$/.exec(line);
    if (workdir) {
      if (copiedTo.length === 0) return;
      const target = norm(workdir[1]).replace(/^\/(app|repo)\/?/, '');
      if (!target || !inTree(target)) return;
      if (!copiedTo.some((d) => d === target || target.startsWith(`${d}/`))) {
        problems.push(
          `${at}\n    WORKDIR ${workdir[1]}\n` +
            `    …but nothing was copied there. Docker CREATES a missing WORKDIR, so the\n` +
            `    image builds and the container starts in an empty directory.`
        );
      }
    }
  });
}

if (problems.length > 0) {
  console.error(`\ncheck:dockerfile-paths FAILED — ${problems.length} problem(s)\n`);
  for (const p of problems) console.error(`  ${p}\n`);
  process.exit(1);
}

console.log(
  `OK: ${copies} COPY paths across ${files.length} Dockerfiles resolve, keep their tree prefix, and satisfy every WORKDIR.`
);
