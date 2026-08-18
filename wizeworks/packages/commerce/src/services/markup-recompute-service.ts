// markupRecomputeService — the staged price-recompute review queue (docs/48 §8/§11).
//
// The markup-recompute-worker stages a price change here when it must NOT
// silently reprice: a rule in `review` mode, or in `auto` mode but the new price
// moved beyond the rule's tolerance band. This service is the human side — list
// the pending proposals, then approve (apply the stored snapshot to the variant)
// or reject (discard). Approval is a pure write: the worker already computed the
// price + snapshot, so nothing is recomputed and the result stays reproducible
// even if the cost drifted again before someone acted.
//
// The WRITE that stages a review lives in the worker (services/markup-recompute-
// worker), which can't import this package (commerce carries React deps a backend
// must not pull); this service owns only the read + resolve surfaces consumed by
// the dashboard via api-rest.

import { withTenant, type Prisma } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import { CommerceNotFoundError, CommerceValidationError } from '../errors';
import type { ServiceContext } from '../errors';
import { publishCommerceEvent } from '../events';

export interface MarkupRecomputeReviewRow {
  id: string;
  variantId: string;
  variantSku: string;
  variantTitle: string | null;
  productId: string;
  ruleId: string;
  ruleName: string | null;
  oldCostCents: number | null;
  newCostCents: number;
  oldPriceCents: number;
  newPriceCents: number;
  /** Realized margin at the proposed price — derived for display, not stored. */
  marginPct: number | null;
  reason: string;
  status: string;
  createdAt: string;
}

export interface ResolveReviewsResult {
  resolved: number;
  failed: number;
}

type ReviewWithRefs = Prisma.MarkupRecomputeReviewGetPayload<{
  include: {
    variant: { select: { sku: true; title: true; productId: true } };
    rule: { select: { name: true } };
  };
}>;

const round1 = (n: number): number => Math.round(n * 10) / 10;

function serializeReview(row: ReviewWithRefs): MarkupRecomputeReviewRow {
  const marginPct =
    row.newPriceCents > 0
      ? round1(((row.newPriceCents - row.newCostCents) / row.newPriceCents) * 100)
      : null;
  return {
    id: row.id,
    variantId: row.variantId,
    variantSku: row.variant.sku,
    variantTitle: row.variant.title,
    productId: row.variant.productId,
    ruleId: row.markupRuleId,
    ruleName: row.rule?.name ?? null,
    oldCostCents: row.oldCostCents,
    newCostCents: row.newCostCents,
    oldPriceCents: row.oldPriceCents,
    newPriceCents: row.newPriceCents,
    marginPct,
    reason: row.reason,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

const REVIEW_INCLUDE = {
  variant: { select: { sku: true, title: true, productId: true } },
  rule: { select: { name: true } },
} as const;

/** List staged price-change proposals. Defaults to `pending` — the actionable
 *  queue — but any status can be requested for history. */
export async function listReviews(
  ctx: ServiceContext,
  filter: { status?: string } = {}
): Promise<MarkupRecomputeReviewRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.markupRecomputeReview.findMany({
      where: { status: filter.status ?? 'pending' },
      include: REVIEW_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return rows.map(serializeReview);
  });
}

export async function countPending(ctx: ServiceContext): Promise<number> {
  return withTenant(ctx, (tx) => tx.markupRecomputeReview.count({ where: { status: 'pending' } }));
}

/** Approve a staged proposal — apply its computed price + snapshot to the variant
 *  (re-binding the variant to the rule the proposal came from) and mark it
 *  approved. Pure write; reindexes the product post-commit. */
export async function approveReview(
  ctx: ServiceContext,
  id: string
): Promise<{ variantId: string; newPriceCents: number }> {
  const out = await withTenant(ctx, async (tx) => {
    const review = await tx.markupRecomputeReview.findFirst({ where: { id } });
    if (!review) throw new CommerceNotFoundError('MarkupRecomputeReview', id);
    if (review.status !== 'pending') {
      throw new CommerceValidationError('This price change has already been resolved', [
        { field: 'status', message: `Review is ${review.status}, not pending` },
      ]);
    }

    const variant = await tx.productVariant.findFirst({
      where: { id: review.variantId, deletedAt: null },
    });
    if (!variant) throw new CommerceNotFoundError('Variant', review.variantId);

    await tx.productVariant.update({
      where: { id: review.variantId },
      data: {
        priceCents: review.newPriceCents,
        appliedMarkup: review.appliedMarkup as Prisma.InputJsonValue,
        markupRuleId: review.markupRuleId,
      },
    });
    await refreshProductPriceRange(tx, variant.productId);

    await tx.markupRecomputeReview.update({
      where: { id },
      data: { status: 'approved', resolvedAt: new Date(), resolvedBy: ctx.userId ?? null },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.markup.recompute_approved',
      entityType: 'Variant',
      entityId: review.variantId,
      diff: {
        before: { priceCents: review.oldPriceCents },
        after: { priceCents: review.newPriceCents, ruleId: review.markupRuleId },
      },
    });

    return {
      variantId: review.variantId,
      productId: variant.productId,
      newPriceCents: review.newPriceCents,
    };
  });

  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'product.updated',
    data: { productId: out.productId, change: 'recompute_approved' },
  });

  return { variantId: out.variantId, newPriceCents: out.newPriceCents };
}

/** Reject a staged proposal — leave the variant's current price untouched and
 *  mark the proposal rejected. */
export async function rejectReview(ctx: ServiceContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const review = await tx.markupRecomputeReview.findFirst({ where: { id } });
    if (!review) throw new CommerceNotFoundError('MarkupRecomputeReview', id);
    if (review.status !== 'pending') {
      throw new CommerceValidationError('This price change has already been resolved', [
        { field: 'status', message: `Review is ${review.status}, not pending` },
      ]);
    }

    await tx.markupRecomputeReview.update({
      where: { id },
      data: { status: 'rejected', resolvedAt: new Date(), resolvedBy: ctx.userId ?? null },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.markup.recompute_rejected',
      entityType: 'MarkupRecomputeReview',
      entityId: id,
      diff: { before: { status: 'pending' }, after: { status: 'rejected' } },
    });
  });
}

/** Bulk approve/reject for the review queue's action bar. Best-effort per id —
 *  a failure on one (e.g. a since-deleted variant) doesn't abort the rest. */
export async function resolveReviews(
  ctx: ServiceContext,
  ids: string[],
  action: 'approve' | 'reject'
): Promise<ResolveReviewsResult> {
  let resolved = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      if (action === 'approve') await approveReview(ctx, id);
      else await rejectReview(ctx, id);
      resolved += 1;
    } catch {
      failed += 1;
    }
  }
  return { resolved, failed };
}

// Local copy of markup-service's helper — the product carries a price range
// (min/max across its variants) for storefront cards; an approved reprice can
// move it.
async function refreshProductPriceRange(
  tx: Prisma.TransactionClient,
  productId: string
): Promise<void> {
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
