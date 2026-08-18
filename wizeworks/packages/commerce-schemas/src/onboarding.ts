// Inventory onboarding — beating the spreadsheet (docs/146 Phase 11).
//
// Everything in this file exists to answer one question a business asks in its
// first hour: *is this actually going to be less work than the sheet I already
// have?* The honest answer depends on three things, and all three are here as
// pure functions because the wizard, the importer and the API must agree on
// them.
//
//   How long setup took        measured, not asserted. A 30-minute promise that
//                              nobody measures is marketing; a 30-minute promise
//                              with a timer against it is a product decision that
//                              can be shown to be wrong.
//   What their columns mean    guessed, with a confidence, and never silently.
//                              A column mapped wrong turns a stock-take into a
//                              day of unpicking.
//   What their numbers mean    "1,234", "1.234,56", "12 ea" and "(5)" are four
//                              spreadsheets' way of writing three numbers.
//
// ── The rule this phase inherits ─────────────────────────────────────────────
//
// A guess must never be indistinguishable from a fact. Every match below carries
// its confidence and how it was reached, and a match under the threshold reports
// NO match rather than a bad one — because a mapping screen that arrives
// pre-filled with a wrong answer is worse than one that arrives empty. The empty
// one gets read.

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// 11.1 — The guided setup, and the clock against it
// ─────────────────────────────────────────────────────────────────────────────

/** The five steps, in order. The keys are persisted, so they are permanent. */
export const SetupStepKey = z.enum(['locations', 'import', 'mapping', 'opening_balance', 'alerts']);
export type SetupStepKey = z.infer<typeof SetupStepKey>;

export interface SetupStepDefinition {
  key: SetupStepKey;
  title: string;
  /** What the person does here, in their words. */
  summary: string;
  /** Why it is a step at all — shown when they wonder whether to skip it. */
  why: string;
  /** Steps that can be skipped, and what skipping costs. A step with no cost
   *  worth stating is not optional; it is just short. */
  skippable: boolean;
  skipCost: string | null;
}

export const SETUP_STEPS: readonly SetupStepDefinition[] = [
  {
    key: 'locations',
    title: 'Where you keep stock',
    summary: 'Name the places stock physically sits — a shop, a unit, a van, a shelf in the back.',
    why: 'Every quantity in the system belongs to a place. One location is a perfectly good answer, and you can add more later.',
    skippable: false,
    skipCost: null,
  },
  {
    key: 'import',
    title: 'Bring in what you have',
    summary: 'Upload the spreadsheet you keep today, or start from an empty list.',
    why: 'Typing a few hundred items in by hand is the reason most stock systems get abandoned in week one.',
    skippable: true,
    skipCost: 'You can add items one at a time instead, or import later.',
  },
  {
    key: 'mapping',
    title: 'Say what your columns mean',
    summary:
      'Confirm which column is the item code, which is the quantity, and which is the location.',
    why: 'Your headings are yours. Confirming them once here is what makes every future import a single click.',
    skippable: false,
    skipCost: null,
  },
  {
    key: 'opening_balance',
    title: 'Count what is actually there',
    summary: 'Post an opening count, so day one starts from a number somebody stood in front of.',
    why: 'Every figure the system reports afterwards is measured from this one. An assumed opening balance is an error that never goes away on its own.',
    skippable: true,
    skipCost:
      'Your starting quantities will be whatever the import said, with nothing recording that anyone checked.',
  },
  {
    key: 'alerts',
    title: 'Decide when to be told',
    summary: 'Set the level at which an item counts as running low, and who hears about it.',
    why: 'A stock system that never interrupts you is a spreadsheet with extra steps.',
    skippable: true,
    skipCost: 'Nothing will tell you an item is running out until you go looking.',
  },
];

export const SETUP_STEP_KEYS: readonly SetupStepKey[] = SETUP_STEPS.map((step) => step.key);

/** The promise, in milliseconds. Named rather than inlined because it is quoted
 *  in the marketing copy and in docs/15, and the three must not drift. */
export const SETUP_TARGET_MS = 30 * 60_000;

/**
 * How long a gap between two steps can be and still count as the same sitting.
 *
 * A person starts setup, goes to serve a customer, and comes back after lunch.
 * Counting those ninety minutes against a thirty-minute target would make the
 * measurement useless, and quietly discarding them would make it dishonest. So
 * the gap is excluded from hands-on time AND counted as a sitting, and both
 * numbers are reported.
 */
export const SETUP_SITTING_GAP_MS = 15 * 60_000;

export const SetupStepState = z.object({
  completedAt: z.string().datetime().nullable().default(null),
  skippedAt: z.string().datetime().nullable().default(null),
  /** Free-form, per step: the warehouse created, the batch imported, the count
   *  posted. What the step DID, so the wizard can be reopened and show it. */
  result: z.record(z.string(), z.unknown()).default({}),
});
export type SetupStepState = z.infer<typeof SetupStepState>;

export const SetupSteps = z.record(SetupStepKey, SetupStepState);
export type SetupSteps = z.infer<typeof SetupSteps>;

export interface SetupTiming {
  /** Start to finish on the wall clock. Null until it is finished — an
   *  in-progress setup has a duration, but not a *time taken*. */
  elapsedMs: number | null;
  /**
   * Time with somebody actually at the screen: the sum of the gaps between
   * consecutive completed steps, with any gap longer than a sitting excluded.
   * Null when fewer than two things have happened, because one timestamp
   * measures nothing.
   */
  handsOnMs: number | null;
  /** How many separate visits it took. 1 means they did it in one go. */
  sittings: number;
  targetMs: number;
  /** Whether hands-on time came in under the promise. **Null when hands-on time
   *  is null** — an unmeasured setup is not a failed one. */
  withinTarget: boolean | null;
}

export interface SetupProgress {
  steps: SetupStepKey[];
  completedCount: number;
  skippedCount: number;
  remaining: SetupStepKey[];
  /** The step the wizard should open on: the first that is neither done nor
   *  skipped, or null when there is nothing left. */
  currentStep: SetupStepKey | null;
  isComplete: boolean;
  timing: SetupTiming;
}

interface SummarizeSetupInput {
  startedAt: Date | string | null;
  completedAt: Date | string | null;
  steps: Partial<Record<SetupStepKey, SetupStepState>>;
}

function toTime(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Work out where a setup is and how long it has taken.
 *
 * The timing half is the part worth reading. It is built from the step
 * timestamps rather than from a running counter, because a counter needs the
 * browser to be open and honest, and these stamps are written by the server as
 * each step finishes.
 */
export function summarizeSetup(input: SummarizeSetupInput): SetupProgress {
  const completed: SetupStepKey[] = [];
  const skipped: SetupStepKey[] = [];
  const remaining: SetupStepKey[] = [];
  const marks: number[] = [];

  const started = toTime(input.startedAt);
  if (started !== null) marks.push(started);

  for (const step of SETUP_STEPS) {
    const state = input.steps[step.key];
    const done = toTime(state?.completedAt ?? null);
    const skip = toTime(state?.skippedAt ?? null);
    if (done !== null) {
      completed.push(step.key);
      marks.push(done);
    } else if (skip !== null) {
      skipped.push(step.key);
      marks.push(skip);
    } else {
      remaining.push(step.key);
    }
  }

  const finished = toTime(input.completedAt);
  if (finished !== null) marks.push(finished);
  marks.sort((a, b) => a - b);

  let handsOnMs: number | null = null;
  let sittings = marks.length > 0 ? 1 : 0;
  if (marks.length >= 2) {
    handsOnMs = 0;
    for (let i = 1; i < marks.length; i++) {
      const gap = marks[i]! - marks[i - 1]!;
      if (gap > SETUP_SITTING_GAP_MS) {
        sittings += 1;
        continue;
      }
      handsOnMs += gap;
    }
  }

  const elapsedMs = started !== null && finished !== null ? finished - started : null;

  return {
    steps: [...SETUP_STEP_KEYS],
    completedCount: completed.length,
    skippedCount: skipped.length,
    remaining,
    currentStep: remaining[0] ?? null,
    isComplete: remaining.length === 0,
    timing: {
      elapsedMs,
      handsOnMs,
      sittings,
      targetMs: SETUP_TARGET_MS,
      // Null, not false. "We never measured it" and "it took too long" are
      // different answers and only one of them is a problem.
      withinTarget: handsOnMs === null ? null : handsOnMs <= SETUP_TARGET_MS,
    },
  };
}

/** "18 minutes", "1 hour 4 minutes", or "under a minute". Null in, null out —
 *  the caller renders "not measured" rather than "0 minutes". */
export function formatDuration(ms: number | null): string | null {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return null;
  // Under a minute is under a minute. Rounding first would report 30 seconds as
  // "1 minute", which is a measurement claiming a precision it does not have.
  if (ms < 60_000) return 'under a minute';
  const totalMinutes = Math.round(ms / 60_000);
  if (totalMinutes < 60) return `${totalMinutes} minute${totalMinutes === 1 ? '' : 's'}`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hourPart = `${hours} hour${hours === 1 ? '' : 's'}`;
  if (minutes === 0) return hourPart;
  return `${hourPart} ${minutes} minute${minutes === 1 ? '' : 's'}`;
}

export const CompleteSetupStepInput = z.object({
  step: SetupStepKey,
  /** skip records that the person chose to move on, which is a different fact
   *  from having done it — and the one that explains a gap six months later. */
  action: z.enum(['complete', 'skip', 'reopen']).default('complete'),
  result: z.record(z.string(), z.unknown()).optional(),
});
export type CompleteSetupStepInput = z.infer<typeof CompleteSetupStepInput>;

// ─────────────────────────────────────────────────────────────────────────────
// 11.2 — Working out what somebody else's columns mean
// ─────────────────────────────────────────────────────────────────────────────

export interface ColumnTarget {
  /** The importer's own name for this field. */
  key: string;
  label: string;
  /** Spellings seen in the wild, plus the one sparx exports. Order is
   *  irrelevant; all are treated as exact. */
  aliases: readonly string[];
  required: boolean;
  hint: string;
}

/**
 * What the stock importer needs, and everything it has been called.
 *
 * The alias lists are long on purpose. Every entry here is a mapping screen a
 * person does not have to fill in, and the cost of an extra alias is nothing
 * while the cost of a missing one is a support conversation.
 */
export const STOCK_IMPORT_TARGETS: readonly ColumnTarget[] = [
  {
    key: 'sku',
    label: 'Item code',
    aliases: [
      'sku',
      'code',
      'item',
      'item code',
      'item number',
      'itemid',
      'item id',
      'product code',
      'product id',
      'part',
      'part number',
      'part no',
      'partno',
      'mpn',
      'stock code',
      'stock number',
      'seller sku',
      'merchant sku',
      'variant sku',
      'reference',
      'ref',
    ],
    required: true,
    hint: 'The code you use to tell one item from another.',
  },
  {
    key: 'name',
    label: 'Item name',
    aliases: [
      'name',
      'title',
      'description',
      'item name',
      'product',
      'product name',
      'product title',
      'item description',
    ],
    required: false,
    hint: 'Only used when an item is new to sparx and has to be created.',
  },
  {
    key: 'warehouse',
    label: 'Location',
    aliases: [
      'warehouse',
      'warehouse code',
      'location',
      'location code',
      'site',
      'store',
      'branch',
      'depot',
      'fulfillment center',
      'fulfilment centre',
      'stock location',
    ],
    required: false,
    hint: 'Leave unmapped if everything in the file is at one place.',
  },
  {
    key: 'onHand',
    label: 'Quantity counted',
    aliases: [
      'on hand',
      'onhand',
      'quantity',
      'qty',
      'quantity on hand',
      'qty on hand',
      'counted',
      'count',
      'stock',
      'stock on hand',
      'available',
      'available quantity',
      'units',
      'balance',
      'closing balance',
    ],
    required: false,
    hint: 'What is actually on the shelf. Map this OR a change column, not both.',
  },
  {
    key: 'delta',
    label: 'Change in quantity',
    aliases: ['delta', 'change', 'adjustment', 'adjust', 'difference', 'variance', 'movement'],
    required: false,
    hint: 'A plus or minus against what sparx already holds.',
  },
  {
    key: 'unitCost',
    label: 'Unit cost',
    aliases: [
      'cost',
      'unit cost',
      'purchase cost',
      'buy price',
      'cost price',
      'average cost',
      'avg cost',
      'landed cost',
      'cost each',
    ],
    required: false,
    hint: 'What a unit cost you. Used to value new items.',
  },
  {
    key: 'note',
    label: 'Note',
    aliases: ['note', 'notes', 'comment', 'comments', 'memo', 'remark'],
    required: false,
    hint: 'Carried onto the stock movement, so the reason survives.',
  },
];

/** Reduce a heading to its comparable form: lower case, no punctuation, no
 *  runs of space. "Qty. On-Hand" and "qty on hand" are the same heading. */
export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[_\-./\\]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Dice coefficient over character bigrams — forgiving of a typo or a plural,
 *  unforgiving of two words that merely start the same. Short strings fall back
 *  to equality, where a bigram measure is noise. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = (value: string): Map<string, number> => {
    const map = new Map<string, number>();
    for (let i = 0; i < value.length - 1; i++) {
      const gram = value.slice(i, i + 2);
      map.set(gram, (map.get(gram) ?? 0) + 1);
    }
    return map;
  };
  const left = bigrams(a);
  const right = bigrams(b);
  let shared = 0;
  for (const [gram, count] of left) {
    const other = right.get(gram);
    if (other) shared += Math.min(count, other);
  }
  return (2 * shared) / (a.length - 1 + (b.length - 1));
}

export type ColumnMatchReason = 'exact' | 'similar' | 'none';

export interface ColumnCandidate {
  header: string;
  confidence: number;
}

export interface ColumnMatch {
  key: string;
  label: string;
  required: boolean;
  hint: string;
  /** The file heading this field will read, or null when nothing was close
   *  enough. Null is a real answer here and the screen must show it as a
   *  question, not as a blank that looks answered. */
  header: string | null;
  confidence: number;
  reason: ColumnMatchReason;
  /** Other headings worth offering, best first. Never includes `header`. */
  alternatives: ColumnCandidate[];
}

/**
 * The confidence below which a guess is not offered as an answer.
 *
 * Set where "quantity" still finds "quantity on hand" but "supplier" does not
 * quietly become "supplier price". Wrong-and-confident is the expensive failure:
 * the person clicks through a pre-filled screen, and four hundred quantities
 * land in the cost column.
 */
export const COLUMN_MATCH_THRESHOLD = 0.62;

/**
 * Match a file's headings against what the importer needs.
 *
 * Greedy by best score across the whole grid rather than target-by-target, so a
 * file with both "quantity" and "quantity on hand" gives each to the field that
 * wants it most, instead of the first target taking whichever it saw first.
 */
export function matchColumns(
  headers: readonly string[],
  targets: readonly ColumnTarget[] = STOCK_IMPORT_TARGETS
): ColumnMatch[] {
  const normalizedHeaders = headers.map((header) => ({
    raw: header,
    normal: normalizeHeader(header),
  }));

  const squash = (value: string): string => value.replace(/ /g, '');

  const score = (target: ColumnTarget, normal: string): number => {
    if (normal === '') return 0;
    // Compared with AND without spaces, so "S.K.U." (which normalises to "s k
    // u"), "onhand" and "on hand" all reach the alias they obviously mean.
    // Punctuation between letters is a typographic choice, not a different word.
    const tight = squash(normal);
    for (const alias of [target.key, target.label, ...target.aliases]) {
      const candidate = normalizeHeader(alias);
      if (candidate === normal || squash(candidate) === tight) return 1;
    }
    let best = 0;
    for (const alias of [target.label, ...target.aliases]) {
      best = Math.max(best, similarity(normalizeHeader(alias), normal));
    }
    return best;
  };

  // Full grid first: every (target, header) pair scored once.
  const grid = targets.map((target) => ({
    target,
    scores: normalizedHeaders.map((header) => ({
      header: header.raw,
      confidence: Math.round(score(target, header.normal) * 100) / 100,
    })),
  }));

  const takenHeaders = new Set<string>();
  const assigned = new Map<string, ColumnCandidate>();

  // Highest-confidence pair wins, then the next, skipping anything already
  // spoken for on either axis.
  const pairs = grid
    .flatMap((row) => row.scores.map((cell) => ({ key: row.target.key, ...cell })))
    .filter((pair) => pair.confidence >= COLUMN_MATCH_THRESHOLD)
    .sort((a, b) => b.confidence - a.confidence);

  for (const pair of pairs) {
    if (assigned.has(pair.key) || takenHeaders.has(pair.header)) continue;
    assigned.set(pair.key, { header: pair.header, confidence: pair.confidence });
    takenHeaders.add(pair.header);
  }

  return grid.map((row) => {
    const match = assigned.get(row.target.key) ?? null;
    const alternatives = row.scores
      .filter((cell) => cell.confidence > 0.3 && cell.header !== match?.header)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 4);
    return {
      key: row.target.key,
      label: row.target.label,
      required: row.target.required,
      hint: row.target.hint,
      header: match?.header ?? null,
      confidence: match?.confidence ?? 0,
      reason: match === null ? 'none' : match.confidence >= 1 ? 'exact' : 'similar',
      alternatives,
    };
  });
}

export interface MappingVerdict {
  matches: ColumnMatch[];
  /** Headings in the file that nothing wanted. Shown so a person can see the
   *  importer read their file and simply had no use for "Bin color". */
  unmatchedHeaders: string[];
  /** Required fields still unanswered. Non-empty means the import cannot run. */
  missingRequired: string[];
  /** Fields matched by resemblance rather than exactly — the ones worth a
   *  human's eye before pressing go. */
  needsConfirmation: string[];
  ready: boolean;
}

export function summarizeMapping(
  headers: readonly string[],
  matches: ColumnMatch[]
): MappingVerdict {
  const used = new Set(matches.map((m) => m.header).filter((h): h is string => h !== null));
  const missingRequired = matches
    .filter((m) => m.required && m.header === null)
    .map((m) => m.label);
  const quantityMapped = matches.some(
    (m) => (m.key === 'onHand' || m.key === 'delta') && m.header !== null
  );
  if (!quantityMapped) {
    missingRequired.push('Quantity counted or Change in quantity');
  }
  return {
    matches,
    unmatchedHeaders: headers.filter((header) => !used.has(header)),
    missingRequired,
    needsConfirmation: matches.filter((m) => m.reason === 'similar').map((m) => m.label),
    ready: missingRequired.length === 0,
  };
}

// ─── Numbers, as other people write them ─────────────────────────────────────

export interface NumberFormat {
  /** The character this file uses before the fractional part. */
  decimal: '.' | ',';
  /** Whether the file groups thousands at all. Affects nothing in parsing —
   *  both separators are stripped — but explains the decision on screen. */
  grouped: boolean;
  /** How many sample values the verdict rests on. A format decided from two
   *  values is a guess, and the screen should say which. */
  sampleCount: number;
}

/**
 * Work out whether "1.234" is a thousand or one-and-a-bit.
 *
 * The only reliable signal is the LAST separator's position: a group separator
 * always has exactly three digits after it, a decimal separator almost never
 * does with a quantity or a price. Where a file gives no evidence either way,
 * this returns null and the caller keeps the default rather than inventing a
 * verdict — the same rule the ratios follow.
 */
export function detectNumberFormat(samples: readonly string[]): NumberFormat | null {
  let commaDecimal = 0;
  let dotDecimal = 0;
  let grouped = 0;
  let seen = 0;

  for (const raw of samples) {
    const value = raw.trim();
    if (value === '' || !/[\d]/.test(value)) continue;
    seen += 1;
    const digitsOnly = value.replace(/[^\d.,]/g, '');
    const lastComma = digitsOnly.lastIndexOf(',');
    const lastDot = digitsOnly.lastIndexOf('.');
    if (lastComma === -1 && lastDot === -1) continue;

    const [separator, index] = lastComma > lastDot ? [',', lastComma] : ['.', lastDot];
    const trailing = digitsOnly.length - index - 1;
    // Exactly three trailing digits AND another separator earlier is grouping;
    // three trailing digits alone is ambiguous and deliberately votes for
    // neither, because "1,500" really is both.
    const otherSeparator = separator === ',' ? lastDot : lastComma;
    if (trailing === 3 && (otherSeparator !== -1 || digitsOnly.split(separator).length > 2)) {
      grouped += 1;
      continue;
    }
    if (trailing === 3) continue;
    if (separator === ',') commaDecimal += 1;
    else dotDecimal += 1;
  }

  if (seen === 0) return null;
  if (commaDecimal === 0 && dotDecimal === 0 && grouped === 0) return null;
  return {
    decimal: commaDecimal > dotDecimal ? ',' : '.',
    grouped: grouped > 0,
    sampleCount: seen,
  };
}

export interface ParsedQuantity {
  /** Null when the cell held something that is not a number. Not zero —
   *  a cell reading "n/a" has not told us there are none. */
  value: number | null;
  /** A trailing unit word the file carried: "12 ea", "3 cases". Kept rather
   *  than discarded, because it is the difference between twelve and a dozen
   *  dozen and the importer surfaces it for confirmation. */
  unit: string | null;
  /** True when the cell was empty. Distinct from unparseable. */
  blank: boolean;
}

/**
 * Read a quantity or a money value out of a spreadsheet cell.
 *
 * Handles the four things spreadsheets do that plain `Number()` does not:
 * grouping separators, a comma decimal, an accounting negative in brackets, and
 * a currency symbol or unit word stuck to the figure.
 */
export function parseSpreadsheetNumber(
  raw: string | null | undefined,
  format?: NumberFormat | null
): ParsedQuantity {
  const text = (raw ?? '').trim();
  if (text === '') return { value: null, unit: null, blank: true };

  // (1,234.00) is how a spreadsheet writes a negative.
  const bracketed = /^\((.*)\)$/.exec(text);
  const signApplied = bracketed ? -1 : 1;
  const body = bracketed ? bracketed[1]!.trim() : text;

  const numeric = /-?[\d][\d.,\s]*/.exec(body);
  if (!numeric) return { value: null, unit: null, blank: false };

  const unitText = body
    .replace(numeric[0], '')
    .replace(/[$£€¥]/g, '')
    .trim();
  const decimal = format?.decimal ?? '.';
  let digits = numeric[0].replace(/\s/g, '');
  digits = decimal === ',' ? digits.replace(/\./g, '').replace(',', '.') : digits.replace(/,/g, '');
  // A comma decimal file can still contain a full stop group separator; the
  // replace above already removed those, so what is left is at most one dot.
  const value = Number(digits);
  if (!Number.isFinite(value)) return { value: null, unit: null, blank: false };

  return {
    value: value * signApplied,
    unit: unitText === '' ? null : unitText,
    blank: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 11.2 / 11.7 — Saved mappings, and the recipes that seed them
// ─────────────────────────────────────────────────────────────────────────────

/** target key → the file heading it reads. Stored exactly as the file wrote the
 *  heading, so re-importing next month's file matches on the same string. */
export const ColumnMapping = z.record(z.string().min(1).max(80), z.string().min(1).max(200));
export type ColumnMapping = z.infer<typeof ColumnMapping>;

export const ImportProfileOptions = z.object({
  /** The reason stamped on every movement. `recount` puts differences in the
   *  shrinkage report; `manual` does not. */
  reason: z.enum(['manual', 'recount', 'loss', 'damage', 'receive', 'return']).default('recount'),
  /** Where rows that name no location go. */
  warehouseId: z.string().uuid().nullable().default(null),
  decimal: z.enum(['.', ',']).default('.'),
  /** Create a catalogue item for a code the file has and sparx does not,
   *  rather than reporting it as an error. Off by default: inventing SKUs from
   *  a typo is how a catalogue fills with rubbish. */
  createMissingItems: z.boolean().default(false),
});
export type ImportProfileOptions = z.infer<typeof ImportProfileOptions>;

export const CreateImportProfileInput = z.object({
  name: z.string().min(1).max(120),
  kind: z.enum(['stock']).default('stock'),
  mapping: ColumnMapping,
  // `prefault` rather than `default`: the defaults live on the fields inside, so
  // an absent `options` is parsed as `{}` and comes out fully populated. A
  // `default({})` would have to restate every field here, which is how the two
  // lists drift.
  options: ImportProfileOptions.prefault({}),
  /** The recipe it started from, when it started from one. Kept so a preset can
   *  be improved and the profiles that came from it can be found. */
  recipeKey: z.string().max(60).nullable().default(null),
});
export type CreateImportProfileInput = z.infer<typeof CreateImportProfileInput>;

/**
 * Written out rather than `CreateImportProfileInput.partial()`.
 *
 * `.partial()` makes a field optional but keeps its `.default()`, so renaming a
 * profile would silently reset its reason, its warehouse and its decimal
 * character. `patch-semantics.test.ts` catches this; the comment is here so the
 * next person does not have to be caught by it.
 */
export const UpdateImportProfileInput = z.object({
  name: z.string().min(1).max(120).optional(),
  mapping: ColumnMapping.optional(),
  options: ImportProfileOptions.partial().optional(),
});
export type UpdateImportProfileInput = z.infer<typeof UpdateImportProfileInput>;

export interface MigrationRecipe {
  key: string;
  /** Described by what the file IS, never by whose product made it. */
  name: string;
  description: string;
  /** What the operator should look for to know this is their file. */
  recognisedBy: string;
  /** Extra header spellings this kind of export uses, added to the standard
   *  alias list before matching. */
  extraAliases: Record<string, readonly string[]>;
  options: Partial<z.input<typeof ImportProfileOptions>>;
}

/**
 * The files people actually arrive with (11.7).
 *
 * Each is a small nudge to the matcher rather than a separate importer: the same
 * plan/apply path runs underneath, and a recipe only widens the vocabulary and
 * sets a sensible default or two. That is deliberate — a recipe that forked the
 * import path would be four importers to keep correct instead of one.
 */
export const MIGRATION_RECIPES: readonly MigrationRecipe[] = [
  {
    key: 'spreadsheet',
    name: 'A spreadsheet you keep by hand',
    description:
      'The sheet most businesses run on: a code, a description and a quantity, maintained by whoever is nearest.',
    recognisedBy: 'You made it yourself, and the headings are whatever made sense at the time.',
    extraAliases: {
      sku: ['item ref', 'our code', 'catalogue number', 'catalog number'],
      onHand: ['in stock', 'on shelf', 'have', 'total'],
    },
    options: { reason: 'recount' },
  },
  {
    key: 'accounting_export',
    name: 'An item list from your accounts software',
    description:
      'An item or product export from the software your books live in. Usually carries a purchase cost and a quantity on hand.',
    recognisedBy:
      'Columns like "Quantity On Hand" and "Purchase Cost", one row per item and no location column.',
    extraAliases: {
      sku: ['item name', 'item full name', 'product/service'],
      name: ['sales description', 'purchase description'],
      onHand: ['quantity on hand', 'qty on hand', 'quantity available'],
      unitCost: ['purchase cost', 'cost of goods', 'average cost'],
    },
    options: { reason: 'recount' },
  },
  {
    key: 'marketplace_export',
    name: 'A listing report from an online marketplace',
    description:
      'The inventory report a marketplace gives sellers. One row per listing, with the marketplace’s own quantity.',
    recognisedBy: 'A seller or merchant SKU column and a fulfilment-centre or warehouse code.',
    extraAliases: {
      sku: ['seller sku', 'merchant sku', 'listing sku', 'asin'],
      name: ['item name', 'listing title'],
      warehouse: ['fulfillment center', 'fulfilment centre', 'fc'],
      onHand: ['available quantity', 'afn fulfillable quantity', 'sellable quantity'],
    },
    options: { reason: 'recount' },
  },
  {
    key: 'till_export',
    name: 'A stock report from your till or shop system',
    description:
      'A point-of-sale export. Usually one row per item per shop, with the shop as a column.',
    recognisedBy: 'A store, branch or till column beside the quantity.',
    extraAliases: {
      sku: ['plu', 'barcode', 'lookup code'],
      warehouse: ['store', 'shop', 'branch', 'till', 'outlet'],
      onHand: ['stock on hand', 'soh', 'current stock'],
    },
    options: { reason: 'recount' },
  },
  {
    key: 'stock_take',
    name: 'A stock-take sheet coming back from the floor',
    description:
      'The sheet sparx exported, filled in with what was actually on the shelves. Differences post as a recount.',
    recognisedBy: 'It came from sparx — the headings already match.',
    extraAliases: {},
    options: { reason: 'recount' },
  },
];

export function migrationRecipe(key: string): MigrationRecipe | null {
  return MIGRATION_RECIPES.find((recipe) => recipe.key === key) ?? null;
}

/** Fold a recipe's extra spellings into the standard target list. */
export function targetsForRecipe(recipeKey: string | null): ColumnTarget[] {
  const recipe = recipeKey ? migrationRecipe(recipeKey) : null;
  return STOCK_IMPORT_TARGETS.map((target) => {
    const extra = recipe?.extraAliases[target.key];
    return extra ? { ...target, aliases: [...target.aliases, ...extra] } : { ...target };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 11.3 — Resolving the rows that did not land
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What to do about one problem row.
 *
 *   skip     leave it out. Recorded, not deleted — "6 rows skipped" is part of
 *            what the import did.
 *   match    the code in the file is ours under a different name; point the row
 *            at an item that already exists.
 *   create   the item is genuinely new; make it, then apply the row.
 */
export const ImportRowResolution = z.discriminatedUnion('action', [
  z.object({ line: z.number().int().positive(), action: z.literal('skip') }),
  z.object({
    line: z.number().int().positive(),
    action: z.literal('match'),
    variantId: z.string().uuid(),
  }),
  z.object({
    line: z.number().int().positive(),
    action: z.literal('create'),
    sku: z.string().min(1).max(100),
    title: z.string().min(1).max(200),
    unitCostCents: z.number().int().min(0).nullable().default(null),
  }),
]);
export type ImportRowResolution = z.infer<typeof ImportRowResolution>;

export const ResolveImportRowsInput = z.object({
  resolutions: z.array(ImportRowResolution).min(1).max(2000),
});
export type ResolveImportRowsInput = z.infer<typeof ResolveImportRowsInput>;

// ─────────────────────────────────────────────────────────────────────────────
// 11.5 — Editing stock like a spreadsheet
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One cell edit from the grid.
 *
 * `onHand` is the interesting one: the grid shows a number and a person types
 * over it, but the ledger only accepts a movement. So the service turns the
 * typed figure into a delta against what is there NOW — not against what the
 * grid was showing, which may be a minute old. Sending the delta from the
 * browser would post the difference from a stale number.
 */
export const StockGridEdit = z.object({
  variantId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  onHand: z.number().int().min(0).optional(),
  reorderPoint: z.number().int().min(0).nullable().optional(),
  reorderQuantity: z.number().int().min(0).nullable().optional(),
  safetyBuffer: z.number().int().min(0).optional(),
  unitCostCents: z.number().int().min(0).nullable().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});
export type StockGridEdit = z.infer<typeof StockGridEdit>;

export const StockGridSaveInput = z.object({
  edits: z.array(StockGridEdit).min(1).max(500),
  /** Stamped on any movement the quantity edits produce. */
  reason: z.enum(['manual', 'recount', 'loss', 'damage']).default('manual'),
  note: z.string().max(500).nullable().default(null),
});
export type StockGridSaveInput = z.infer<typeof StockGridSaveInput>;

export interface StockGridEditResult {
  variantId: string;
  warehouseId: string;
  /** Null when the row changed nothing about the quantity. */
  delta: number | null;
  onHand: number;
  fieldsChanged: string[];
  error: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 11.4 — The opening balance
// ─────────────────────────────────────────────────────────────────────────────

export const StartOpeningBalanceInput = z.object({
  warehouseId: z.string().uuid(),
  /** Hide the expected figure from whoever is counting. On by default here, and
   *  off by default for a routine cycle count — an opening balance is the one
   *  count where being told the answer defeats the entire exercise. */
  isBlind: z.boolean().default(true),
  note: z.string().max(500).nullable().default(null),
});
export type StartOpeningBalanceInput = z.infer<typeof StartOpeningBalanceInput>;
