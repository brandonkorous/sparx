// Regenerate the pane tables in sparx/docs/personas/rating.md.
//
// The ratings exercise asks for a score on EVERY pane in the sparx workbench, so
// the list has to be the shipped one: a hand-kept table is one surface behind
// within a week, and an absent row reads as a covered pane rather than a missing one.
//
// Source: every surface registered in sparx/apps/workbench/lib/surfaces/catalog/*.ts,
// grouped by its `module`, with the group named the way the rail names it
// (MODULE_LABELS in lib/surfaces/nav.ts), because rating a screen means rating
// the words on it.
//
// A dynamic title (`title: (params) => …`) is written as both branches it can
// print ("New account / Account"), since that is what a person can see.
//
// Rewrites only between the PANES:START / PANES:END markers, and REFUSES when
// the block already carries a score: the Piggles twin of this script blanked 247
// scored rows by being run mid-run. --force is the deliberate reset.
//
//   node sparx/docs/personas/tools/gen-pane-ratings.mjs
//   node sparx/docs/personas/tools/gen-pane-ratings.mjs --force   # reset every score

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve the repo root from this file, never by counting `..` from the cwd.
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../..');
const CATALOG = join(ROOT, 'sparx/apps/workbench/lib/surfaces/catalog');
const NAV = join(ROOT, 'sparx/apps/workbench/lib/surfaces/nav.ts');
const RATING = join(ROOT, 'sparx/docs/personas/rating.md');

// A scan root that no longer exists must fail, not print an empty table green.
for (const p of [CATALOG, NAV, RATING]) {
  if (!existsSync(p)) {
    console.error(`REFUSING: ${p} does not exist. The catalog moved; fix this script.`);
    process.exit(1);
  }
}

const navSrc = readFileSync(NAV, 'utf8');
const labelBlock = navSrc.slice(
  navSrc.indexOf('const MODULE_LABELS'),
  navSrc.indexOf('};', navSrc.indexOf('const MODULE_LABELS'))
);
const labels = new Map(
  [...labelBlock.matchAll(/^\s*([a-z0-9_]+):\s*'([^']+)'/gm)].map((m) => [m[1], m[2]])
);

const surfaces = [];
const files = readdirSync(CATALOG).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
for (const f of files) {
  const src = readFileSync(join(CATALOG, f), 'utf8');
  const marks = [...src.matchAll(/^\s*key: '([^']+)',/gm)];
  marks.forEach((m, i) => {
    const body = src.slice(m.index, marks[i + 1]?.index ?? src.length);
    let title = body.match(/^\s*title: '([^']*)'/m)?.[1] ?? null;
    if (!title) {
      const fn = body.match(/^\s*title: \([^)]*\) =>([\s\S]*?),\n\s*[a-zA-Z]+:/m)?.[1] ?? '';
      const quoted = [...fn.matchAll(/'([^']+)'/g)].map((q) => q[1]).filter((q) => q !== 'new');
      title = quoted.length ? quoted.join(' / ') : null;
    }
    const module = body.match(/^\s*module: '([^']+)'/m)?.[1] ?? '(no module)';
    const listed = !/^\s*listed: false/m.test(body);
    surfaces.push({ key: m[1], title, module, listed });
  });
}
if (surfaces.length === 0) {
  console.error('REFUSING: found 0 surfaces. The key pattern no longer matches the catalog.');
  process.exit(1);
}

const byModule = new Map();
for (const s of surfaces) {
  if (!byModule.has(s.module)) byModule.set(s.module, []);
  byModule.get(s.module).push(s);
}

const out = [];
const groups = [...byModule.entries()].sort((a, b) =>
  (labels.get(a[0]) ?? a[0]).localeCompare(labels.get(b[0]) ?? b[0])
);
for (const [module, list] of groups) {
  const label = labels.get(module) ?? module;
  out.push(`### ${label} (\`${module}\`) — ${list.length} pane${list.length === 1 ? '' : 's'}\n`);
  out.push('| Pane | Key | Design | Ease | Gap to 10 | Persona |');
  out.push('| ---- | --- | ------ | ---- | --------- | ------- |');
  for (const s of list.sort((a, b) => a.key.localeCompare(b.key))) {
    const name = s.title ?? '(depends on what is open)';
    const opened = s.listed ? '' : ' _(opened from a list)_';
    out.push(`| ${name}${opened} | \`${s.key}\` | — | — | — | — |`);
  }
  out.push('');
}

const file = readFileSync(RATING, 'utf8');
const A = '<!-- PANES:START -->';
const B = '<!-- PANES:END -->';
if (!file.includes(A) || !file.includes(B)) {
  console.error('REFUSING: rating.md has lost its PANES markers.');
  process.exit(1);
}
const block = file.slice(file.indexOf(A) + A.length, file.indexOf(B));
const scored = block
  .split(/\r?\n/)
  .filter((l) => l.startsWith('|'))
  .map((l) => l.split('|').map((c) => c.trim()))
  .filter((c) => c.length > 4 && /^[0-9]/.test(c[3] ?? ''));
if (scored.length > 0 && !process.argv.includes('--force')) {
  console.error(
    `REFUSING to regenerate: ${scored.length} row(s) already carry a score. ` +
      'Rate a pane by EDITING its row. Only to reset the table on purpose: --force'
  );
  process.exit(1);
}
const next =
  file.slice(0, file.indexOf(A) + A.length) + '\n\n' + out.join('\n') + '\n' + file.slice(file.indexOf(B));
writeFileSync(
  RATING,
  next.replace(/\*\*Scored so far: \d+ of \d+ panes\.\*\*/, `**Scored so far: 0 of ${surfaces.length} panes.**`)
);
console.log(
  `${surfaces.length} panes in ${byModule.size} groups from ${files.length} catalog files ` +
    `(${surfaces.filter((s) => !s.listed).length} opened from a list, not the launcher)`
);
