// Commerce — carts (admin view) + checkout sessions.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { cartService, checkoutService } from '@wizeworks/commerce';
import { withRequestTenant } from '@wizeworks/api-core/db';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireCommerceModule, toCommerceContext } from '../../../lib/commerce-context.js';

const CartParam = z.object({ cartId: z.string().uuid() });
const SessionParam = z.object({ sessionId: z.string().uuid() });

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; no top-level await needed because route registration is sync.
const cartRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/commerce/carts/:cartId', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const { cartId } = CartParam.parse(request.params);
    const snapshot = await cartService.get(toCommerceContext(request), cartId);
    if (!snapshot) return ok(null);
    // The shared CartSnapshot the storefront reads carries `abandonedAt` but not
    // `recoveredAt` — a storefront never needs it. The admin detail view does:
    // without it a recovered cart reads as "in progress". Read the one column
    // here rather than widening the storefront-facing snapshot type.
    const meta = await withRequestTenant(request, (tx) =>
      tx.cart.findFirst({ where: { id: cartId }, select: { recoveredAt: true } })
    );
    return ok({ ...snapshot, recoveredAt: meta?.recoveredAt?.toISOString() ?? null });
  });

  app.post('/v1/commerce/carts/:cartId/abandoned', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { cartId } = CartParam.parse(request.params);
    await cartService.markAbandoned(toCommerceContext(request), cartId);
    return ok({ cartId, marked: 'abandoned' });
  });

  app.post('/v1/commerce/carts/:cartId/recovered', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { cartId } = CartParam.parse(request.params);
    await cartService.markRecovered(toCommerceContext(request), cartId);
    return ok({ cartId, marked: 'recovered' });
  });

  // Checkout sessions — most are storefront-only; here the read endpoint
  // backs the dashboard's session-inspection view.
  app.get('/v1/commerce/checkout-sessions/:sessionId', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const { sessionId } = SessionParam.parse(request.params);
    return ok(await checkoutService.get(toCommerceContext(request), sessionId));
  });

  // Expire a stalled checkout session by hand. The worker sweep expires
  // sessions past their TTL automatically; this lets an operator release one
  // early (freeing any inventory it holds) from the session-inspection view.
  // A no-op on an already completed/expired session — the service guards it.
  app.post('/v1/commerce/checkout-sessions/:sessionId/expire', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { sessionId } = SessionParam.parse(request.params);
    await checkoutService.expire(toCommerceContext(request), sessionId);
    return ok({ sessionId, expired: true });
  });
};

export default cartRoutes;
