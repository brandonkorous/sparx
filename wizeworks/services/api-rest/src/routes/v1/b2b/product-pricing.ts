// B2B pricing, seen through ONE product.
//
//   GET /v1/b2b/product-pricing?product_id=<uuid>
//
// What a trade customer pays for a product is decided by FOUR separate resources
// (tier overrides, account overrides, contract prices, the tier's blanket
// discount). This endpoint joins them once, keyed on the product, so a pricing
// panel renders in a single call rather than a request per tier + per account.
//
// It is READ-ONLY on purpose: every write has a home on the resource that owns
// it. That was written as though it settled the question and it did not — the
// routes existed and NO console screen called two of them, so a shop could
// delete an agreed price it had no way to create and both tables held 0 rows
// across all 43 tenants (issue 740). The console's wholesale price pane now
// posts to `/v1/b2b/accounts/:id/overrides` and `/v1/commerce/contract-prices`.
//
// The join lives in @wizeworks/b2b's pricingTierService.getProductPricing so REST +
// MCP report the exact same picture (one service, many transports). The order
// that actually charges is `pricingService.resolve`'s, and it is NOT
// resolve_b2b_price()'s: a contract price is looked up first and RETURNS, so an
// agreement beats everything, and resolve_b2b_price() (account override → tier
// override → tier blanket discount) decides the rest. This comment said the
// opposite and so did the pane above it (issue 742).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { pricingTierService } from '@wizeworks/b2b';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
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
