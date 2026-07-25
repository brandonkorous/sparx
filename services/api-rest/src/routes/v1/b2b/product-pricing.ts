// B2B pricing, seen through ONE product.
//
//   GET /v1/b2b/product-pricing?product_id=<uuid>
//
// What a trade customer pays for a product is decided by FOUR separate resources
// (tier overrides, account overrides, contract prices, the tier's blanket
// discount). This endpoint joins them once, keyed on the product, so a pricing
// panel renders in a single call rather than a request per tier + per account.
//
// It is READ-ONLY on purpose: every write already has a home on the resource that
// owns it. The join lives in @sparx/b2b's pricingTierService.getProductPricing so
// REST + MCP report the exact same picture (one service, many transports); the
// waterfall it describes is resolve_b2b_price()'s (account override → contract
// price → tier override → tier blanket discount → list).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { pricingTierService } from '@sparx/b2b';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireB2bModule, toB2bContext } from '../../../lib/b2b-context.js';

const ProductQuery = z.object({ product_id: z.string().uuid() });

const b2bProductPricingRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/b2b/product-pricing', async (request) => {
    requireRole(request, 'viewer');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { product_id: productId } = ProductQuery.parse(request.query);
    return ok(await pricingTierService.getProductPricing(ctx, productId));
  });

  return Promise.resolve();
};

export default b2bProductPricingRoutes;
