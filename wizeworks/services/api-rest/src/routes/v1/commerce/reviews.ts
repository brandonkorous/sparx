// Commerce — reviews, Q&A, wishlists.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { reviewService } from '@wizeworks/commerce';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireCommerceModule, toCommerceContext } from '../../../lib/commerce-context.js';

const PathId = z.object({ id: z.string().uuid() });
const ProductIdParam = z.object({ productId: z.string().uuid() });

const BulkModerateReviews = z.object({
  reviewIds: z.array(z.string().uuid()).min(1).max(200),
  status: z.enum(['approved', 'rejected', 'flagged']),
  moderationNote: z.string().max(2000).optional(),
});
const BulkDeleteReviews = z.object({
  reviewIds: z.array(z.string().uuid()).min(1).max(200),
});
const ProductQuestionsQuery = z.object({
  status: z.enum(['pending', 'published', 'rejected']).optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
});
const BulkModerateQuestions = z.object({
  questionIds: z.array(z.string().uuid()).min(1).max(200),
  status: z.enum(['published', 'rejected']),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; no top-level await needed because route registration is sync.
const reviewRoutes: FastifyPluginAsync = async (app) => {
  // Reviews
  app.get('/v1/commerce/reviews/pending', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    return ok(await reviewService.listPendingModeration(toCommerceContext(request)));
  });

  app.get('/v1/commerce/reviews/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await reviewService.getReview(toCommerceContext(request), id));
  });

  app.get('/v1/commerce/products/:productId/reviews', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const { productId } = ProductIdParam.parse(request.params);
    const q = request.query as Record<string, string | undefined>;
    return ok(
      await reviewService.listReviewsForProduct(toCommerceContext(request), productId, {
        status: q?.status as never,
        take: q?.take ? Number(q.take) : undefined,
      })
    );
  });

  app.post('/v1/commerce/reviews/:id/moderate', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    const body = (request.body as Record<string, unknown>) ?? {};
    await reviewService.moderate(toCommerceContext(request), { ...body, reviewId: id });
    return ok({ id, moderated: true });
  });

  app.post('/v1/commerce/reviews/:id/respond', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    const body = (request.body as Record<string, unknown>) ?? {};
    await reviewService.respond(toCommerceContext(request), { ...body, reviewId: id });
    return ok({ id, responded: true });
  });

  app.delete('/v1/commerce/reviews/:id', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    await reviewService.deleteReview(toCommerceContext(request), id);
    reply.code(204);
  });

  // Bulk moderation — one status applied to many reviews from the moderation
  // queue. Stale/missing ids are skipped; the response reports how many changed.
  app.post('/v1/commerce/reviews/bulk-moderate', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const body = BulkModerateReviews.parse(request.body ?? {});
    const result = await reviewService.moderateMany(toCommerceContext(request), {
      reviewIds: body.reviewIds,
      status: body.status,
      ...(body.moderationNote ? { moderationNote: body.moderationNote } : {}),
    });
    return ok(result);
  });

  app.post('/v1/commerce/reviews/bulk-delete', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const body = BulkDeleteReviews.parse(request.body ?? {});
    const result = await reviewService.deleteReviews(toCommerceContext(request), body.reviewIds);
    return ok(result);
  });

  // Q&A
  //
  // The per-product list mirrors `/products/:productId/reviews`. Without it the
  // only way to see one product's questions was the tenant-wide PENDING queue,
  // which by definition cannot show the ones already answered — so a product
  // panel had no way to render its own Q&A history at all.
  app.get('/v1/commerce/products/:productId/questions', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const { productId } = ProductIdParam.parse(request.params);
    const q = ProductQuestionsQuery.parse(request.query ?? {});
    return ok(
      await reviewService.listQuestionsForProduct(toCommerceContext(request), productId, {
        ...(q.status ? { status: q.status } : {}),
        ...(q.take !== undefined ? { take: q.take } : {}),
      })
    );
  });

  app.get('/v1/commerce/questions/pending', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    return ok(await reviewService.listPendingQuestions(toCommerceContext(request)));
  });

  app.post('/v1/commerce/questions/:id/moderate', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    const body = z.object({ status: z.enum(['published', 'rejected']) }).parse(request.body ?? {});
    await reviewService.moderateQuestion(toCommerceContext(request), {
      questionId: id,
      status: body.status,
    });
    return ok({ id, moderated: true });
  });

  app.post('/v1/commerce/questions/bulk-moderate', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const body = BulkModerateQuestions.parse(request.body ?? {});
    const result = await reviewService.moderateQuestionMany(toCommerceContext(request), {
      questionIds: body.questionIds,
      status: body.status,
    });
    return ok(result);
  });

  app.post('/v1/commerce/questions/:id/answer', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    const body = (request.body as Record<string, unknown>) ?? {};
    return ok(
      await reviewService.submitAnswer(toCommerceContext(request), { ...body, questionId: id })
    );
  });

  // Wishlists analytics
  app.get('/v1/commerce/wishlists/top-variants', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const q = request.query as Record<string, string | undefined>;
    return ok(
      await reviewService.topWishlistedVariants(
        toCommerceContext(request),
        q?.take ? Number(q.take) : 50
      )
    );
  });
};

export default reviewRoutes;
