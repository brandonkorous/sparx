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
// ── EVERY DELIVERED CUT SHIPS ────────────────────────────────────────────────
//
// Pose ids are semantic and permanent (`wave`, `celebrate`), and a later batch
// that re-cuts an existing pose takes the bare id so no product code changes.
// The earlier cut is NOT thrown away — it ships as `<id>-<batch>` and stays
// reachable. Art that was delivered is art the app can use.

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
 *  ── ALL FIVE, AND WHY THAT IS NEW (2026-08-15) ─────────────────────────────
 *
 *  Only `01` used to be here: `02` was a known-wrong cut, and the batch that
 *  shipped it drew a character who was recognisably not the one on the brand
 *  board. All five were re-delivered wearing the actual brand — the black tee
 *  with the pink Piggles mark, and the mark again on every prop she holds — so
 *  the reason for parking `02` is gone and the four batches after it exist.
 *
 *  The re-delivery REPLACED the rosters rather than re-cutting them, which is
 *  the part that could not be handled by flipping a flag. Batch 01 used to key
 *  its poses `wave`, `desk`, `laptop`, `calendar`, `invoice`, `celebrate`,
 *  `neutral`, `point-left`, `thinking`, and carry a 40-pose roadmap alongside
 *  them. It now keys them by ROLE — `mascot-base`, `planner`, `analyst`,
 *  `communicator`, `builder`, `protector`, `money-minder`, `organizer`,
 *  `cheerleader`, `sidekick` — and carries no roadmap. Every one of those old
 *  ids is gone, so `src/intents.ts` and three call sites were re-mapped by hand
 *  against the actual artwork. Pose ids are still semantic and still permanent
 *  from here; this was a one-off replacement of the vocabulary, not a re-cut.
 *
 *  What each batch is, since the numbers are provenance and say nothing:
 *
 *    01  character archetypes — the figure alone, front-on, no ground
 *    02  the figure holding one prop (envelope, chart, parcel, lightbulb)
 *    03  system states — empty, error, loading, no-results, maintenance
 *    04  business settings — a counter, a shop shelf, a meeting table, a bench
 *    05  one round table, ten activities. A DAY at one desk, which is exactly
 *        what apps/web's scroll film and the console's empty states both want.
 *    07  eleven TRADES — a bakery, a barber, a potter, a garage, a market stall,
 *        a salon, a tailor, an art studio, a workshop, a supplier, a shed. Cut
 *        for meetpiggles.com's "whatever kind of business you have" wall, where
 *        the whole set is on screen at once and the claim IS the variety.
 *
 *  Later batches are listed last, so where two draw the same idea the tighter
 *  cut takes the bare id. ONE id collides today: `workshop`, drawn by 04 as a
 *  generic bench and by 07 as a trade. 07 keeps `workshop`; 04's ships as
 *  `workshop-04`. There is no batch 06. */
const ACTIVE_BATCHES = ['01', '02', '03', '04', '05', '07'];

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

/** Is this pixel Piggles herself, rather than the furniture around her?
 *
 *  She is pink and nothing else in the set is: the props are wood, cream, grey,
 *  black and green. So a saturated red-dominant pixel that is not yellow-shifted
 *  is her skin — head, ears, snout, arms, trotters — and the black tee between
 *  them does not need detecting, because it sits INSIDE that vertical span.
 *
 *  Deliberately narrow. The pink brand mark printed on the laptop lids, mugs and
 *  parcels is far more saturated than skin, so the upper bound rejects it, and
 *  the row percentile in `subjectSpan` throws away whatever leaks through.
 *
 *  ── THE BOUNDS WERE TOO LOOSE, AND THE FAILURE WAS SILENT ──────────────────
 *
 *  They were `saturation >= 0.14` and `|g - b| <= 34`, which also admits PALE
 *  CREAM AND TAN — bread, a canvas awning, a beige counter, a paper cup. Those
 *  are red-dominant and only mildly saturated, so they read as skin, and every
 *  one of them extends the measured span upward or downward past where she
 *  actually is.
 *
 *  That inflates `subject`, and an inflated `subject` makes <PigglesMascot>
 *  render the pose SMALLER — it divides by this number to decide how wide the
 *  image has to be. Batch 07 is where it became impossible to miss, because all
 *  eleven cuts sit on screen at once: `bakery` measured 0.878 against a true
 *  0.490 and `market-stall` 0.851 against 0.391, so at one named size Piggles
 *  came out 85px and 70px tall beside a 153px `supplier`. A 2.2x spread, from
 *  the machinery whose entire job is making that spread 1.0x.
 *
 *  Her skin is PINK — red-dominant with green and blue nearly equal (g-b ≈ 9).
 *  Cream and tan are yellower (bread ≈ 28, pale wood ≈ 45). Halving the green-
 *  blue tolerance separates them, and lifting the saturation floor drops the
 *  washed-out end of the same family.
 *
 *  Measured across all 60 poses before changing it: on the 16 FIGURE-ONLY poses,
 *  which have no props to contaminate them and must therefore be unaffected, the
 *  mean change is -0.010 — nothing. On the 44 scene poses it is -0.102. The test
 *  rejects props and leaves skin alone, which is the only evidence that
 *  distinguishes a tighter detector from a broken one. */
function isSkin(r, g, b, a) {
  if (a < 200 || r < 180) return false;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max !== r) return false;
  const saturation = (max - min) / max;
  if (saturation < 0.2 || saturation > 0.62) return false;
  // Wood, bread and cream are all yellower than skin — g and b diverge.
  return Math.abs(g - b) <= 18;
}

/** What fraction of the artwork's height the CHARACTER occupies.
 *
 *  ── WHY THIS IS MEASURED AT ALL ─────────────────────────────────────────────
 *
 *  Because sizing a mascot by the width of its image is wrong the moment two
 *  poses frame her differently, and this set frames her ten ways. Aspect ratios
 *  here run from 0.72 (`builder`, the figure alone) to 1.49 (`calendar-desk`, a
 *  table with a laptop and a calendar on it). At one fixed width — 176px, say —
 *  the pig in `builder` renders 203px tall and the pig in `calendar-desk` 107px.
 *  Same prop, same slot, and one character is nearly twice the other. On the
 *  marketing film, where six poses cut one after another in the same corner,
 *  that reads as the artwork jumping around rather than as six moments.
 *
 *  So the catalog records this and the component solves for it: a named size is
 *  a CHARACTER height, and the image width that produces it is arithmetic.
 *
 *  ── THE PERCENTILE ──────────────────────────────────────────────────────────
 *
 *  Row extent, not a strict bounding box: the sparsest 1.5% of skin pixels at
 *  each end is discarded. A hard min/max would let one antialiased pixel of the
 *  pink mark on a parcel — or a stray highlight — claim a row she is not in, and
 *  the failure would be silent and small enough to look like a rendering quirk.
 *  Trimming the tails costs nothing real: her head and her trotters are hundreds
 *  of pixels wide at those rows. */
async function subjectSpan(file, box, height) {
  const { data, info } = await sharp(file)
    .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const perRow = new Array(info.height).fill(0);
  let total = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      if (isSkin(data[i], data[i + 1], data[i + 2], data[i + 3])) {
        perRow[y]++;
        total++;
      }
    }
  }

  // No skin at all means the detector is wrong for this cut, not that she is
  // absent. Fall back to the whole frame — which is the old behaviour, so the
  // pose renders as it always did instead of vanishing or filling the screen.
  if (total === 0) {
    console.warn(`  ! ${basename(file)}: no skin detected, subject falls back to the full frame`);
    return 1;
  }

  const cut = total * 0.015;
  let acc = 0;
  let top = 0;
  let bottom = info.height - 1;
  for (let y = 0; y < info.height; y++) {
    acc += perRow[y];
    if (acc >= cut) {
      top = y;
      break;
    }
  }
  acc = 0;
  for (let y = info.height - 1; y >= 0; y--) {
    acc += perRow[y];
    if (acc >= cut) {
      bottom = y;
      break;
    }
  }

  // Reported against the SHIPPED height, so the component can multiply straight
  // through without knowing anything about the trim.
  return Math.round(((bottom - top + 1) / info.height) * height) / height;
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

  const subject = await subjectSpan(entry.source, box, height);

  return { ...entry, width, height, subject, buffer, canvas: box.canvas };
}

// ── catalog emission ─────────────────────────────────────────────────────────

const quote = (value) => `'${String(value).replace(/'/g, "\\'")}'`;
const list = (values) => `[${values.map(quote).join(', ')}]`;

/** A TypeScript union of pose ids, or `never` when there are none.
 *
 *  The `never` branch is not hypothetical. Every batch delivered from 2026-08-15
 *  carries only `assets` — no roadmap — so `planned` is empty and the naive form
 *  emitted `export type PlannedPoseId = ;`, which is a syntax error in a
 *  GENERATED file nobody reads before `tsc` does. `never` is also the correct
 *  meaning: no pose is planned-but-undrawn, so nothing inhabits the type, and
 *  `Record<never, PlannedPose>` is the empty object it should be.
 *
 *  `AnyPoseId` drops its `| PlannedPoseId` arm in the same case rather than
 *  unioning with `never`. The union is a no-op at the type level, but
 *  `no-redundant-type-constituents` fails on it — and a generated file that does
 *  not lint is a generated file somebody hand-edits. */
const unionOf = (poses) =>
  poses.length ? poses.map((pose) => quote(pose.id)).join(' | ') : 'never';

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
    subject: ${pose.subject.toFixed(4)},
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

  return `// GENERATED by scripts/ingest.mjs — do not edit.
//
// Source of truth: the batch manifests under piggles/images/mascot/. To change a
// pose's metadata, edit the manifest and re-run \`pnpm --filter @piggles/mascot
// ingest\`. Batches ingested: ${ACTIVE_BATCHES.join(', ')}.

/** Every pose whose artwork exists and ships today. */
export type MascotPoseId = ${unionOf(available)};

/** Every pose that is specified but not yet drawn. */
export type PlannedPoseId = ${unionOf(planned)};

export type AnyPoseId = ${planned.length ? 'MascotPoseId | PlannedPoseId' : 'MascotPoseId'};

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
  /** Fraction of \`height\` that the CHARACTER occupies, measured from her own
   *  pink mass rather than from the frame.
   *
   *  This is what makes a named size mean the same thing across poses that are
   *  framed differently. \`builder\` is the figure alone at ratio 0.72; a desk
   *  scene is a table at ratio 1.49. Sized to one WIDTH they put two characters
   *  on screen at nearly 2x each other. Sized so this fraction lands on the same
   *  number of pixels, they match — see <PigglesMascot>, which does the
   *  arithmetic so no call site has to know a pose apart from its id. */
  subject: number;
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

export const MASCOT_POSE_IDS: readonly MascotPoseId[] = [${list(available.map((pose) => pose.id)).slice(1, -1)}];

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
      // A COLLIDING ID DOES NOT DISCARD ART. Every delivered cut ships and is
      // reachable; the later batch keeps the bare id so no call site changes,
      // and the earlier one is re-keyed `<id>-<batch>`.
      //
      // It used to just overwrite, which meant batch 04's `workshop` was drawn,
      // paid for, sitting in the repo, and unreachable — and the app served a
      // DIFFERENT picture at the same URL the moment 07 landed.
      if (seen.has(entry.id)) {
        const earlier = seen.get(entry.id);
        const rekeyed = `${earlier.id}-${earlier.batch}`;
        if (seen.has(rekeyed)) throw new Error(`re-key collision: ${rekeyed} already exists`);
        seen.set(rekeyed, { ...earlier, id: rekeyed });
        console.log(
          `  ${entry.id}: batch ${batch} takes the id; batch ${earlier.batch} ships as ${rekeyed}`
        );
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
