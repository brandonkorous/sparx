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
//   node piggles/scripts/gen-pane-ratings.mjs

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'g:/code/@wizeworks/sparx.works';
const CATALOG = join(ROOT, 'piggles/apps/workbench/lib/surfaces/catalog');
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
for (const file of readdirSync(CATALOG).filter((f) => f.endsWith('.ts'))) {
  const src = readFileSync(join(CATALOG, file), 'utf8');
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
