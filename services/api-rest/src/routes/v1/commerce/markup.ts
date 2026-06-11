// Commerce — catalog markup rules (docs/48 Phase 1).
//
// Rule CRUD plus the dry-run `preview` and the write `apply`, and the
// variant-scoped bind/unbind the product editor's "Price by rule" toggle
// uses. All routes are commerce-module gated.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { markupRecomputeService, markupService } from '@sparx/commerce';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireCommerceModule, toCommerceContext } from '../../../lib/commerce-context.js';

const PathId = z.object({ id: z.string().uuid() });
const VariantParam = z.object({ variantId: z.string().uuid() });
const BindBody = z.object({ ruleId: z.string().uuid() });
const BulkResolveBody = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  action: z.enum(['approve', 'reject']),
});

// Optional { scope } override body for preview/apply. The scope itself is
// validated inside the service (MarkupScope) so this route stays schema-light.
function scopeFromBody(body: unknown): unknown {
  return body && typeof body === 'object' ? (body as { scope?: unknown }).scope : undefined;
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync demands async; registration is sync.
const markupRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/markup-rules', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const q = request.query as Record<string, string | undefined>;
    return ok(
      await markupService.listRules(toCommerceContext(request), {
        ...(q?.applies_to ? { appliesTo: q.applies_to } : {}),
        ...(q?.is_active != null ? { isActive: q.is_active === 'true' } : {}),
      })
    );
  });

  app.post('/v1/markup-rules', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const created = await markupService.createRule(toCommerceContext(request), request.body);
    reply.code(201);
    return ok(created);
  });

  app.get('/v1/markup-rules/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await markupService.getRule(toCommerceContext(request), id));
  });

  app.patch('/v1/markup-rules/:id', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await markupService.updateRule(toCommerceContext(request), id, request.body));
  });

  app.delete('/v1/markup-rules/:id', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    await markupService.deleteRule(toCommerceContext(request), id);
    reply.code(204);
  });

  // Dry-run: returns before/after price + margin for the scoped variants.
  // Never writes — safe for viewers (the bulk tool gates Apply separately).
  app.post('/v1/markup-rules/:id/preview', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    return ok(
      await markupService.previewRule(toCommerceContext(request), id, scopeFromBody(request.body))
    );
  });

  // Bind + recompute every scoped variant. Publishes product.updated per
  // touched product so the search index reprices.
  app.post('/v1/markup-rules/:id/apply', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    return ok(
      await markupService.applyRule(toCommerceContext(request), id, scopeFromBody(request.body))
    );
  });

  // Variant-scoped binding — the product editor "Price by rule" toggle.
  app.put('/v1/commerce/variants/:variantId/markup', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { variantId } = VariantParam.parse(request.params);
    const { ruleId } = BindBody.parse(request.body);
    return ok(await markupService.bindVariant(toCommerceContext(request), variantId, ruleId));
  });

  app.delete('/v1/commerce/variants/:variantId/markup', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { variantId } = VariantParam.parse(request.params);
    await markupService.unbindVariant(toCommerceContext(request), variantId);
    reply.code(204);
  });

  // ─── Staged price-recompute review queue (docs/48 §8/§11) ───────────────
  // Cost-driven price changes the markup-recompute-worker chose not to apply
  // silently (a rule in review mode, or auto beyond its tolerance band).

  app.get('/v1/markup-recompute-reviews', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const q = request.query as Record<string, string | undefined>;
    return ok(
      await markupRecomputeService.listReviews(toCommerceContext(request), {
        ...(q?.status ? { status: q.status } : {}),
      })
    );
  });

  app.get('/v1/markup-recompute-reviews/count', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    return ok({ pending: await markupRecomputeService.countPending(toCommerceContext(request)) });
  });

  app.post('/v1/markup-recompute-reviews/:id/approve', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await markupRecomputeService.approveReview(toCommerceContext(request), id));
  });

  app.post('/v1/markup-recompute-reviews/:id/reject', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    await markupRecomputeService.rejectReview(toCommerceContext(request), id);
    reply.code(204);
  });

  app.post('/v1/markup-recompute-reviews/bulk', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { ids, action } = BulkResolveBody.parse(request.body);
    return ok(await markupRecomputeService.resolveReviews(toCommerceContext(request), ids, action));
  });
};

export default markupRoutes;
