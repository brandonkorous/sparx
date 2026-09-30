// Which part of a picture matters, and what the platform does with the answer.
//
// `media_assets.focal_point_x/y` is a 0..1 pair. It is not decoration: FOUR
// layers read it and nothing wrote it.
//
//   - the media worker bakes four social aspect crops around it on upload
//     (`cropSocialAspects`, docs/133 §8) and regenerates them when it moves,
//   - the PATCH route notices a move and republishes `media.uploaded` with
//     `reason: 'recrop'` so those crops are re-cut,
//   - the social composer positions every preview by it (`focalClassFor`),
//   - the article serializer writes it into published HTML as `object-position`.
//
// DEAD CENTRE IS NOT A POSITION. The worker branches on it:
//
//     const useAttention = isDefaultFocal(fx, fy);   // crop.ts
//
// At centre it ignores the stored pair and asks libvips to find the salient
// region; anywhere else it honours the pair exactly. So centre means "nobody has
// told me", and the honour-the-tenant branch has never run on any asset on the
// platform, because 0 of 3,221 images carry a moved point. A control offering
// "middle" as the ninth position would therefore be describing something the
// platform does not do — hence `automatic`, and hence a preview that refuses to
// draw a result it cannot know.
//
// NINE CHOICES, NOT A DRAG. Tailwind cannot compile an interpolated arbitrary
// value and an inline `style` is banned, so every framing this console can DRAW
// is one of nine static `object-*` classes. A continuous pin would let someone
// store 0.62 and then be shown the identical picture as 0.5 — a control
// promising precision the preview cannot honour. These cells write exactly 0,
// 0.5 or 1, so what she picks is what she sees and what the worker crops to.
//
// Logic lives here rather than in the pane because a `.tsx` cannot be imported
// by vitest in this app (`jsx: preserve`).

/** A stored focal point, both axes in [0,1]. */
export interface FocalPoint {
  x: number;
  y: number;
}

/**
 * The tolerance the MEDIA WORKER uses to decide a point is untouched
 * (`isDefaultFocal` in `media-worker/src/crop.ts`). Mirrored here on purpose: if
 * this console called 0.4999 "left" while the worker called it centre, the pane
 * would name a framing the baked crop does not use.
 */
const CENTRE_TOLERANCE = 0.001;

/** True when nobody has chosen a part, so the worker finds the subject itself. */
export function isAutomatic(point: FocalPoint): boolean {
  return Math.abs(point.x - 0.5) < CENTRE_TOLERANCE && Math.abs(point.y - 0.5) < CENTRE_TOLERANCE;
}

export const CENTRE: FocalPoint = { x: 0.5, y: 0.5 };

/** One of the nine tiles. */
export interface FocalCell extends FocalPoint {
  /** What it is called, in a business owner's words. */
  label: string;
  /**
   * The middle tile. Not a position — the absence of a choice, which is a
   * different promise ("we look for the subject") and a different code path in
   * the worker. Labelled as what it does, never as "Middle".
   */
  automatic: boolean;
}

/** The one tile that is not a position. Named so the fallback below can reuse it
 *  instead of indexing the list, which is `| undefined` under this tsconfig. */
const AUTOMATIC_CELL: FocalCell = { x: 0.5, y: 0.5, label: 'Let us choose', automatic: true };

/** Reading order, top-left first, so the grid renders straight from this list. */
export const FOCAL_CELLS: readonly FocalCell[] = [
  { x: 0, y: 0, label: 'Top left', automatic: false },
  { x: 0.5, y: 0, label: 'Top', automatic: false },
  { x: 1, y: 0, label: 'Top right', automatic: false },
  { x: 0, y: 0.5, label: 'Left', automatic: false },
  AUTOMATIC_CELL,
  { x: 1, y: 0.5, label: 'Right', automatic: false },
  { x: 0, y: 1, label: 'Bottom left', automatic: false },
  { x: 0.5, y: 1, label: 'Bottom', automatic: false },
  { x: 1, y: 1, label: 'Bottom right', automatic: false },
];

/** 0, 0.5 or 1 — the same thirds `focalClassFor` splits on, so a highlighted
 *  tile and the drawn crop can never disagree. */
function bucket(value: number): number {
  if (value < 1 / 3) return 0;
  if (value > 2 / 3) return 1;
  return 0.5;
}

/**
 * Quantize a 0..1 focal point to the nearest of the nine standard
 * `object-position` classes. Static classes only — Tailwind cannot compile an
 * interpolated arbitrary value, and an inline style is banned.
 *
 * Shared with the social composer's previews, which is where it started: the
 * focal point belongs to a media asset, so the vocabulary lives beside the
 * asset rather than inside one surface that happens to draw it.
 */
export function focalClassFor(x: number, y: number): string {
  const col = bucket(x);
  const row = bucket(y);
  if (col === 0.5 && row === 0.5) return 'object-center';
  if (col === 0.5) return row === 0 ? 'object-top' : 'object-bottom';
  if (row === 0.5) return col === 0 ? 'object-left' : 'object-right';
  if (col === 0) return row === 0 ? 'object-left-top' : 'object-left-bottom';
  return row === 0 ? 'object-right-top' : 'object-right-bottom';
}

/**
 * Which tile a stored point sits in. A point off the grid (any float is legal
 * over the API) highlights its nearest tile rather than being rewritten on load
 * — the pane shows where it is, and only a click changes it.
 */
export function nearestCell(point: FocalPoint): FocalCell {
  const x = bucket(point.x);
  const y = bucket(point.y);
  // Unreachable fallback: bucket yields 3 × 3 values and all nine are listed.
  return FOCAL_CELLS.find((cell) => cell.x === x && cell.y === y) ?? AUTOMATIC_CELL;
}

/**
 * Whether this tile is the one chosen. Deliberately NOT "which tile is
 * nearest": over the API any float in [0,1] is legal (the media upload
 * integration test PATCHes 0.7 / 0.3), and a value inside the middle third but
 * not AT the centre — 0.6 / 0.5, say — is one the worker honours while no tile
 * represents it. Highlighting the middle tile there would claim "we find the
 * subject" about a point the worker obeys. So nothing is highlighted and the
 * sentence below still tells the truth.
 */
export function isCellChosen(point: FocalPoint, cell: FocalCell): boolean {
  if (cell.automatic) return isAutomatic(point);
  if (isAutomatic(point)) return false;
  return bucket(point.x) === cell.x && bucket(point.y) === cell.y;
}

/** Where a point sits, in words, for a sentence. Never "find it for me" — that
 *  is what a TILE is called, not where anything is. */
export function positionName(point: FocalPoint): string {
  const col = bucket(point.x);
  const row = bucket(point.y);
  const across = col === 0 ? 'left' : col === 1 ? 'right' : '';
  const down = row === 0 ? 'top' : row === 1 ? 'bottom' : '';
  if (down !== '' && across !== '') return `${down} ${across}`;
  if (down !== '') return down;
  if (across !== '') return across;
  return 'middle';
}

/** The sentence under the grid. Always states the consequence of what is
 *  chosen now, because "Left" on its own does not say what happens to a photo. */
export function focalHelp(point: FocalPoint): string {
  if (isAutomatic(point)) {
    return 'We look for the main subject and keep it in frame. Pick a part yourself if we get it wrong.';
  }
  return `Whatever is at the ${positionName(point)} stays in frame. The rest is trimmed away.`;
}

/* ── The shapes the platform actually cuts ──────────────────────────────── */

export interface CropShape {
  /** The ratio as the worker names it (`media_variants.aspect`). */
  aspect: string;
  /** A static Tailwind aspect class, for the reason given at the top. */
  className: string;
  label: string;
  /** Where a crop of this shape is used, so the preview means something. */
  where: string;
}

/** The four the media worker bakes, in `SOCIAL_ASPECTS` order (docs/133 §8).
 *  Named by shape rather than by ratio: "9:16" is not a thing a shop owner
 *  measures anything in. */
export const CROP_SHAPES: readonly CropShape[] = [
  { aspect: '1:1', className: 'aspect-square', label: 'Square', where: 'Most posts' },
  { aspect: '4:5', className: 'aspect-[4/5]', label: 'Tall', where: 'Taller posts' },
  { aspect: '9:16', className: 'aspect-[9/16]', label: 'Full screen', where: 'Stories and reels' },
  { aspect: '16:9', className: 'aspect-video', label: 'Wide', where: 'Link previews' },
];

/* ── The round trip ─────────────────────────────────────────────────────── */

/** Read side. The API sends `focal_point: { x, y }` and always sets it, but an
 *  older response or a partial shape must land on centre rather than NaN. */
export function focalFromWire(wire: { x: number; y: number } | null | undefined): FocalPoint {
  if (!wire) return CENTRE;
  return { x: clampUnit(wire.x), y: clampUnit(wire.y) };
}

/** Write side. The PATCH takes the two axes flat, and the column has a
 *  0..1 CHECK constraint, so clamping here keeps a bad value from becoming a
 *  500 the pane cannot explain. */
export function focalToWire(point: FocalPoint): { focal_point_x: number; focal_point_y: number } {
  return { focal_point_x: clampUnit(point.x), focal_point_y: clampUnit(point.y) };
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}
