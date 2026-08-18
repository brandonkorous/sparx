// Public (unauthenticated) context for the sparx.market storefront write surface.
//
// sparx.market is a SINGLE host serving every participating merchant, and a cart
// is single-merchant (docs/106 §4.7). Unlike the storefront — which resolves the
// seller tenant from the host via `?tenant=<slug>` — the marketplace resolves the
// seller TENANT from a `?merchant=<merchantSlug>` query param, validated against
// the global merchant projection (`marketService.resolveMerchantTenantId`).
//
// Everything downstream of tenant resolution (the ServiceContext, the Commerce
// module gate, and guest cart-token ownership) is shared verbatim with the
// storefront public context — we re-use those primitives rather than fork them.

import type { FastifyRequest } from 'fastify';
import { z } from 'zod';

import { marketService, type ServiceContext } from '@wizeworks/commerce';
import { notFound } from '@wizeworks/api-core/errors';

import {
  assertCartToken,
  requirePublicCommerceModule,
  toPublicCommerceContext,
} from './public-commerce-context.js';

const MerchantQuery = z.object({ merchant: z.string().min(1).max(63) });

/** Resolve the seller TENANT id from the `?merchant=<slug>` query param, or 404.
 *  Routes the cart/checkout to the owning merchant's tenant (single-merchant cart). */
export async function resolveMarketTenantId(request: FastifyRequest): Promise<string> {
  const { merchant } = MerchantQuery.parse(request.query);
  const tenantId = await marketService.resolveMerchantTenantId(merchant);
  if (!tenantId) throw notFound('Merchant', merchant);
  return tenantId;
}

/** Resolve the seller tenant from `?merchant=` + assert Commerce is active. */
export async function publicMarketContext(request: FastifyRequest): Promise<{
  tenantId: string;
  ctx: ServiceContext;
}> {
  const tenantId = await resolveMarketTenantId(request);
  await requirePublicCommerceModule(tenantId);
  return { tenantId, ctx: toPublicCommerceContext(tenantId) };
}

// Guest cart ownership is identical to the storefront — re-export so market
// routes import their token guard from one place.
export { assertCartToken, toPublicCommerceContext };
