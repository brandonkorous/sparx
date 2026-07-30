// Markup rules (docs/48) — schemas + the pure cost→price engine.
//
// This file is intentionally Prisma-free so it can be imported by the
// service layer, the markup-recompute worker, AND client-side dashboard
// code (the variant editor's live margin readout). Money is integer cents
// everywhere; `value` and `floorMargin` are unitless decimals.
//
// markup% is measured against COST: price = cost × (1 + markup).
// margin% is measured against PRICE: margin = (price − cost) / price.
// (docs/48 §2 — the #1 source of merchant confusion; the UI labels both.)

import { z } from 'zod';

import { Uuid } from '@sparx/crm-schemas';

import { MoneyCents } from './common';

// ─── Enums ────────────────────────────────────────────────────────────

export const MarkupMethod = z.enum([
  'percentage', // price = cost × (1 + value)        value = 0.40 → "+40%"
  'multiplier', // price = cost × value              value = 2.50 → "×2.5"
  'flat', // price = cost + value (dollars)          value = 15.0 → "+$15"
  'margin_target', // solve so margin = value         value = 0.45 → "45% margin"
  'matrix', // cost-band table (docs/48 §3.4)
]);
export type MarkupMethod = z.infer<typeof MarkupMethod>;

// The methods a single matrix band may use (matrix can't nest).
export const BandMethod = z.enum(['percentage', 'multiplier', 'flat', 'margin_target']);
export type BandMethod = z.infer<typeof BandMethod>;

export const MarkupCostBasis = z.enum([
  'variant_cost', // product_variants.cost_cents (manual/default)
  'supplier_cost', // live dropship supplier cost
  'average_cost', // landed/average cost — depends on docs/28 (deferred)
  'last_po_cost', // last purchase-order cost — depends on docs/28 (deferred)
]);
export type MarkupCostBasis = z.infer<typeof MarkupCostBasis>;

export const CeilingSrc = z.enum(['none', 'compare_at', 'msrp', 'fixed']);
export type CeilingSrc = z.infer<typeof CeilingSrc>;

export const MarkupAppliesTo = z.enum(['catalog', 'document', 'both']);
export type MarkupAppliesTo = z.infer<typeof MarkupAppliesTo>;

// Per-rule cost-driven recompute policy (docs/48 §8). When a bound variant's cost
// moves, the markup-recompute-worker re-derives the price and:
//   auto   → applies it when the price moves within `recomputeTolerancePct`; stages beyond
//   review → always stages the change for approval (a cost spike never silently reprices)
//   off    → ignores cost changes (the rule is frozen)
export const RecomputeMode = z.enum(['auto', 'review', 'off']);
export type RecomputeMode = z.infer<typeof RecomputeMode>;

export const RoundingStrategy = z.enum(['none', 'nearest', 'charm']);
export type RoundingStrategy = z.infer<typeof RoundingStrategy>;

// ─── Sub-objects ──────────────────────────────────────────────────────

export const RoundingSpec = z.object({
  strategy: RoundingStrategy.default('none'),
  // 'nearest': round to the nearest N cents (e.g. 5 = $0.05, 100 = $1.00).
  precisionCents: z.number().int().positive().max(1_000_000).nullable().optional(),
  // 'charm': round UP to a fixed cents ending (e.g. 99 = ".99", 95 = ".95").
  endingCents: z.number().int().min(0).max(99).nullable().optional(),
});
export type RoundingSpec = z.infer<typeof RoundingSpec>;

// One cost band of a matrix rule. `costMaxCents: null` = open-ended top band.
export const MarkupBand = z.object({
  costMinCents: MoneyCents,
  costMaxCents: MoneyCents.nullable(),
  method: BandMethod,
  value: z.number().finite(),
});
export type MarkupBand = z.infer<typeof MarkupBand>;

// What a rule applies to (docs/48 §3.5). `ids` for collection/products,
// `value` for the free-text product_type / vendor match.
export const MarkupScope = z.discriminatedUnion('type', [
  z.object({ type: z.literal('all') }),
  z.object({ type: z.literal('collection'), ids: z.array(Uuid).min(1).max(500) }),
  z.object({ type: z.literal('product_type'), value: z.string().min(1).max(255) }),
  z.object({ type: z.literal('vendor'), value: z.string().min(1).max(255) }),
  z.object({ type: z.literal('products'), ids: z.array(Uuid).min(1).max(5_000) }),
]);
export type MarkupScope = z.infer<typeof MarkupScope>;

// Snapshot persisted on product_variants.applied_markup (and order/quote
// lines later) so a rule-derived price is reproducible after cost drifts.
export const AppliedMarkupSnapshot = z.object({
  ruleId: Uuid,
  method: MarkupMethod,
  value: z.number().finite().nullable(),
  costBasis: MarkupCostBasis,
  costBasisValueCents: z.number().int(),
  computedPriceCents: z.number().int(),
  computedAt: z.string(),
});
export type AppliedMarkupSnapshot = z.infer<typeof AppliedMarkupSnapshot>;

// ─── Rule CRUD input ──────────────────────────────────────────────────

const MarkupRuleObject = z.object({
  name: z.string().min(1).max(255),
  method: MarkupMethod,
  value: z.number().finite().nullable().optional(),
  bands: z.array(MarkupBand).max(50).optional(),
  costBasis: MarkupCostBasis.default('variant_cost'),
  rounding: RoundingSpec.optional(),
  floorProfitCents: MoneyCents.nullable().optional(),
  floorMargin: z.number().min(0).max(99.99).nullable().optional(),
  ceilingSrc: CeilingSrc.default('none'),
  ceilingValueCents: MoneyCents.nullable().optional(),
  appliesTo: MarkupAppliesTo.default('catalog'),
  scope: MarkupScope.default({ type: 'all' }),
  priority: z.number().int().nonnegative().max(1_000_000).default(0),
  isActive: z.boolean().default(true),
  // Cost-driven recompute policy (docs/48 §8). Tolerance is a percent price delta
  // (15 = ±15%) honoured only in `auto` mode; null = unbounded.
  recomputeMode: RecomputeMode.default('auto'),
  recomputeTolerancePct: z.number().min(0).max(10_000).nullable().optional(),
});

// Per-method consistency: matrix needs bands; everything else needs a value
// in its valid range. Phase 1 supports variant_cost + supplier_cost bases.
function refineMarkupRule(
  v: {
    method?: MarkupMethod;
    value?: number | null;
    bands?: MarkupBand[];
    costBasis?: MarkupCostBasis;
    ceilingSrc?: CeilingSrc;
    ceilingValueCents?: number | null;
  },
  ctx: z.RefinementCtx
): void {
  if (v.method === 'matrix') {
    if (!v.bands || v.bands.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bands'],
        message: 'Matrix rules require at least one cost band',
      });
    }
  } else if (v.method != null) {
    if (v.value == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: `A ${v.method} rule requires a value`,
      });
    } else {
      if (v.method === 'margin_target' && (v.value <= 0 || v.value >= 1)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['value'],
          message: 'margin_target value must be a fraction between 0 and 1 (e.g. 0.45)',
        });
      }
      if (v.method === 'multiplier' && v.value <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['value'],
          message: 'multiplier value must be greater than 0',
        });
      }
      if ((v.method === 'percentage' || v.method === 'flat') && v.value < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['value'],
          message: `${v.method} value cannot be negative`,
        });
      }
    }
  }
  if (v.costBasis === 'average_cost' || v.costBasis === 'last_po_cost') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['costBasis'],
      message:
        'average_cost / last_po_cost bases require the inventory cost dimension (docs/28) — not available yet',
    });
  }
  if (v.ceilingSrc === 'fixed' && v.ceilingValueCents == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ceilingValueCents'],
      message: 'A fixed ceiling requires ceilingValueCents',
    });
  }
}

export const CreateMarkupRuleInput = MarkupRuleObject.superRefine(refineMarkupRule);
export type CreateMarkupRuleInput = z.infer<typeof CreateMarkupRuleInput>;

// The defaults are stripped before `.partial()` because a `.default()` survives
// it, and markupRuleService.update writes every key that isn't undefined. The
// worst of these is `scope`: renaming a rule reset it to `{type:'all'}`, so a
// rule deliberately targeting one collection silently started repricing the
// ENTIRE catalog. It also reactivated disabled rules, reset priority (changing
// which rule wins), and flipped the recompute mode back to automatic.
export const UpdateMarkupRuleInput = MarkupRuleObject.extend({
  costBasis: MarkupCostBasis,
  ceilingSrc: CeilingSrc,
  appliesTo: MarkupAppliesTo,
  scope: MarkupScope,
  priority: z.number().int().nonnegative().max(1_000_000),
  isActive: z.boolean(),
  recomputeMode: RecomputeMode,
})
  .partial()
  .superRefine(refineMarkupRule);
export type UpdateMarkupRuleInput = z.infer<typeof UpdateMarkupRuleInput>;

// Scope override for preview/apply — lets a bulk tool target a scope without
// mutating the rule's stored scope (docs/48 §4 bulk pricing tool).
export const MarkupApplyScope = z.object({ scope: MarkupScope.optional() }).optional();
export type MarkupApplyScope = z.infer<typeof MarkupApplyScope>;

// ─── The pure engine ──────────────────────────────────────────────────

// The runtime shape the engine consumes — decoupled from the Prisma row so
// the service maps Decimal→number once before calling.
export interface MarkupRuleSpec {
  method: MarkupMethod;
  value?: number | null;
  bands?: MarkupBand[] | null;
  rounding?: RoundingSpec | null;
  floorProfitCents?: number | null;
  floorMargin?: number | null; // percent, 30 = 30%
  ceilingSrc?: CeilingSrc | null;
  ceilingValueCents?: number | null;
}

export interface MarkupContext {
  compareAtCents?: number | null; // for ceilingSrc 'compare_at'
  msrpCents?: number | null; // for ceilingSrc 'msrp'
}

export interface MarkupResult {
  priceCents: number;
  profitCents: number;
  marginPct: number; // (price − cost) / price × 100
  markupPct: number; // (price − cost) / cost × 100
  method: MarkupMethod; // effective method (the matched band's method for matrix)
  costBasisValueCents: number; // the cost the price was derived from
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Raw price (float cents) from a single non-matrix method, before rounding.
function baseFromMethod(method: BandMethod, value: number, costCents: number): number {
  switch (method) {
    case 'percentage':
      return costCents * (1 + value);
    case 'multiplier':
      return costCents * value;
    case 'flat':
      return costCents + value * 100; // value is dollars
    case 'margin_target': {
      const m = Math.min(Math.max(value, 0), 0.9999);
      return costCents / (1 - m);
    }
  }
}

// Pick the band whose [min, max] contains the cost. Bands need not cover the
// whole line — if the cost falls outside every band, clamp to the nearest
// (first if below all, last if above all) so a preview never silently prices
// at cost. Returns null only when there are no bands at all.
function resolveBand(bands: MarkupBand[], costCents: number): MarkupBand | null {
  if (bands.length === 0) return null;
  const sorted = [...bands].sort((a, b) => a.costMinCents - b.costMinCents);
  for (const band of sorted) {
    const max = band.costMaxCents ?? Number.POSITIVE_INFINITY;
    if (costCents >= band.costMinCents && costCents <= max) return band;
  }
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  return costCents < first.costMinCents ? first : last;
}

function applyRounding(cents: number, spec: RoundingSpec | null | undefined): number {
  const strategy = spec?.strategy ?? 'none';
  if (strategy === 'nearest') {
    const prec = spec?.precisionCents && spec.precisionCents > 0 ? spec.precisionCents : 1;
    return Math.round(cents / prec) * prec;
  }
  if (strategy === 'charm') {
    const ending = Math.min(Math.max(spec?.endingCents ?? 99, 0), 99);
    const c = Math.round(cents);
    const whole = Math.floor(c / 100);
    let candidate = whole * 100 + ending;
    if (candidate < c) candidate += 100;
    return candidate;
  }
  return Math.round(cents);
}

function applyFloor(priceCents: number, costCents: number, rule: MarkupRuleSpec): number {
  let p = priceCents;
  if (rule.floorProfitCents != null) {
    p = Math.max(p, costCents + rule.floorProfitCents);
  }
  if (rule.floorMargin != null && rule.floorMargin > 0) {
    const r = Math.min(rule.floorMargin / 100, 0.9999);
    p = Math.max(p, Math.ceil(costCents / (1 - r)));
  }
  return p;
}

function applyCeiling(
  priceCents: number,
  rule: MarkupRuleSpec,
  ctx: MarkupContext | undefined
): number {
  let cap: number | null | undefined;
  switch (rule.ceilingSrc) {
    case 'compare_at':
      cap = ctx?.compareAtCents;
      break;
    case 'msrp':
      cap = ctx?.msrpCents;
      break;
    case 'fixed':
      cap = rule.ceilingValueCents;
      break;
    default:
      cap = null;
  }
  if (cap != null && cap > 0 && priceCents > cap) return cap;
  return priceCents;
}

/**
 * Turn a cost into a charged price using a markup rule (docs/48 §3).
 * Order of operations: method → rounding → floor → ceiling → clamp ≥ 0.
 * Pure and deterministic — no I/O, safe on the client.
 */
export function applyMarkupRule(
  costCents: number,
  rule: MarkupRuleSpec,
  ctx?: MarkupContext
): MarkupResult {
  const cost = Math.max(0, Math.round(costCents));

  let effectiveMethod: MarkupMethod = rule.method;
  let base: number;
  if (rule.method === 'matrix') {
    const band = resolveBand(rule.bands ?? [], cost);
    if (!band) {
      base = cost; // no bands configured → pass-through (caller should flag)
    } else {
      effectiveMethod = band.method;
      base = baseFromMethod(band.method, band.value, cost);
    }
  } else {
    base = baseFromMethod(rule.method, rule.value ?? 0, cost);
  }

  let price = applyRounding(base, rule.rounding);
  price = applyFloor(price, cost, rule);
  price = applyCeiling(price, rule, ctx);
  price = Math.max(0, Math.round(price));

  const profit = price - cost;
  return {
    priceCents: price,
    profitCents: profit,
    marginPct: price > 0 ? round1((profit / price) * 100) : 0,
    markupPct: cost > 0 ? round1((profit / cost) * 100) : 0,
    method: effectiveMethod,
    costBasisValueCents: cost,
  };
}

// ─── Catalog variant pricing + snapshot (docs/48 §4/§8) ───────────────
// Pure: a cost + a rule spec → the charged price AND the reproducible snapshot
// stamped on product_variants.applied_markup. Shared by markup-service
// (bind/apply, server-side) AND the markup-recompute-worker so the catalog
// snapshot shape can never drift between the two write paths. `ruleId` /
// `costBasis` come from the rule row; `computedAt` is injected so the function
// stays deterministic and I/O-free.
export function priceVariantByRule(
  costCents: number,
  ruleId: string,
  spec: MarkupRuleSpec,
  costBasis: MarkupCostBasis,
  computedAt: string,
  ctx?: MarkupContext
): { result: MarkupResult; snapshot: AppliedMarkupSnapshot } {
  const result = applyMarkupRule(costCents, spec, ctx);
  const snapshot: AppliedMarkupSnapshot = {
    ruleId,
    method: result.method,
    value: spec.value ?? null,
    costBasis,
    costBasisValueCents: result.costBasisValueCents,
    computedPriceCents: result.priceCents,
    computedAt,
  };
  return { result, snapshot };
}

// ─── markup ↔ margin conversions (docs/48 §2) ─────────────────────────
// Inputs/outputs are fractions (0.40 = 40%), matching how `value` is stored.

/** margin = markup / (1 + markup) */
export function markupToMargin(markup: number): number {
  return markup / (1 + markup);
}

/** markup = margin / (1 − margin); margin must be < 1 */
export function marginToMarkup(margin: number): number {
  const m = Math.min(Math.max(margin, 0), 0.9999);
  return m / (1 - m);
}

// ─── Document-line markup (docs/48 §5) ────────────────────────────────
// A quote/invoice line can be priced by markup at document time, against a
// per-line cost basis, with the computation snapshotted onto the line so the
// quoted/invoiced price stays reproducible after catalog costs drift. Unlike
// the catalog `AppliedMarkupSnapshot` above, the rule reference is OPTIONAL — a
// manual line (a part not in the catalog, a sublet charge, freight) is priced
// by an ad-hoc markup that is not a saved rule.

// Where a document line's cost basis came from.
export const LineCostSource = z.enum([
  'variant_cost', // the linked catalog variant's cost_cents
  'manual', // entered on the line (manual part / sublet / freight)
]);
export type LineCostSource = z.infer<typeof LineCostSource>;

// Snapshot persisted on quote_items.applied_markup.
export const LineMarkupSnapshot = z.object({
  ruleId: Uuid.nullable(), // null for an ad-hoc markup
  ruleName: z.string().nullable(),
  method: MarkupMethod, // effective method (matched band's method for a matrix rule)
  value: z.number().finite().nullable(),
  costSource: LineCostSource,
  costBasisValueCents: z.number().int(),
  computedPriceCents: z.number().int(),
  marginPct: z.number(), // carried so margin reporting needs no recompute
  markupPct: z.number(),
  computedAt: z.string(),
});
export type LineMarkupSnapshot = z.infer<typeof LineMarkupSnapshot>;

// The markup directive a caller sends to price a document line: apply a saved
// rule by id, or an ad-hoc single-method markup. Ad-hoc can't be a matrix —
// pick a saved matrix rule for cost-band pricing.
export const LineMarkupInput = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('rule'), ruleId: Uuid }),
    z.object({
      kind: z.literal('adhoc'),
      method: BandMethod,
      value: z.number().finite(),
    }),
  ])
  .superRefine((v, ctx) => {
    if (v.kind !== 'adhoc') return;
    if (v.method === 'margin_target' && (v.value <= 0 || v.value >= 1)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'margin_target value must be a fraction between 0 and 1 (e.g. 0.45)',
      });
    }
    if (v.method === 'multiplier' && v.value <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'multiplier value must be greater than 0',
      });
    }
    if ((v.method === 'percentage' || v.method === 'flat') && v.value < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: `${v.method} value cannot be negative`,
      });
    }
  });
export type LineMarkupInput = z.infer<typeof LineMarkupInput>;

// Input for the "price this quote line by markup" endpoint. `costCents`
// overrides the linked variant's cost — and is required for a manual line that
// has no variant to fall back to.
export const PriceQuoteLineInput = z.object({
  quoteId: Uuid,
  itemId: Uuid,
  costCents: z.number().int().nonnegative().nullable().optional(),
  markup: LineMarkupInput,
});
export type PriceQuoteLineInput = z.infer<typeof PriceQuoteLineInput>;

// A markup directive already resolved to the pure engine's input: the service
// reads the saved rule (turning it into a spec) and records where the cost came
// from, then hands this to `priceLineByMarkup`.
export type ResolvedLineMarkup =
  | {
      kind: 'rule';
      ruleId: string;
      ruleName: string;
      spec: MarkupRuleSpec;
      costSource: LineCostSource;
    }
  | {
      kind: 'adhoc';
      method: BandMethod;
      value: number;
      costSource: LineCostSource;
    };

export interface PricedLineMarkup {
  result: MarkupResult;
  snapshot: LineMarkupSnapshot;
}

/**
 * Price one document line from its cost using a resolved markup (saved rule or
 * ad-hoc) and produce the mandatory snapshot (docs/48 §5). Pure and
 * deterministic — the caller resolves a saved rule to { spec, id, name } and
 * supplies `computedAt`. Reuses the same `applyMarkupRule` engine as catalog
 * pricing so the two never drift.
 */
export function priceLineByMarkup(
  costCents: number,
  markup: ResolvedLineMarkup,
  computedAt: string,
  ctx?: MarkupContext
): PricedLineMarkup {
  const spec: MarkupRuleSpec =
    markup.kind === 'rule' ? markup.spec : { method: markup.method, value: markup.value };
  const result = applyMarkupRule(costCents, spec, ctx);
  const snapshot: LineMarkupSnapshot = {
    ruleId: markup.kind === 'rule' ? markup.ruleId : null,
    ruleName: markup.kind === 'rule' ? markup.ruleName : null,
    method: result.method,
    value: markup.kind === 'rule' ? (spec.value ?? null) : markup.value,
    costSource: markup.costSource,
    costBasisValueCents: result.costBasisValueCents,
    computedPriceCents: result.priceCents,
    marginPct: result.marginPct,
    markupPct: result.markupPct,
    computedAt,
  };
  return { result, snapshot };
}
