// Every app has a door, a glyph, and something behind it.
//
// Three lists have to agree and nothing made them:
//
//   · `APPS`      (@piggles/config/apps)      — the rail and the All apps dialog
//   · `APP_ICONS` (@piggles/config/app-icons) — the glyph each door wears
//   · the surface catalog                     — the screens, each tagged `module:`
//
// They drifted, and both failures are invisible:
//
//   1. `funnels` shipped two real surfaces ("Campaigns"), a hue in both brands and
//      a slot in the nav's module order — and NO app claimed it. So a business with
//      the app switched on had no door to it: not on the rail, not in All apps,
//      which says "Everything Piggles does". Reachable only by search, or by a pane
//      somebody had already opened.
//   2. `APP_ICONS` falls back to `faHouse` for an unknown id, on purpose ("visibly
//      wrong beats absent"). Campaigns therefore arrived wearing Home's glyph. That
//      relies on somebody looking at the right screen on the right day.
//
// Neither is a type error: `APPS[].modules` is `string[]` and `APP_ICONS` is
// `Record<string, …>`, so both lists typecheck while incomplete.
//
// HIDDEN SURFACES DO NOT NEED A DOOR. `partner.*` is sparx's reseller programme and
// is excluded from this brand outright (piggles/CLAUDE.md), so its eight surfaces are
// correctly unreachable. The check reads that exclusion list rather than carrying its
// own copy, or it would be a third list that has to agree with the other three.
//
// Parsed from source rather than imported: this package is TS with no build step,
// and a check that needs a compile is a check that gets skipped.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PIGGLES = join(HERE, '..');
const CONFIG = join(PIGGLES, 'packages/config/src');
const CATALOG = join(PIGGLES, 'apps/workbench/lib/surfaces/catalog');
const PRODUCT = join(PIGGLES, 'apps/workbench/lib/console/product.tsx');

/** Read a file that MUST exist. A check whose input silently vanished reports
 *  green over nothing, which is how five of these went blind in one tree move. */
function must(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    console.error(`check:piggles-apps — cannot read ${path}. The check would pass over nothing.`);
    process.exit(1);
  }
}

/** The same, for a directory. `must` covered the file reads and this did not, so a
 *  moved catalog crashed with a raw ENOENT stack instead of saying which path was
 *  wrong — loud enough to fail, useless for fixing. */
function mustDir(path) {
  try {
    return readdirSync(path);
  } catch {
    console.error(`check:piggles-apps — cannot list ${path}. The surface catalog has moved.`);
    process.exit(1);
  }
}

const appsSrc = must(join(CONFIG, 'apps.ts'));
const iconsSrc = must(join(CONFIG, 'app-icons.ts'));

// One entry per app: its id, and the module identities it gathers.
const apps = [];
for (const block of appsSrc.split(/\n\s*\{\s*\n/).slice(1)) {
  const id = block.match(/id: '([a-z_]+)'/)?.[1];
  if (!id) continue;
  const modules = block.match(/modules: \[([^\]]*)\]/)?.[1] ?? '';
  apps.push({ id, modules: [...modules.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]) });
}
if (apps.length === 0) {
  console.error('check:piggles-apps — parsed ZERO apps from apps.ts. The parser is broken.');
  process.exit(1);
}

const iconKeys = new Set(
  [
    ...(iconsSrc.match(/APP_ICONS[^=]*=\s*\{([\s\S]*?)\n\};/)?.[1] ?? '').matchAll(
      /^\s{2}([a-z_]+):/gm
    ),
  ].map((m) => m[1])
);
if (iconKeys.size === 0) {
  console.error('check:piggles-apps — parsed ZERO icons from app-icons.ts. The parser is broken.');
  process.exit(1);
}

// What this brand excludes outright, read from the one list that decides it.
const hidden = [
  ...(must(PRODUCT).match(/hiddenSurfaces = new Set\(\[([\s\S]*?)\]\);/)?.[1] ?? '').matchAll(
    /'([a-z.*-]+)'/g
  ),
].map((m) => m[1]);
if (hidden.length === 0) {
  console.error('check:piggles-apps — parsed ZERO hidden surfaces. The parser is broken.');
  process.exit(1);
}
const isHidden = (key) =>
  hidden.some((entry) =>
    entry.endsWith('.*') ? key.startsWith(entry.slice(0, -1)) : entry === key
  );

// Every module identity a registered, VISIBLE surface declares. Keys and modules are
// read as a pair, because a module is only unreachable if none of its surfaces show.
const surfaceModules = new Set();
let catalogFiles = 0;
let hiddenSurfaces = 0;
for (const name of mustDir(CATALOG)) {
  if (!name.endsWith('.ts') || name === 'index.ts') continue;
  catalogFiles += 1;
  const src = must(join(CATALOG, name));
  for (const m of src.matchAll(/key: '([a-z.\-]+)',[\s\S]{0,400}?module: '([a-z-]+)'/g)) {
    if (isHidden(m[1])) {
      hiddenSurfaces += 1;
      continue;
    }
    surfaceModules.add(m[2]);
  }
}
if (surfaceModules.size === 0) {
  console.error('check:piggles-apps — found no surfaces. The catalog path is wrong.');
  process.exit(1);
}

const claimed = new Set(apps.flatMap((a) => a.modules));
const problems = [];

for (const app of apps) {
  if (!iconKeys.has(app.id)) {
    problems.push(`app "${app.id}" has no icon — it renders as Home's glyph`);
  }
}
for (const module of [...surfaceModules].sort()) {
  if (!claimed.has(module)) {
    problems.push(
      `module "${module}" has surfaces and no app claims it — there is no door to it in the rail or All apps`
    );
  }
}

if (problems.length > 0) {
  console.error('check:piggles-apps — the app catalogue is incomplete:');
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

console.log(
  `check:piggles-apps — ${String(apps.length)} apps, all with a glyph; ` +
    `${String(surfaceModules.size)} visible module identities across ${String(catalogFiles)} catalog files, all with a door ` +
    `(${String(hiddenSurfaces)} surfaces excluded from this brand).`
);
