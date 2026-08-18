// Bills of materials + assembly orders (docs/146 Phase 6.4–6.7).
//
// The write contracts for a recipe, for a run that builds to it, and for taking
// a finished thing back apart.
//
// ── Quantities are per BATCH ─────────────────────────────────────────────────
//
// A bill has an `outputQuantity` — how many finished units one run makes — and
// every component quantity is what the WHOLE batch needs. A run of 100 needing
// three litres of glue records 3 against a batch of 100. Per-unit would record
// 0.03, and the ledger stores integers. Recipes are naturally written per batch
// anyway, which is why every kitchen does it that way.

import { z } from 'zod';

import { Uuid } from '@wizeworks/crm-schemas';

// ─── Vocabulary ──────────────────────────────────────────────────────────────

export const BomStatus = z.enum(['draft', 'active', 'archived']);
export type BomStatus = z.infer<typeof BomStatus>;

/**
 * Which way the arrows point.
 *
 *   assemble     components off the shelf, a finished thing onto it
 *   disassemble  a finished thing off the shelf, components onto it
 *
 * One vocabulary rather than two models: it is the same event reversed, and
 * splitting it would mean two of every query, surface and report.
 */
export const AssemblyKind = z.enum(['assemble', 'disassemble']);
export type AssemblyKind = z.infer<typeof AssemblyKind>;

/**
 * planned    on paper; nothing has moved
 * released   the components are HELD — not consumed — so nobody sells the last
 *            of a part a scheduled build needs
 * completed  terminal; the movements are written and the cost is settled
 * cancelled  terminal; the hold is released and nothing was consumed
 */
export const AssemblyStatus = z.enum(['planned', 'released', 'completed', 'cancelled']);
export type AssemblyStatus = z.infer<typeof AssemblyStatus>;

/** Offcuts, spills, the first one that never comes out right. A percentage so it
 *  scales with the run; two decimals because 2.5% is a real answer. Under 100:
 *  a recipe that wastes everything is not a recipe. */
export const ScrapPercent = z
  .number()
  .min(0, 'Waste cannot be negative')
  .max(99.99, 'A recipe that wastes all of a component is not a recipe')
  .refine((v) => Math.round(v * 100) === v * 100, 'Two decimal places at most');

// ─── Bills of materials ──────────────────────────────────────────────────────

export const BomComponentInput = z.object({
  variantId: Uuid,
  /** Base units the WHOLE BATCH needs. See the header. */
  quantityPer: z
    .number()
    .int('Whole units — the ledger cannot hold part of one')
    .min(1, 'A component the batch needs none of is not a component'),
  scrapPercent: ScrapPercent.optional(),
  notes: z.string().trim().max(500).optional(),
});
export type BomComponentInput = z.infer<typeof BomComponentInput>;

export const CreateBomInput = z.object({
  outputVariantId: Uuid,
  name: z.string().trim().min(1).max(127),
  /** How many finished units one run makes. */
  outputQuantity: z.number().int().min(1).max(1_000_000).optional(),
  /** What it costs in PEOPLE to run the batch once, in cents. Zero is a
   *  legitimate answer and the default; it is folded into the finished unit's
   *  cost, because pricing off components alone prices your own time at zero. */
  laborCostCents: z.number().int().min(0).max(100_000_000).optional(),
  notes: z.string().trim().max(2000).optional(),
  components: z.array(BomComponentInput).min(1).max(200),
});
export type CreateBomInput = z.infer<typeof CreateBomInput>;

export const UpdateBomInput = z.object({
  name: z.string().trim().min(1).max(127).optional(),
  outputQuantity: z.number().int().min(1).max(1_000_000).optional(),
  laborCostCents: z.number().int().min(0).max(100_000_000).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  /** Replaced wholesale when present — a recipe is a set, and patching one
   *  ingredient at a time leaves moments where it does not add up. */
  components: z.array(BomComponentInput).min(1).max(200).optional(),
});
export type UpdateBomInput = z.infer<typeof UpdateBomInput>;

/**
 * Move a bill between draft, active and archived.
 *
 * Exactly one bill per output can be `active`; activating another stands the
 * previous one down rather than refusing, because "make this the recipe we build
 * to" is what the person meant and making them archive the old one first is a
 * step that teaches nothing.
 */
export const SetBomStatusInput = z.object({
  status: BomStatus,
});
export type SetBomStatusInput = z.infer<typeof SetBomStatusInput>;

// ─── Assembly orders ─────────────────────────────────────────────────────────

export const CreateAssemblyOrderInput = z.object({
  kind: AssemblyKind.optional(),
  /** The recipe to build to. Required for `assemble`; optional for a
   *  disassembly, where the bill may have been archived since. */
  bomId: Uuid.optional(),
  /** Only needed when there is no bill — a disassembly of something whose recipe
   *  is gone still has to say what is coming apart. */
  outputVariantId: Uuid.optional(),
  warehouseId: Uuid,
  /** In OUTPUT units: how many finished things to make (or take apart). */
  quantity: z.number().int().min(1).max(1_000_000),
  laborCostCents: z.number().int().min(0).max(100_000_000).optional(),
  plannedFor: z.string().datetime().optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type CreateAssemblyOrderInput = z.infer<typeof CreateAssemblyOrderInput>;

export const UpdateAssemblyOrderInput = z.object({
  quantity: z.number().int().min(1).max(1_000_000).optional(),
  laborCostCents: z.number().int().min(0).max(100_000_000).optional(),
  plannedFor: z.string().datetime().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export type UpdateAssemblyOrderInput = z.infer<typeof UpdateAssemblyOrderInput>;

/**
 * Finish a run.
 *
 * `quantity` is what actually came out, which is not always what was planned —
 * a batch of 100 that yielded 96 completes for 96, and the four that failed are
 * visible as components consumed against fewer finished units rather than
 * disappearing.
 *
 * `consumed` lets the bench correct what actually went in, per component. Left
 * off, the plan's figure is used. The difference between the two is the number a
 * production manager actually wants, so it is recorded rather than smoothed.
 */
export const CompleteAssemblyOrderInput = z.object({
  quantity: z.number().int().min(1).max(1_000_000).optional(),
  laborCostCents: z.number().int().min(0).max(100_000_000).optional(),
  consumed: z
    .array(
      z.object({
        variantId: Uuid,
        quantity: z.number().int().min(0).max(10_000_000),
      })
    )
    .max(200)
    .optional(),
  note: z.string().trim().max(500).optional(),
});
export type CompleteAssemblyOrderInput = z.infer<typeof CompleteAssemblyOrderInput>;

export const CancelAssemblyOrderInput = z.object({
  reason: z.string().trim().max(500).optional(),
});
export type CancelAssemblyOrderInput = z.infer<typeof CancelAssemblyOrderInput>;

// ─── Reads ───────────────────────────────────────────────────────────────────

export const ListBomsQuery = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  status: BomStatus.optional(),
  outputVariantId: Uuid.optional(),
  take: z.number().int().min(1).max(250).optional(),
  skip: z.number().int().min(0).optional(),
});
export type ListBomsQuery = z.infer<typeof ListBomsQuery>;

export const ListAssemblyOrdersQuery = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  status: AssemblyStatus.optional(),
  kind: AssemblyKind.optional(),
  warehouseId: Uuid.optional(),
  take: z.number().int().min(1).max(250).optional(),
  skip: z.number().int().min(0).optional(),
});
export type ListAssemblyOrdersQuery = z.infer<typeof ListAssemblyOrdersQuery>;

// ─── The pure arithmetic ─────────────────────────────────────────────────────

/**
 * How much of a component a run needs, scrap included.
 *
 * Batches round UP, always. Half a run cannot be started, and a recipe needing
 * 3.4 units of something to make the order means you must pull 4 — pulling 3 and
 * discovering it halfway through is exactly the problem this is meant to avoid.
 */
export function requiredForRun(params: {
  /** Base units the whole batch needs. */
  quantityPerBatch: number;
  /** Finished units one batch produces. */
  outputPerBatch: number;
  /** Finished units this run is for. */
  runQuantity: number;
  scrapPercent?: number;
}): number {
  const outputPerBatch = Math.max(1, Math.floor(params.outputPerBatch));
  const batches = params.runQuantity / outputPerBatch;
  const withScrap = params.quantityPerBatch * batches * (1 + (params.scrapPercent ?? 0) / 100);
  return Math.ceil(withScrap);
}

export interface BuildableComponent {
  variantId: string;
  /** Base units one RUN of `outputPerBatch` finished units needs, scrap in. */
  requiredPerBatch: number;
  /** What is sellable right now at the location. */
  available: number;
  /** Finished units this component alone would allow. */
  supports: number;
}

/**
 * How many finished units the stock on hand allows, and which component runs out
 * first.
 *
 * The limiting component is the answer people actually want. "You can make 14"
 * is half a fact; "you can make 14, you run out of hinges" is the one that turns
 * into a purchase order — which is why the shortest component is named rather
 * than only counted.
 */
export function buildableFrom(
  components: BuildableComponent[],
  outputPerBatch: number
): { quantity: number; limitingVariantId: string | null } {
  if (components.length === 0) return { quantity: 0, limitingVariantId: null };
  let best: BuildableComponent | null = null;
  for (const c of components) {
    if (best === null || c.supports < best.supports) best = c;
  }
  const batches = best ? Math.floor(best.supports / Math.max(1, outputPerBatch)) : 0;
  return {
    quantity: Math.max(0, batches * Math.max(1, outputPerBatch)),
    limitingVariantId: best?.variantId ?? null,
  };
}
