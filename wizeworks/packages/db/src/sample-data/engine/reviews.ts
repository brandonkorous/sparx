// Reviews + Q&A slice — authored per product (real text + ratings, not lorem).
// Commerce-gated; run after catalog + customers + orders so a customer-authored
// review can link a settled order (the Verified-purchase badge). Product
// `averageRating` / `reviewCount` read columns are written directly (no
// review-event consumer runs against a loaded tenant).

import type { SampleDataPack } from '../types';
import { type ApplyCtx, daysAgo } from './context';
import { reviewRollup, type SeededReview } from '../../seed-review-rollup';

/** Cache: persona key → a settled order id for the verified-purchase link. */
async function settledOrderFor(
  ctx: ApplyCtx,
  personaKey: string,
  cache: Map<string, string | null>
): Promise<string | null> {
  if (cache.has(personaKey)) return cache.get(personaKey) ?? null;
  const customerId = ctx.customerIdByPersona.get(personaKey);
  let orderId: string | null = null;
  if (customerId) {
    const order = await ctx.tx.order.findFirst({
      where: { customerId, status: { in: ['delivered', 'fulfilled'] } },
      orderBy: { placedAt: 'desc' },
      select: { id: true },
    });
    orderId = order?.id ?? null;
  }
  cache.set(personaKey, orderId);
  return orderId;
}

export async function applyReviews(ctx: ApplyCtx, pack: SampleDataPack): Promise<void> {
  if (!ctx.isOn('commerce')) return;
  const { tx, tenantId } = ctx;
  const orderCache = new Map<string, string | null>();

  for (const p of pack.products) {
    const productId = ctx.productIdByKey.get(p.key);
    if (!productId) continue;

    const seeded: SeededReview[] = [];
    for (const r of p.reviews ?? []) {
      const status = r.status ?? 'approved';
      const customerId = r.authorPersona
        ? (ctx.customerIdByPersona.get(r.authorPersona) ?? null)
        : null;
      const orderId = r.authorPersona
        ? await settledOrderFor(ctx, r.authorPersona, orderCache)
        : null;
      const moderated = status !== 'pending';
      const createdAt = daysAgo(ctx, r.daysAgo ?? 14);
      await tx.productReview.create({
        data: {
          tenantId,
          productId,
          customerId,
          orderId,
          rating: r.rating,
          title: r.title,
          body: r.body,
          displayName: r.displayName ?? null,
          status,
          helpfulCount: r.helpfulCount ?? 0,
          ...(moderated ? { moderatedBy: ctx.ownerUserId ?? null, moderatedAt: createdAt } : {}),
          ...(r.response
            ? {
                response: r.response,
                responseAuthorId: ctx.ownerUserId ?? null,
                respondedAt: daysAgo(ctx, (r.daysAgo ?? 14) - 1),
              }
            : {}),
          createdAt,
        },
      });
      ctx.counts.reviews += 1;
      seeded.push({ rating: r.rating, status });
    }

    // Through the one rule rather than by hand. This used to round to a single
    // decimal, so the column said 4.7 where commerce's own recompute says
    // 4.666… — a figure that jumps the first time anybody moderates a review on
    // this product. It also skipped the per-site rows the site grids read.
    const rollup = reviewRollup(seeded);
    if (rollup.reviewCount > 0) {
      await tx.product.update({
        where: { id: productId },
        data: { averageRating: rollup.averageRating, reviewCount: rollup.reviewCount },
      });
      for (const bucket of rollup.bySite) {
        await tx.productReviewRollup.create({
          data: {
            tenantId,
            productId,
            propertyId: bucket.propertyId,
            sumRating: bucket.sumRating,
            reviewCount: bucket.reviewCount,
          },
        });
      }
    }

    for (const q of p.questions ?? []) {
      const status = q.status ?? 'published';
      const customerId = q.authorPersona
        ? (ctx.customerIdByPersona.get(q.authorPersona) ?? null)
        : null;
      const createdAt = daysAgo(ctx, q.daysAgo ?? 10);
      const question = await tx.productQuestion.create({
        data: {
          tenantId,
          productId,
          customerId,
          displayName: q.displayName ?? null,
          body: q.body,
          status,
          createdAt,
        },
        select: { id: true },
      });
      ctx.counts.questions += 1;
      if (q.answer) {
        await tx.productAnswer.create({
          data: {
            tenantId,
            questionId: question.id,
            body: q.answer,
            isOfficial: true,
            authorUserId: ctx.ownerUserId ?? null,
            createdAt: daysAgo(ctx, (q.daysAgo ?? 10) - 1),
          },
        });
      }
    }
  }
}
