#!/usr/bin/env node
// The console's list of servable content kinds must match the site's routes.
//
// ---------------------------------------------------------------------------
// What this is for
// ---------------------------------------------------------------------------
//
// "New content" offers eleven kinds and the customer-facing site serves two.
// A published Event, Job posting or Help article reaches the catch-all, finds
// no silica page, no builder page and no `page` entry, and 404s — while the
// console says "Published · Live since…" over the address it printed.
//
// The console now says so, from `SITE_SERVED_TYPES` in
// `<app>/surfaces/cms/routable.ts`. That is a COPY of a fact owned by
// `wizeworks/apps/site/lib/content.ts`, and the workbench may not import the
// site app, so nothing in the type system holds the two together. This does.
//
// Add a route to the site and this goes red; the fix is to add the key to the
// console's list, which turns the ordinary promise back on for that kind. Take
// one away and it goes red the other way. Either way the console cannot end up
// promising an address nothing serves, which is the whole failure.
//
// Pure Node, no deps, like the other structural checks.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

// Resolved from THIS file, never by counting `..` from the shell's cwd — a
// check that resolves its roots by accident scans nothing after a tree move and
// prints green (see feedback_structural_checks_go_blind).
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const SITE_CONTENT = join(ROOT, 'wizeworks/apps/site/lib/content.ts');
const CONSOLES = [
  join(ROOT, 'piggles/apps/workbench/surfaces/cms/routable.ts'),
  join(ROOT, 'sparx/apps/workbench/surfaces/cms/routable.ts'),
];

let failed = false;
const fail = (message) => {
  console.error(`✗ ${message}`);
  failed = true;
};

// Every scan target must EXIST. A missing file is the failure, never a pass.
for (const path of [SITE_CONTENT, ...CONSOLES]) {
  if (!existsSync(path)) {
    fail(`missing file: ${relative(ROOT, path)}`);
  }
}
if (failed) process.exit(1);

/**
 * The content types the site resolves, read from its own by-slug calls.
 *
 * Every one looks like `{ tenant: tenantSlug, type: 'blog_post', slug }` beside
 * a `/v1/public/content/entries/by-slug` URL, so the types are exactly the
 * `type: '…'` literals in that file.
 */
const siteSource = readFileSync(SITE_CONTENT, 'utf8');
// Anchored on `tenant: tenantSlug` so this reads the CALL and not prose. A bare
// `type: '…'` also matches the TipTap `{type:'doc'}` written inside a comment
// three lines above, which reported `doc` as a route the site serves.
const served = [...siteSource.matchAll(/tenant:\s*tenantSlug,\s*type:\s*'([a-z0-9_]+)'/g)].map(
  (m) => m[1]
);
const siteTypes = [...new Set(served)].sort();

if (siteTypes.length === 0) {
  fail(
    `read no content types out of ${relative(ROOT, SITE_CONTENT)} — the file changed shape, so ` +
      `this check is scanning nothing. Fix the pattern rather than deleting the check.`
  );
  process.exit(1);
}

for (const path of CONSOLES) {
  const source = readFileSync(path, 'utf8');
  const block = /SITE_SERVED_TYPES\s*=\s*\[([^\]]*)\]/.exec(source);
  if (!block) {
    fail(`no SITE_SERVED_TYPES array in ${relative(ROOT, path)}`);
    continue;
  }
  const listed = [...block[1].matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]).sort();
  const missing = siteTypes.filter((t) => !listed.includes(t));
  const extra = listed.filter((t) => !siteTypes.includes(t));
  if (missing.length > 0 || extra.length > 0) {
    fail(
      `${relative(ROOT, path)} disagrees with the site's routes.\n` +
        `    site serves: ${siteTypes.join(', ')}\n` +
        `    console lists: ${listed.join(', ')}\n` +
        (missing.length > 0
          ? `    the site now serves ${missing.join(', ')} — add to the list\n`
          : '') +
        (extra.length > 0
          ? `    the site no longer serves ${extra.join(', ')} — remove from the list\n`
          : '')
    );
  }
}

if (failed) process.exit(1);
console.log(
  `✓ cms routes: ${CONSOLES.length} consoles agree the site serves ${siteTypes.join(', ')}`
);
