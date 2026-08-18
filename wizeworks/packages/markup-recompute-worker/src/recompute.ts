// The recompute decision + writes (docs/48 §8). Given a variant whose cost may
// have moved, re-derive its list price from the bound markup rule and either:
//   • auto-apply it     — when the rule is in `auto` mode AND the price moves
//                         within `recomputeTolerancePct` (null = unbounded)
//   • stage it          — when the rule is `review`, or `auto` but the delta is
//                         beyond tolerance (a cost spike never silently reprices)
//   • skip it           — unbound variant, inactive/frozen rule, no cost, or the
//                         price is already correct
//
// The pure cost→price math + snapshot come from @wizeworks/commerce-schemas'
// `priceVariantByRule` — the SAME engine the catalog markup-service uses, so the
// two write paths can't drift. This module owns only the orchestration + writes;
// it borrows nothing from @wizeworks/commerce (which carries React deps a worker
// must not pull — see services/CLAUDE.md), mirroring how CRM's quote-markup
// keeps a local rule→spec mapping.

import {
  priceVariantByRule,
  type MarkupBand,
  type MarkupCostBasis,
  type MarkupRuleSpec,
  type RoundingSpec,
} from '@wizeworks/commerce-schemas';
import type { MarkupRule, TxClient } from '@wizeworks/db';

export type ReviewReason = 'tolerance_exceeded' | 'review_mode';

export type RecomputeOutcome =
  | {
      kind: 'applied';
      variantId: string;
      productId: string;
      ruleId: string;
      oldPriceCents: number;
      newPriceCents: number;
    }
  | {
      kind: 'staged';
      variantId: string;
      productId: string;
      ruleId: string;
      reviewId: string;
      oldPriceCents: number;
      newPriceCents: number;
      reason: ReviewReason;
    }
  | { kind: 'skipped'; variantId: string; reason: string };

export interface RecomputeArgs {
  tenantId: string;
  variantId: string;
  /** The cost before the change, when the publisher knew it — recorded on a
   *  staged review for display. The price is computed from LIVE state, not this. */
  prevCostCents: number | null;
  /** Injected so the function stays deterministic (testable snapshots). */
  computedAt: string;
}

/**
 * Decide whether a price change applies automatically or is staged for review.
 * Pure — the testable heart of the auto-apply-vs-staged policy (docs/48 §8/§11).
 * `mode` is the rule's recompute mode; only `auto` can auto-apply. A null
 * tolerance under `auto` means "any delta" (unbounded). `off`/`review` never
 * reach here as auto (callers short-circuit `off`).
 */
export function decideAutoApply(
  mode: string,
  tolerancePct: number | null,
  deltaPct: number
): boolean {
  if (mode !== 'auto') return false;
  if (tolerancePct == null) return true;
  return deltaPct <= tolerancePct;
}

/** Percent price delta between the old and new price; Infinity when the old
 *  price is 0 (any non-zero move is "infinite" relative change → stage it). */
export function priceDeltaPct(oldPriceCents: number, newPriceCents: number): number {
  if (oldPriceCents <= 0) return Number.POSITIVE_INFINITY;
  return (Math.abs(newPriceCents - oldPriceCents) / oldPriceCents) * 100;
}

// Map the Prisma rule row (Decimal columns) onto the pure engine spec. Local
// copy — the worker can't import markup-service (commerce → React).
function ruleToSpec(rule: MarkupRule): MarkupRuleSpec {
  return {
    method: rule.method as MarkupRuleSpec['method'],
    value: rule.value == null ? null : Number(rule.value),
    bands: (rule.bands as unknown as MarkupBand[]) ?? [],
    rounding: (rule.rounding as unknown as RoundingSpec) ?? null,
    floorProfitCents: rule.floorProfitCents,
    floorMargin: rule.floorMargin == null ? null : Number(rule.floorMargin),
    ceilingSrc: rule.ceilingSrc as MarkupRuleSpec['ceilingSrc'],
    ceilingValueCents: rule.ceilingValueCents,
  };
}

interface VariantForRecompute {
  productId: string;
  costCents: number | null;
  compareAtPriceCents: number | null;
}

// Resolve the cost the rule prices from. `supplier_cost` reads the linked
// dropship product's cost (mirrors markup-service.supplierCostFor — fall back to
// the variant's own cost when there's no link); every other basis reads
// variant.cost. `average_cost` / `last_po_cost` aren't available yet (docs/28)
// and the rule schema rejects them, so they never reach here.
async function resolveCost(
  tx: TxClient,
  basis: MarkupCostBasis,
  variant: VariantForRecompute
): Promise<{ costCents: number | null; msrpCents: number | null }> {
  if (basis !== 'supplier_cost') return { costCents: variant.costCents, msrpCents: null };
  const link = await tx.dropshipProductLink.findFirst({
    where: { productId: variant.productId, status: 'active' },
    include: { dropshipProduct: { select: { costPriceCents: true, msrpCents: true } } },
  });
  if (!link) return { costCents: variant.costCents, msrpCents: null };
  return {
    costCents: link.dropshipProduct.costPriceCents,
    msrpCents: link.dropshipProduct.msrpCents,
  };
}

async function refreshProductPriceRange(tx: TxClient, productId: string): Promise<void> {
  const range = await tx.productVariant.aggregate({
    where: { productId, deletedAt: null },
    _min: { priceCents: true },
    _max: { priceCents: true },
  });
  await tx.product.update({
    where: { id: productId },
    data: {
      priceMinCents: range._min.priceCents ?? null,
      priceMaxCents: range._max.priceCents ?? null,
    },
  });
}

// System audit row for an automated price change — mirrors @wizeworks/commerce's
// writeAuditLog shape so compliance/export tooling reads one shape across modules.
async function writeAudit(
  tx: TxClient,
  tenantId: string,
  variantId: string,
  action: string,
  diff: { before?: Record<string, unknown>; after?: Record<string, unknown> }
): Promise<void> {
  await tx.auditLog.create({
    data: {
      tenantId,
      actorId: null,
      actorType: 'system',
      action,
      entityType: 'Variant',
      entityId: variantId,
      diff: diff as never,
    },
  });
}

/**
 * Recompute one bound variant inside an open tenant transaction. All DB writes
 * (price update, review upsert, audit) happen here; the caller publishes the
 * resulting event AFTER commit. Idempotent: re-running with the same state
 * settles to the same outcome and never stacks duplicate pending reviews.
 */
export async function recomputeBoundVariant(
  tx: TxClient,
  args: RecomputeArgs
): Promise<RecomputeOutcome> {
  const variant = await tx.productVariant.findFirst({
    where: { id: args.variantId, deletedAt: null },
    select: {
      id: true,
      productId: true,
      costCents: true,
      compareAtPriceCents: true,
      priceCents: true,
      markupRuleId: true,
    },
  });
  if (!variant) return { kind: 'skipped', variantId: args.variantId, reason: 'variant_gone' };
  if (variant.markupRuleId == null) {
    return { kind: 'skipped', variantId: variant.id, reason: 'unbound' };
  }

  const rule = await tx.markupRule.findFirst({ where: { id: variant.markupRuleId } });
  if (!rule?.isActive) {
    return { kind: 'skipped', variantId: variant.id, reason: 'rule_inactive' };
  }
  if (rule.recomputeMode === 'off') {
    return { kind: 'skipped', variantId: variant.id, reason: 'recompute_off' };
  }

  const basis = rule.costBasis as MarkupCostBasis;
  const { costCents, msrpCents } = await resolveCost(tx, basis, variant);
  if (costCents == null) return { kind: 'skipped', variantId: variant.id, reason: 'no_cost' };

  const { result, snapshot } = priceVariantByRule(
    costCents,
    rule.id,
    ruleToSpec(rule),
    basis,
    args.computedAt,
    {
      compareAtCents: variant.compareAtPriceCents,
      msrpCents,
    }
  );
  const newPriceCents = result.priceCents;
  const oldPriceCents = variant.priceCents;

  if (newPriceCents === oldPriceCents) {
    // Price already correct — drop any stale pending proposal for this variant.
    await tx.markupRecomputeReview.deleteMany({
      where: { variantId: variant.id, status: 'pending' },
    });
    return { kind: 'skipped', variantId: variant.id, reason: 'no_change' };
  }

  const tolerance = rule.recomputeTolerancePct == null ? null : Number(rule.recomputeTolerancePct);
  const deltaPct = priceDeltaPct(oldPriceCents, newPriceCents);

  if (decideAutoApply(rule.recomputeMode, tolerance, deltaPct)) {
    await tx.productVariant.update({
      where: { id: variant.id },
      data: { priceCents: newPriceCents, appliedMarkup: snapshot },
    });
    await refreshProductPriceRange(tx, variant.productId);
    // A pending proposal is now moot — the worker just applied an even newer price.
    await tx.markupRecomputeReview.deleteMany({
      where: { variantId: variant.id, status: 'pending' },
    });
    await writeAudit(tx, args.tenantId, variant.id, 'commerce.markup.recompute_applied', {
      before: { priceCents: oldPriceCents },
      after: { priceCents: newPriceCents, ruleId: rule.id, costCents },
    });
    return {
      kind: 'applied',
      variantId: variant.id,
      productId: variant.productId,
      ruleId: rule.id,
      oldPriceCents,
      newPriceCents,
    };
  }

  const reason: ReviewReason =
    rule.recomputeMode === 'review' ? 'review_mode' : 'tolerance_exceeded';
  // One pending proposal per variant (partial unique index) — replace any prior.
  await tx.markupRecomputeReview.deleteMany({
    where: { variantId: variant.id, status: 'pending' },
  });
  const review = await tx.markupRecomputeReview.create({
    data: {
      tenantId: args.tenantId,
      variantId: variant.id,
      markupRuleId: rule.id,
      oldCostCents: args.prevCostCents,
      newCostCents: costCents,
      oldPriceCents,
      newPriceCents,
      appliedMarkup: snapshot,
      reason,
      status: 'pending',
    },
  });
  await writeAudit(tx, args.tenantId, variant.id, 'commerce.markup.recompute_staged', {
    before: { priceCents: oldPriceCents },
    after: { proposedPriceCents: newPriceCents, ruleId: rule.id, reason },
  });
  return {
    kind: 'staged',
    variantId: variant.id,
    productId: variant.productId,
    ruleId: rule.id,
    reviewId: review.id,
    oldPriceCents,
    newPriceCents,
    reason,
  };
}
