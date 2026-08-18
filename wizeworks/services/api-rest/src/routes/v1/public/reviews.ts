// Public product-review submission for the storefront.
//
//   POST /v1/public/commerce/products/:handle/reviews  ?tenant=
//     { rating, authorName, authorEmail, title?, body }
//
// Resolves the product by handle, then hands off to reviewService.submit
// (which Zod-validates + de-dupes). Reviews land in moderation per the
// service's own rules; the storefront shows a "thanks, pending" state. Guest
// submissions are accepted; a signed-in customer's name/email prefill the form
// client-side.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { reviewService } from '@wizeworks/commerce';
import { withTenant } from '@wizeworks/db';
import { ok } from '@wizeworks/api-core/envelope';
import { badRequest, notFound } from '@wizeworks/api-core/errors';

import { publicCommerceContext } from '../../../lib/public-commerce-context.js';
import { resolvePublicPropertyId } from '../../../lib/property.js';
import { optionalCustomer } from '../../../lib/customer-session.js';

const HandleParam = z.object({ handle: z.string().min(1).max(255) });

const ReviewBody = z.object({
  rating: z.number().int().min(1).max(5),
  authorName: z.string().min(1).max(63),
  // Optional — collected for future verified-purchase matching / moderation
  // contact, but not persisted yet (no column). Accepted so the form can send
  // it without 400ing.
  authorEmail: z.string().email().optional(),
  title: z.string().max(127).optional(),
  body: z.string().min(1).max(5000),
});

const ReviewListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(20),
});

const QuestionBody = z.object({
  displayName: z.string().min(1).max(63).optional(),
  body: z.string().min(1).max(2000),
});

const publicReviewRoutes: FastifyPluginAsync = async (app) => {
  app.post('/v1/public/commerce/products/:handle/reviews', async (request) => {
    const { handle } = HandleParam.parse(request.params);
    const body = ReviewBody.parse(request.body);
    const { tenantId, ctx } = await publicCommerceContext(request);

    const product = await withTenant({ tenantId }, (tx) =>
      tx.product.findFirst({
        where: { handle, status: 'active', deletedAt: null },
        select: { id: true },
      })
    );
    if (!product) throw notFound('Product', handle);

    try {
      const result = await reviewService.submit(ctx, {
        productId: product.id,
        // Stamp the review with the storefront it was written on (docs/131 §4) —
        // this is the fact the whole per-site review model hangs on, and it is
        // unrecoverable after the fact.
        propertyId: await resolvePublicPropertyId(
          tenantId,
          (request.query as { property?: string }).property
        ),
        rating: body.rating,
        // The guest's name is the review's display name (the service falls back
        // to the customer profile name for signed-in reviewers, but storefront
        // submissions are guest-shaped: name in, no customerId).
        displayName: body.authorName,
        ...(body.title ? { title: body.title } : {}),
        body: body.body,
      });
      return ok({ reviewId: result.id, status: result.status });
    } catch (err) {
      throw badRequest((err as Error).message || 'Could not submit review.');
    }
  });

  // List a product's APPROVED reviews for the storefront (newest first), plus
  // the live rating summary. Moderation-only fields (email, status, notes) are
  // never exposed.
  app.get('/v1/public/commerce/products/:handle/reviews', async (request) => {
    const { handle } = HandleParam.parse(request.params);
    const query = ReviewListQuery.parse(request.query ?? {});
    const { tenantId, ctx } = await publicCommerceContext(request);

    // The storefront asking (docs/131 §4). listReviewsForProduct scopes to this
    // site plus tenant-wide/legacy reviews, and — crucially — its rating summary
    // uses the SAME scope, so the star average matches the reviews shown beneath
    // it. Earlier this caller passed no site, so the per-site scoping I added to
    // the service was inert on the busiest review surface.
    const propertyId = await resolvePublicPropertyId(
      tenantId,
      (request.query as { property?: string }).property
    );

    const product = await withTenant({ tenantId }, (tx) =>
      tx.product.findFirst({
        where: { handle, status: 'active', deletedAt: null },
        select: { id: true },
      })
    );
    if (!product) throw notFound('Product', handle);

    const { items, total, averageRating } = await reviewService.listReviewsForProduct(
      ctx,
      product.id,
      {
        status: 'approved',
        propertyId,
        take: query.perPage,
        skip: (query.page - 1) * query.perPage,
      }
    );

    return ok({
      summary: { averageRating, total },
      items: items.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        author: r.displayName,
        verifiedPurchase: r.verifiedPurchase,
        helpfulCount: r.helpfulCount,
        response: r.response,
        respondedAt: r.respondedAt,
        createdAt: r.createdAt,
      })),
    });
  });

  // ─── Q&A ───────────────────────────────────────────────────────────
  //
  //   GET  /v1/public/commerce/products/:handle/questions  ?tenant=
  //     → published questions + their answers (official answers first)
  //   POST /v1/public/commerce/products/:handle/questions  ?tenant=
  //     { displayName?, body }  → enters moderation (status=pending)
  //
  // A signed-in shopper's question is attributed to their customer id; guests
  // submit with an optional display name. Answers are merchant-authored, so the
  // storefront only reads them.

  app.get('/v1/public/commerce/products/:handle/questions', async (request) => {
    const { handle } = HandleParam.parse(request.params);
    const { tenantId, ctx } = await publicCommerceContext(request);

    const product = await withTenant({ tenantId }, (tx) =>
      tx.product.findFirst({
        where: { handle, status: 'active', deletedAt: null },
        select: { id: true },
      })
    );
    if (!product) throw notFound('Product', handle);

    const questions = await reviewService.listQuestionsForProduct(ctx, product.id, {
      status: 'published',
      // Questions asked on THIS storefront plus tenant-wide/legacy (docs/131 §4).
      propertyId: await resolvePublicPropertyId(
        tenantId,
        (request.query as { property?: string }).property
      ),
    });
    // Strip moderation-only fields; expose just what the PDP renders.
    return ok(
      questions.map((q) => ({
        id: q.id,
        displayName: q.displayName,
        body: q.body,
        createdAt: q.createdAt,
        helpfulCount: q.helpfulCount,
        answers: q.answers.map((a) => ({
          id: a.id,
          body: a.body,
          isOfficial: a.isOfficial,
          createdAt: a.createdAt,
        })),
      }))
    );
  });

  app.post('/v1/public/commerce/products/:handle/questions', async (request) => {
    const { handle } = HandleParam.parse(request.params);
    const body = QuestionBody.parse(request.body);
    const { tenantId, ctx } = await publicCommerceContext(request);

    const product = await withTenant({ tenantId }, (tx) =>
      tx.product.findFirst({
        where: { handle, status: 'active', deletedAt: null },
        select: { id: true },
      })
    );
    if (!product) throw notFound('Product', handle);

    // Attribute to the signed-in customer when a valid session is present;
    // otherwise it's a guest question (optional display name). docs/27 v2.
    const customerId = (await optionalCustomer(request, ctx))?.customerId;

    try {
      const result = await reviewService.submitQuestion(ctx, {
        productId: product.id,
        // Stamp the storefront the question was asked on (docs/131 §4).
        propertyId: await resolvePublicPropertyId(
          tenantId,
          (request.query as { property?: string }).property
        ),
        body: body.body,
        ...(customerId ? { customerId } : {}),
        ...(body.displayName ? { displayName: body.displayName } : {}),
      });
      return ok({ questionId: result.id, status: 'pending' });
    } catch (err) {
      throw badRequest((err as Error).message || 'Could not submit question.');
    }
  });

  return Promise.resolve();
};

export default publicReviewRoutes;
