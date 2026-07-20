// Commerce — subscriptions, seen through ONE product.
//
//   GET /v1/commerce/products/:productId/subscriptions
//
// The subscription models, the service and the billing worker have all been
// live for some time with NO api-rest transport at all — subscriptions were
// reachable only from inside the platform. This is the first route over them,
// and it is deliberately the product-scoped read rather than a full CRUD
// surface: managing a subscription is a customer-side act (pause, skip, change
// the address), and putting those verbs under a product path would be the wrong
// noun for every one of them.
//
// So: what a product can honestly answer about subscriptions is "is anyone on a
// repeat order for this, what is that worth per month, and how many units a
// month does it commit me to". That is what this returns.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { subscriptionService } from '@sparx/commerce';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { notFound } from '@sparx/api-core/errors';
import { withTenant } from '@sparx/db';
import { requireCommerceModule, toCommerceContext } from '../../../lib/commerce-context.js';

const ProductIdParam = z.object({ productId: z.string().uuid() });
const ListQuery = z.object({
  take: z.coerce.number().int().min(1).max(200).optional(),
});

const productSubscriptionRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/commerce/products/:productId/subscriptions', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const ctx = toCommerceContext(request);
    const { productId } = ProductIdParam.parse(request.params);
    const q = ListQuery.parse(request.query ?? {});

    // An empty result must mean "nobody subscribes to this", never "no such
    // product" — the two land on completely different screens.
    const product = await withTenant(ctx, (tx) =>
      tx.product.findFirst({
        where: { id: productId, deletedAt: null },
        select: { id: true, fulfillmentType: true },
      })
    );
    if (!product) throw notFound('product', productId);

    const summary = await subscriptionService.listForProduct(ctx, productId, {
      ...(q.take !== undefined ? { take: q.take } : {}),
    });

    // Carried so the caller can tell "set up to sell on repeat but nobody has
    // yet" apart from "not a subscription product at all" without a second
    // request for the product record it may not otherwise need.
    return ok({ ...summary, fulfillmentType: product.fulfillmentType });
  });

  return Promise.resolve();
};

export default productSubscriptionRoutes;
