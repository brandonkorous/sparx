#!/usr/bin/env node
// A pane's layout follows the PANE, not the window (persona issue 263).
//
// Panes sit side by side, so a pane can be narrow in a wide window. Window
// breakpoints (`sm:`, `md:`, `lg:`, `xl:`, `2xl:`) pick a layout for a width the
// pane does not have; pane code uses container variants (`@xl:`, `@3xl:`, ...)
// under the pane's `@container`. Full-window places (the onboarding wizard, the
// consent box, the top bar, window-level dialogs) are listed as WINDOW_LEVEL.
//
// Run: node scripts/check-pane-breakpoints.mjs

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const CONSOLES = ['sparx/apps/workbench', 'piggles/apps/workbench'];
const SCAN = ['surfaces', 'components'];

/** Full-window places, where the window's width IS the width. */
const WINDOW_LEVEL = [
  'components/consent-ask.tsx',
  'components/all-apps-dialog.tsx',
  'components/topbar/',
  'surfaces/onboarding/wizard/',
];

/** Piggles files over its 250-line rule, left until each is split (the owner's
 *  choice for this kind of sweep, 2026-10-13). An entry that no longer offends fails. */
const PIGGLES_DEBT = [
  'piggles/apps/workbench/surfaces/social/inbox.tsx',
  'piggles/apps/workbench/surfaces/social/composer.tsx',
  'piggles/apps/workbench/surfaces/commerce/product-trade-pricing.tsx',
];

const WINDOW_VARIANT = /(^|[\s"'`{(])(sm|md|lg|xl|2xl):[a-z[-]/g;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (entry.endsWith('.tsx') && !entry.includes('.test.')) out.push(p);
  }
  return out;
}

let files = 0;
const offenders = new Map();
for (const console_ of CONSOLES) {
  for (const sub of SCAN) {
    const dir = join(ROOT, console_, sub);
    if (!existsSync(dir)) {
      console.error(
        `check:pane-breakpoints: ${console_}/${sub} is missing, so this check would see nothing.`
      );
      process.exit(1);
    }
    for (const file of walk(dir)) {
      files++;
      const rel = relative(ROOT, file).split(sep).join('/');
      const inConsole = rel.slice(console_.length + 1);
      if (WINDOW_LEVEL.some((w) => inConsole === w || (w.endsWith('/') && inConsole.startsWith(w))))
        continue;
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
        if (WINDOW_VARIANT.test(line)) {
          if (!offenders.has(rel)) offenders.set(rel, []);
          offenders.get(rel).push(i + 1);
        }
        WINDOW_VARIANT.lastIndex = 0;
      });
    }
  }
}

if (files < 100) {
  console.error(
    `check:pane-breakpoints: scanned only ${String(files)} files; the console folders have moved.`
  );
  process.exit(1);
}

const stale = PIGGLES_DEBT.filter((p) => !offenders.has(p));
const fresh = [...offenders.keys()].filter((p) => !PIGGLES_DEBT.includes(p));
if (fresh.length > 0 || stale.length > 0) {
  for (const p of fresh)
    console.error(
      `  ${p}:${offenders.get(p).join(',')}  window breakpoint in a pane; use the @container variant`
    );
  for (const p of stale)
    console.error(`  ${p}  is in PIGGLES_DEBT but no longer offends; take it off the list`);
  console.error(`\n✗ check:pane-breakpoints: ${String(fresh.length + stale.length)} problem(s).`);
  process.exit(1);
}
console.log(
  `✓ check:pane-breakpoints: ${String(files)} files: every pane lays out by its own width (${String(PIGGLES_DEBT.length)} Piggles files listed as debt).`
);
