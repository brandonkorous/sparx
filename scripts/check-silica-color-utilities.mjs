#!/usr/bin/env node
// REGISTERING A COLOR AND DECLARING IT ARE TWO DIFFERENT JOBS.
//
// Every app names its colors twice, and has to:
//
//   @plugin '@wizeworks/silicaui' { colors: primary, module, module-chat, …; }
//   @theme inline { --color-module: var(--color-module); … }
//
// The FIRST is silicaui's registration. Its plugin emits the component classes
// (`btn-module`, `badge-module`) and exactly three color utilities per name:
// `bg-*`, `text-*`, `border-*`. It puts nothing in Tailwind's theme namespace.
//
// The SECOND is that namespace. Every OTHER namespaced color utility is built by
// Tailwind from it — `ring-*`, `outline-*`, `divide-*`, `caret-*`, `decoration-*`,
// `from-*`, `to-*`, `shadow-*`, `accent-*`.
//
// A name in the first list and not the second looks completely normal and works
// for three utilities out of a dozen. Tailwind cannot warn about a class it
// cannot build, so it emits no rule and says nothing: the property keeps its
// default and the element draws the wrong color. `ring-module` did exactly that
// in thirteen places, drawing a near-black halo where the module hue was meant,
// including every "this is the one you picked" marker in the onboarding wizard.
// [[feedback_absent_behaves_like_fine]]
//
// The tenant site had already hit this and written the reason down in the header
// of `packages/silica-catalog/src/base-theme.css`: "registration and value are
// two different jobs". The consoles never got the second half.
// [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// So this check does not look at class names at all. It reads both lists out of
// each app's own CSS and fails on any name that is in one and not the other —
// which covers every utility family at once, including the ones nobody has
// reached for yet. [[feedback_structural_checks_go_blind]]

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Every app that registers colors with the plugin.
 *
 * `imports` names CSS this app pulls in that may declare the keys instead — the
 * tenant site declares its whole palette through silica-catalog's base-theme.css
 * and needs no block of its own.
 */
const APPS = [
  { css: 'piggles/apps/workbench/app/globals.css' },
  { css: 'piggles/apps/web/app/globals.css' },
  { css: 'sparx/apps/workbench/app/globals.css' },
  { css: 'sparx/apps/web/app/globals.css' },
  { css: 'sparx/apps/market/app/globals.css' },
  { css: 'wizeworks/apps/admin/app/globals.css' },
  {
    css: 'wizeworks/apps/site/app/globals.css',
    imports: ['wizeworks/packages/silica-catalog/src/base-theme.css'],
  },
];

function registeredColors(css) {
  const block = /@plugin\s+['"]@wizeworks\/silicaui['"]\s*\{([\s\S]*?)\}/.exec(css);
  if (!block) return null;
  const list = /colors\s*:([\s\S]*?);/.exec(block[1]);
  if (!list) return null;
  return list[1]
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);
}

/** Every `--color-<name>` declared in any `@theme` block in this CSS. */
function declaredColors(css) {
  const names = new Set();
  const re = /@theme[^{]*\{/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    // Walk to the matching close brace; @theme blocks do not nest here.
    let depth = 1;
    let i = re.lastIndex;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }
    const body = css.slice(re.lastIndex, i - 1);
    for (const hit of body.matchAll(/--color-([a-z0-9-]+)\s*:/g)) names.add(hit[1]);
  }
  return names;
}

let scanned = 0;
const problems = [];

for (const app of APPS) {
  const p = join(ROOT, app.css);
  if (!existsSync(p)) {
    console.error(`check:silica-colors FAILED — ${app.css} is missing.`);
    console.error('  The app list is stale, so this check was scanning less than it says.');
    process.exit(1);
  }
  let css = readFileSync(p, 'utf8');
  const registered = registeredColors(css);
  if (registered === null || registered.length === 0) {
    console.error(`check:silica-colors FAILED — no @plugin colors list in ${app.css}.`);
    console.error('  The block shape changed and this check would have read nothing.');
    process.exit(1);
  }
  for (const extra of app.imports ?? []) {
    const ip = join(ROOT, extra);
    if (!existsSync(ip)) {
      console.error(`check:silica-colors FAILED — ${app.css} names a missing import ${extra}.`);
      process.exit(1);
    }
    css += '\n' + readFileSync(ip, 'utf8');
  }
  const declared = declaredColors(css);
  scanned += 1;
  const missing = registered.filter((name) => !declared.has(name));
  if (missing.length > 0) problems.push({ app: app.css, missing, registered: registered.length });
}

if (problems.length > 0) {
  console.error('check:silica-colors FAILED — colors registered but not declared.');
  console.error('');
  console.error('  These names get bg-*, text-* and border-* and nothing else. Every other');
  console.error('  namespaced utility (ring-*, outline-*, divide-*, caret-*, from-*, to-*)');
  console.error('  silently draws the wrong color, with no error anywhere.');
  console.error('');
  for (const p of problems) {
    console.error(`  ${p.app}  (${String(p.missing.length)} of ${String(p.registered)})`);
    for (const name of p.missing) {
      console.error(`    add to its @theme inline block:  --color-${name}: var(--color-${name});`);
    }
  }
  process.exit(1);
}

console.log(`check:silica-colors PASS — ${String(scanned)} apps, every registered color declared.`);
