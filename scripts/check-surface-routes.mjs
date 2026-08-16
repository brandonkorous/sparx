// Fails if a workbench surface has no address, or an address names a surface
// that does not exist.
//
// WHY THIS IS A SCRIPT AND NOT A TEST. The invariant spans two things that
// cannot meet at runtime: the route table in `@sparx/links` (pure data, imported
// by Node services) and the surface registry in apps/workbench (which imports
// React, silicaui, and all 233 pane components). A vitest that imported the
// registry would drag the entire UI into a data check. Both sides declare their
// keys as string literals, so reading the literals is both sufficient and
// immune to the import graph.
//
// The two failure directions are NOT symmetrical, and both matter:
//
//   • A surface with no route is a pane nobody can link to. Silent — it simply
//     never appears in a shared link, and the address bar falls back to `/`
//     whenever it is focused. This is the direction that rots as surfaces get
//     added, which is the whole reason this check exists.
//   • A route with no surface is a link that opens nothing. Loud for whoever
//     clicks it, invisible to whoever sent it — this is exactly how
//     `/?surface=social.composer` survived in production email for months.
//
// Zero dependencies on purpose: CI runs it with bare Node, no install.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

// BOTH consoles, because both address their panes out of the one route table.
//
// It scanned sparx's catalog alone for a long time, and piggles' own studio panes —
// its page, header, look, saved-piece, history and preview builders — went six phases
// with no address at all. Nothing failed: an unaddressed pane just falls back to `/`,
// so the bar goes blank when you focus it and a link to a page editor cannot be sent.
// A check that covers one of two apps reads exactly like a check that covers both.
const CATALOG_DIRS = [
  'apps/workbench/lib/surfaces/catalog',
  'piggles/apps/workbench/lib/surfaces/catalog',
];
const ROUTES_FILE = 'packages/links/src/routes.ts';

/** Strip `//` line comments so a key quoted inside prose is not read as a declaration. */
function decomment(source) {
  return source
    .split('\n')
    .map((line) => {
      const marker = line.indexOf('//');
      return marker === -1 ? line : line.slice(0, marker);
    })
    .join('\n');
}

function collect(source, pattern) {
  const found = new Set();
  for (const match of decomment(source).matchAll(pattern)) found.add(match[1]);
  return found;
}

// --- Registered surfaces ----------------------------------------------------
// The UNION of both catalogs. A key either console registers must be addressable,
// and a route either console can serve is not orphaned.
const surfaces = new Set();
for (const dir of CATALOG_DIRS) {
  for (const file of readdirSync(join(repoRoot, dir))) {
    if (!file.endsWith('.ts')) continue;
    const source = readFileSync(join(repoRoot, dir, file), 'utf8');
    for (const key of collect(source, /\bkey:\s*'([^']+)'/g)) surfaces.add(key);
  }
}

// --- Addressed surfaces -----------------------------------------------------
const routed = collect(
  readFileSync(join(repoRoot, ROUTES_FILE), 'utf8'),
  /\bsurface:\s*'([^']+)'/g
);

if (surfaces.size === 0 || routed.size === 0) {
  console.error(
    `check-surface-routes: read ${surfaces.size} surfaces and ${routed.size} routes — one of the two files changed shape. Fix this script before trusting it.`
  );
  process.exit(1);
}

const unaddressed = [...surfaces].filter((key) => !routed.has(key)).sort();
const orphaned = [...routed].filter((key) => !surfaces.has(key)).sort();

if (unaddressed.length > 0) {
  console.error(
    `\n${unaddressed.length} surface(s) have no address. Add a route to ${ROUTES_FILE} for each:\n`
  );
  for (const key of unaddressed) console.error(`  ${key}`);
}

if (orphaned.length > 0) {
  console.error(
    `\n${orphaned.length} route(s) name a surface that is not registered. Either the surface key was renamed (which orphans every link already sent — prefer an alias) or the route is stale:\n`
  );
  for (const key of orphaned) console.error(`  ${key}`);
}

if (unaddressed.length > 0 || orphaned.length > 0) {
  console.error('');
  process.exit(1);
}

console.log(`check-surface-routes: ${surfaces.size} surfaces, all addressed.`);
