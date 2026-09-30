// Regenerate the pane tables in piggles/docs/personas/rating.md.
//
// The ratings exercise asks for a score on EVERY pane, so the list has to be the
// shipped one — a hand-kept table is one surface behind within a week, and an
// absent row reads as a covered pane rather than as a missing one.
//
// Three sources, because a pane is only what a person can actually open and read:
//   catalog/*.ts          every registered surface
//   console/vocabulary.ts what Piggles CALLS it — a raw catalog title is sparx's
//                         word for it, and the exercise judges what she reads
//   console/product.tsx   hiddenSurfaces, which are not Piggles panes at all
//
// Grouped by app through `modules` and `claims` in packages/config/src/apps.ts,
// so Partners shows the supplier screens it claims from Stock rather than none.
//
// Rewrites only between the PANES:START / PANES:END markers, so the rubric above
// them and the scores already entered in other sections survive. Scores inside
// the generated block do NOT survive — regenerate before a run, not during one.
//
// That last sentence used to be the ONLY protection, and a comment protects
// nothing: running this mid-run on 2026-09-23 blanked 247 scored rows. It now
// refuses when the block already carries scores, and --force is the deliberate
// reset. See the guard further down.
//
//   node piggles/scripts/gen-pane-ratings.mjs
//   node piggles/scripts/gen-pane-ratings.mjs --force   # reset every score

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'g:/code/@wizeworks/sparx.works';
const CATALOG = join(ROOT, 'piggles/apps/workbench/lib/surfaces/catalog');
// Piggles registers one surface of its OWN outside that folder -- `piggles.home`,
// its answer to "what needs me today", which replaces the platform's Start here
// and is the first screen most people see. Scanning only `catalog/` left the
// most-opened pane in the console absent from the ratings table, and an absent
// row reads as a covered pane rather than a missing one, which is the thing
// this script exists to prevent.
const EXTRA_CATALOGS = [join(ROOT, 'piggles/apps/workbench/lib/surfaces/piggles-catalog.ts')];
const RATING = join(ROOT, 'piggles/docs/personas/rating.md');
const APPS_SRC = readFileSync(join(ROOT, 'piggles/packages/config/src/apps.ts'), 'utf8');
const PRODUCT_SRC = readFileSync(
  join(ROOT, 'piggles/apps/workbench/lib/console/product.tsx'),
  'utf8'
);
// What Piggles CALLS each screen. A raw catalog title is sparx's word for it,
// and the whole exercise judges what a person reads.
const VOCAB_SRC = readFileSync(
  join(ROOT, 'piggles/apps/workbench/lib/console/vocabulary.ts'),
  'utf8'
);
const vocab = new Map(
  [
    ...VOCAB_SRC.slice(VOCAB_SRC.indexOf('PIGGLES_SURFACES')).matchAll(
      /^[ 	]*'([a-z0-9._-]+)':[ 	]*'([^']*)',/gm
    ),
  ].map((m) => [m[1], m[2]])
);

// ── hidden surfaces ─────────────────────────────────────────────────────────
const hiddenBlock = PRODUCT_SRC.slice(
  PRODUCT_SRC.indexOf('const hiddenSurfaces'),
  PRODUCT_SRC.indexOf('const hiddenFeatures')
);
const hidden = new Set([...hiddenBlock.matchAll(/'([a-z0-9_.-]+)'/g)].map((m) => m[1]));

// ── app registry ────────────────────────────────────────────────────────────
const apps = [];
const blocks = APPS_SRC.split(/\n\s*\{\s*\n\s*id: '/).slice(1);
for (const b of blocks) {
  const id = b.slice(0, b.indexOf("'"));
  const label = b.match(/label: '([^']+)'/)?.[1] ?? id;
  const modules = [...(b.match(/modules: \[([^\]]*)\]/)?.[1] ?? '').matchAll(/'([^']+)'/g)].map(
    (x) => x[1]
  );
  const claims = [...(b.match(/claims: \[([\s\S]*?)\]/)?.[1] ?? '').matchAll(/'([^']+)'/g)].map(
    (x) => x[1]
  );
  apps.push({ id, label, modules, claims });
}
const claimedBy = new Map();
for (const a of apps) for (const k of a.claims) claimedBy.set(k, a.id);
const appForModule = new Map();
for (const a of apps)
  for (const m of a.modules) if (!appForModule.has(m)) appForModule.set(m, a.id);

// ── surfaces: split each file on `key:` and read the object that follows ─────
const surfaces = [];
const catalogFiles = [
  ...readdirSync(CATALOG)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => join(CATALOG, f)),
  ...EXTRA_CATALOGS,
];
for (const file of catalogFiles) {
  const src = readFileSync(file, 'utf8');
  const marks = [...src.matchAll(/^\s*key: '([^']+)',/gm)];
  marks.forEach((m, i) => {
    const body = src.slice(m.index, marks[i + 1]?.index ?? src.length);
    const title = body.match(/^\s*title: '([^']*)'/m)?.[1] ?? null;
    const module = body.match(/^\s*module: '([^']+)'/m)?.[1] ?? null;
    surfaces.push({ key: m[1], title: vocab.get(m[1]) ?? title, module });
  });
}

// ── group + render ──────────────────────────────────────────────────────────
const byApp = new Map(apps.map((a) => [a.id, []]));
const unmapped = [];
for (const s of surfaces) {
  if (hidden.has(s.key)) continue;
  const appId = claimedBy.get(s.key) ?? appForModule.get(s.module);
  if (appId && byApp.has(appId)) byApp.get(appId).push(s);
  else unmapped.push(s);
}

const out = [];
let total = 0;
const render = (label, list) => {
  if (!list.length) return;
  total += list.length;
  out.push(`### ${label} — ${list.length} pane${list.length === 1 ? '' : 's'}\n`);
  out.push('| Pane | Key | Design | Ease | Gap to 10 | Persona |');
  out.push('| ---- | --- | ------ | ---- | --------- | ------- |');
  for (const s of list.sort((a, b) => a.key.localeCompare(b.key)))
    out.push(`| ${s.title ?? '(depends on what is open)'} | \`${s.key}\` | — | — | — | — |`);
  out.push('');
};
for (const a of apps) render(a.label, byApp.get(a.id));
render('Not reachable from any app rail', unmapped);

const file = readFileSync(RATING, 'utf8');
const A = '<!-- PANES:START -->';
const B = '<!-- PANES:END -->';

// REFUSE to overwrite scores. The header above says "regenerate before a run,
// not during one" and that was the whole protection: on 2026-09-23 this ran
// mid-run and blanked 247 rows of persona work, which took a transcript dig and
// a stale backup to get back, and four rows never came back at all. A comment is
// not a guard. This is.
//
// --force is the way through, for the one legitimate case: a deliberate reset.
const block = file.slice(file.indexOf(A) + A.length, file.indexOf(B));
const alreadyScored = block.split(/\r?\n/).filter((line) => /^\|[^|]*\|[^|]*\|\s*[0-9]/.test(line));
if (alreadyScored.length > 0 && !process.argv.includes('--force')) {
  console.error(
    [
      `REFUSING to regenerate: ${alreadyScored.length} row(s) between the markers already carry a score.`,
      'Regenerating blanks every one of them, and an uncommitted run is not recoverable from git.',
      'Rate a new pane by EDITING its row. Only if you mean to reset the table: --force',
    ].join('\n')
  );
  process.exit(1);
}
const next =
  file.slice(0, file.indexOf(A) + A.length) +
  '\n\n' +
  out.join('\n') +
  '\n' +
  file.slice(file.indexOf(B));
writeFileSync(
  RATING,
  next.replace(/\*\*Scored so far: 0 of \d+\.\*\*/, `**Scored so far: 0 of ${total}.**`)
);
console.log(
  `${total} panes across ${apps.length} apps, ${unmapped.length} unmapped, ` +
    `${hidden.size} hidden, ${vocab.size} titles from vocabulary.ts`
);
