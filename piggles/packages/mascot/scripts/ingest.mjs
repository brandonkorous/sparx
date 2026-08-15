// Mascot ingest — turns a delivered art batch into shipped assets + a typed catalog.
//
// Run it after dropping a new batch into `piggles/images/mascot/<NN>/`:
//
//     pnpm --filter @piggles/mascot ingest
//
// It rewrites `src/catalog.ts` and the `public/mascot/` directory of every app in
// TARGETS. Both outputs are GENERATED and committed — review the diff, never hand-
// edit them. If a pose needs different metadata, fix the batch manifest and re-run.
//
// ── WHY THIS EXISTS AT ALL ───────────────────────────────────────────────────
//
// A batch is not shippable as delivered, for three reasons that are invisible in
// the manifest:
//
//  1. THE DECLARED DIMENSIONS ARE THE GENERATOR CANVAS, NOT THE ARTWORK. Batch 02
//     declares every pose 1536×1024 (ratio 1.50) while the pig herself occupies
//     41–55% of it — `piggles-thinking` is really 673×963, ratio 0.70. Hand those
//     numbers to `next/image` and the mascot renders half-size inside an invisible
//     box, and no two poses line up with each other. So every asset is trimmed to
//     its alpha bounding box and the catalog records the TRUE intrinsic size.
//
//  2. THE MASTERS ARE FULL-RESOLUTION. ~100KB of WebP per pose at 1254px+, for
//     artwork that displays at 96–448px. Capped at MAX_EDGE here; `next/image`
//     handles the rest per request.
//
//  3. THE BATCHES DISAGREE WITH EACH OTHER. 01 keys poses `wave` with `intent[]`
//     and flat `png`/`webp` paths; 02 keys them `piggles-wave` with `uses[]` and a
//     `formats{}` object. Normalising here is what lets product code keep saying
//     `pose="wave"` forever, whichever batch the art came from.
//
// ── THE BATCH NUMBER IS PROVENANCE, NOT A NAMESPACE ──────────────────────────
//
// Pose ids are semantic and permanent (`wave`, `celebrate`). A later batch that
// re-cuts an existing pose SUPERSEDES it in place: last entry in ACTIVE_BATCHES
// wins, the catalog records which batch the art came from, and no product code
// changes. That is the whole reason this is a build step and not a copy-paste.

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';
import sharp from 'sharp';

const PIGGLES_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const PACKAGE_ROOT = fileURLToPath(new URL('../', import.meta.url));
const BATCH_ROOT = join(PIGGLES_ROOT, 'images', 'mascot');

/** Batches to ingest, in precedence order — LAST wins a duplicate pose id.
 *
 *  `02` is deliberately absent. Its art is a known-wrong cut (Brandon, 2026-08-14)
 *  and is pending re-delivery; ingesting it would put two visually different
 *  Piggles on the same screen, since it re-cuts four poses 01 already ships
 *  (wave, thinking, celebrate, invoice) in a different framing and with a ground
 *  shadow 01 does not have. Add it back here once it is re-cut — that is the only
 *  edit required, and the poses it adds (coffee, computer, package, phone,
 *  point-right, point-down, thumbs-up) will light up the intent chains in
 *  src/intents.ts that already name them. */
const ACTIVE_BATCHES = ['01'];

/** Apps that get a copy of the shipped assets. Each Next app serves them from its
 *  own `public/`, which is the one URL shape that works identically in the
 *  browser, in a satori OG route, and in an email — none of which can resolve a
 *  bundler's static import. Three copies of ~600KB is the price of that. */
const TARGETS = ['web', 'account', 'workbench'].map((app) =>
  join(PIGGLES_ROOT, 'apps', app, 'public', 'mascot')
);

/** Longest edge of a shipped asset, after trimming. 1200px is 2× the largest
 *  display size in SIZE_PX (448) with headroom for a hero cut, and matches the
 *  treatment already applied by hand to `piggles-at-desk.png`. */
const MAX_EDGE = 1200;

/** Alpha below this is treated as empty when finding the bounding box. Low
 *  enough to keep a soft cast shadow (02's shadow lands at 3.6% partial alpha),
 *  high enough to ignore stray antialiasing dust. */
const ALPHA_FLOOR = 12;

/** Breathing room kept around the bounding box so the trim never bites into edge
 *  antialiasing and leaves a hard cut. */
const PAD = 4;

const WEBP = { quality: 82, effort: 6, alphaQuality: 100 };

// ── batch manifest normalisation ─────────────────────────────────────────────

/** Both delivered manifest shapes, reduced to one. Batch 01 nests the full roster
 *  under `catalog` (49 entries, 9 of them `status: 'available'`) and repeats the
 *  available ones under `assets`; batch 02 has only `assets` and no notion of a
 *  planned pose. Read whichever exists, and treat an entry with a file path as
 *  available regardless of what it says about itself. */
function normalise(manifest, batch) {
  const entries = manifest.catalog ?? manifest.assets ?? [];
  return entries.map((entry) => {
    const png = entry.png ?? entry.formats?.png;
    const webp = entry.webp ?? entry.formats?.webp;
    return {
      // 02 prefixes every id with the character's name; 01 does not. The bare
      // form is canonical — `pose="wave"` reads correctly at the call site and
      // `pose="piggles-wave"` inside a <PigglesMascot> does not.
      id: String(entry.id).replace(/^piggles-/, ''),
      batch,
      category: entry.category ?? 'core',
      alt: entry.alt ?? '',
      // 01 carries staging notes the later batches drop. Neither is load-bearing,
      // so both get a sane default rather than becoming required.
      anchor: entry.anchor ?? 'bottom',
      energy: entry.energy ?? 'friendly',
      intent: entry.intent ?? entry.uses ?? [],
      source: png ? join(BATCH_ROOT, batch, png.replace(/^\.\//, '')) : null,
      // The master is the PNG. WebP is only ever a derivative, and re-encoding a
      // lossy source is how a soft gradient picks up banding.
      hasArt: Boolean(png ?? webp),
    };
  });
}

// ── image pipeline ───────────────────────────────────────────────────────────

/** The alpha bounding box of the artwork. sharp's own `.trim()` works from a
 *  background COLOUR and is unreliable on a soft transparent edge, so this walks
 *  the alpha channel directly — the same measurement the placement comments in
 *  `apps/account/components/product-glimpse.tsx` depend on. */
async function boundingBox(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] <= ALPHA_FLOOR) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }

  if (right < 0) throw new Error(`${basename(file)} is fully transparent`);

  const padded = {
    left: Math.max(0, left - PAD),
    top: Math.max(0, top - PAD),
  };
  return {
    ...padded,
    width: Math.min(info.width, right + 1 + PAD) - padded.left,
    height: Math.min(info.height, bottom + 1 + PAD) - padded.top,
    canvas: { width: info.width, height: info.height },
  };
}

async function build(entry) {
  const box = await boundingBox(entry.source);
  const scale = Math.min(1, MAX_EDGE / Math.max(box.width, box.height));
  const width = Math.round(box.width * scale);
  const height = Math.round(box.height * scale);

  const buffer = await sharp(entry.source)
    .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
    .resize(width, height, { fit: 'fill' })
    .webp(WEBP)
    .toBuffer();

  return { ...entry, width, height, buffer, canvas: box.canvas };
}

// ── catalog emission ─────────────────────────────────────────────────────────

const quote = (value) => `'${String(value).replace(/'/g, "\\'")}'`;
const list = (values) => `[${values.map(quote).join(', ')}]`;

function emitCatalog(available, planned) {
  const poses = available
    .map(
      (pose) => `  '${pose.id}': {
    id: '${pose.id}',
    batch: '${pose.batch}',
    category: ${quote(pose.category)},
    alt: ${quote(pose.alt)},
    energy: ${quote(pose.energy)},
    anchor: ${quote(pose.anchor)},
    intent: ${list(pose.intent)},
    src: '/mascot/${pose.id}.webp',
    width: ${pose.width},
    height: ${pose.height},
  },`
    )
    .join('\n');

  const roadmap = planned
    .map(
      (pose) => `  '${pose.id}': {
    id: '${pose.id}',
    category: ${quote(pose.category)},
    alt: ${quote(pose.alt)},
    intent: ${list(pose.intent)},
  },`
    )
    .join('\n');

  const union = (poses) => poses.map((pose) => quote(pose.id)).join(' | ');

  return `// GENERATED by scripts/ingest.mjs — do not edit.
//
// Source of truth: the batch manifests under piggles/images/mascot/. To change a
// pose's metadata, edit the manifest and re-run \`pnpm --filter @piggles/mascot
// ingest\`. Batches ingested: ${ACTIVE_BATCHES.join(', ')}.

/** Every pose whose artwork exists and ships today. */
export type MascotPoseId = ${union(available)};

/** Every pose that is specified but not yet drawn. */
export type PlannedPoseId = ${union(planned)};

export type AnyPoseId = MascotPoseId | PlannedPoseId;

/** A pose whose artwork exists and ships today. */
export interface MascotPose {
  id: MascotPoseId;
  /** Which delivered batch this cut came from. Provenance only — never branch on
   *  it. A re-cut supersedes a pose in place and this is the only thing that
   *  changes. */
  batch: string;
  category: string;
  /** The manifest's description of the artwork, used when the mascot is
   *  MEANINGFUL. She is usually decorative, so <PigglesMascot> defaults to an
   *  empty alt and this goes unused — see src/react/mascot.tsx. */
  alt: string;
  /** Emotional register, from the character bible. Reference for whoever is
   *  choosing a pose; nothing reads it at runtime. */
  energy: string;
  /** Where the weight of the artwork sits, for placing her against an edge. */
  anchor: string;
  /** The manifest's own keywords. Human reference — the binding map from a
   *  product situation to a pose is MASCOT_INTENTS in ./intents. */
  intent: readonly string[];
  /** Served from each app's own public/ directory. */
  src: string;
  /** TRUE intrinsic size of the trimmed artwork, not the delivery canvas. */
  width: number;
  height: number;
}

/** A pose that is specified but not yet drawn. Naming one in an intent chain is
 *  how a surface says what it WANTS: the chain falls through to real art today
 *  and upgrades itself the day the batch lands, with no edit at the call site. */
export interface PlannedPose {
  id: PlannedPoseId;
  category: string;
  alt: string;
  intent: readonly string[];
}

export const MASCOT_POSES: Record<MascotPoseId, MascotPose> = {
${poses}
};

export const PLANNED_POSES: Record<PlannedPoseId, PlannedPose> = {
${roadmap}
};

export const MASCOT_POSE_IDS: readonly MascotPoseId[] = [${union(available)
    .split(' | ')
    .join(', ')}];

export function isAvailable(id: AnyPoseId): id is MascotPoseId {
  return id in MASCOT_POSES;
}
`;
}

// ── run ──────────────────────────────────────────────────────────────────────

const seen = new Map();
const roadmap = new Map();

for (const batch of ACTIVE_BATCHES) {
  const manifest = JSON.parse(await readFile(join(BATCH_ROOT, batch, 'manifest.json'), 'utf8'));
  for (const entry of normalise(manifest, batch)) {
    if (entry.hasArt) {
      if (seen.has(entry.id)) {
        console.log(`  ${entry.id}: batch ${batch} supersedes ${seen.get(entry.id).batch}`);
      }
      seen.set(entry.id, entry);
      roadmap.delete(entry.id);
    } else if (!seen.has(entry.id)) {
      roadmap.set(entry.id, entry);
    }
  }
}

const available = [];
for (const entry of seen.values()) available.push(await build(entry));
available.sort((a, b) => a.id.localeCompare(b.id));

const planned = [...roadmap.values()].sort((a, b) => a.id.localeCompare(b.id));

// The public directories are rebuilt rather than merged: a pose renamed or
// retired upstream has to disappear from the apps too, and a merge would leave it
// serving forever with nothing referencing it.
for (const dir of TARGETS) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  for (const pose of available) await writeFile(join(dir, `${pose.id}.webp`), pose.buffer);
}

// Formatted here rather than left to `pnpm format`, so that re-running the ingest
// is a no-op diff when nothing changed. An emitter whose output the formatter
// then rewrites means every run churns the file.
const catalogPath = join(PACKAGE_ROOT, 'src', 'catalog.ts');
await mkdir(join(PACKAGE_ROOT, 'src'), { recursive: true });
await writeFile(
  catalogPath,
  await prettier.format(emitCatalog(available, planned), {
    ...(await prettier.resolveConfig(catalogPath)),
    parser: 'typescript',
  }),
  'utf8'
);

const total = available.reduce((sum, pose) => sum + pose.buffer.length, 0);
for (const pose of available) {
  const digest = createHash('sha256').update(pose.buffer).digest('hex').slice(0, 8);
  console.log(
    `  ${pose.id.padEnd(12)} ${String(pose.canvas.width).padStart(4)}×${String(pose.canvas.height).padEnd(4)}` +
      ` → ${String(pose.width).padStart(4)}×${String(pose.height).padEnd(4)}` +
      ` ${String(Math.round(pose.buffer.length / 1024)).padStart(3)}KB  ${digest}`
  );
}
console.log(
  `\n${available.length} poses (${Math.round(total / 1024)}KB) → ${TARGETS.length} apps, ` +
    `${planned.length} planned. Batches: ${ACTIVE_BATCHES.join(', ')}.`
);

// Nothing else in the repo may reference the batch folders directly — they are an
// INPUT. A stale copy of the assets somewhere else is how the two Piggles cuts end
// up on one screen after all.
const strays = (await readdir(join(PIGGLES_ROOT, 'apps'), { withFileTypes: true }))
  .filter((d) => d.isDirectory())
  .filter((d) => !TARGETS.some((t) => t.includes(join('apps', d.name, 'public'))));
if (strays.length) {
  console.log(`\nNote: ${strays.map((d) => d.name).join(', ')} not in TARGETS — no assets copied.`);
}
