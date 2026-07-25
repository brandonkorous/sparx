// B2B pricing tiers + per-tier product/collection overrides + price resolution.
//
//   GET    /v1/b2b/pricing-tiers              → list all tiers
//   POST   /v1/b2b/pricing-tiers              → create tier
//   GET    /v1/b2b/pricing-tiers/:id          → fetch one
//   PATCH  /v1/b2b/pricing-tiers/:id          → update
//   DELETE /v1/b2b/pricing-tiers/:id          → soft-delete
//   GET    /v1/b2b/pricing-tiers/:id/overrides → list overrides for this tier
//   POST   /v1/b2b/pricing-tiers/:id/overrides → add override
//   PATCH  /v1/b2b/pricing-tiers/:id/overrides/:oid → update override
//   DELETE /v1/b2b/pricing-tiers/:id/overrides/:oid → remove override
//   GET    /v1/b2b/resolve-price              → effective price for one variant × account
//
// Thin transport over @sparx/b2b's pricingTierService (one service, many
// transports) — the same functions the MCP tool registry drives.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { pricingTierService } from '@sparx/b2b';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireB2bModule, toB2bContext } from '../../../lib/b2b-context.js';

const PathId = z.object({ id: z.string().uuid() });
const PathIdOid = z.object({ id: z.string().uuid(), oid: z.string().uuid() });

const b2bPricingTierRoutes: FastifyPluginAsync = (app) => {
  // ─── Tiers ────────────────────────────────────────────────────────────────

  app.get('/v1/b2b/pricing-tiers', async (request) => {
    requireRole(request, 'viewer');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { items, total, take } = await pricingTierService.listTiers(
      ctx,
      pricingTierService.ListTiersQuery.parse(request.query)
    );
    return paged(items, { total, per_page: take });
  });

  app.post('/v1/b2b/pricing-tiers', async (request, reply) => {
    requireRole(request, 'editor');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const tier = await pricingTierService.createTier(ctx, request.body);
    reply.code(201);
    return ok(tier);
  });

  app.get('/v1/b2b/pricing-tiers/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);
    return ok(await pricingTierService.getTier(ctx, id));
  });

  app.patch('/v1/b2b/pricing-tiers/:id', async (request) => {
    requireRole(request, 'editor');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);
    return ok(await pricingTierService.updateTier(ctx, id, request.body));
  });

  app.delete('/v1/b2b/pricing-tiers/:id', async (request, reply) => {
    requireRole(request, 'admin');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);
    await pricingTierService.deleteTier(ctx, id);
    reply.code(204);
  });

  // ─── Tier overrides ───────────────────────────────────────────────────────

  app.get('/v1/b2b/pricing-tiers/:id/overrides', async (request) => {
    requireRole(request, 'viewer');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id: tierId } = PathId.parse(request.params);
    return ok(await pricingTierService.listTierOverrides(ctx, tierId));
  });

  app.post('/v1/b2b/pricing-tiers/:id/overrides', async (request, reply) => {
    requireRole(request, 'editor');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id: tierId } = PathId.parse(request.params);
    const override = await pricingTierService.addTierOverride(ctx, tierId, request.body);
    reply.code(201);
    return ok(override);
  });

  app.patch('/v1/b2b/pricing-tiers/:id/overrides/:oid', async (request) => {
    requireRole(request, 'editor');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id: tierId, oid } = PathIdOid.parse(request.params);
    return ok(await pricingTierService.updateTierOverride(ctx, tierId, oid, request.body));
  });

  app.delete('/v1/b2b/pricing-tiers/:id/overrides/:oid', async (request, reply) => {
    requireRole(request, 'editor');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id: tierId, oid } = PathIdOid.parse(request.params);
    await pricingTierService.removeTierOverride(ctx, tierId, oid);
    reply.code(204);
  });

  // ─── Price resolution ─────────────────────────────────────────────────────

  app.get('/v1/b2b/resolve-price', async (request) => {
    requireRole(request, 'viewer');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const input = z
      .object({ variant_id: z.string().uuid(), account_id: z.string().uuid() })
      .parse(request.query);
    return ok(
      await pricingTierService.resolveB2bPrice(ctx, {
        variantId: input.variant_id,
        accountId: input.account_id,
      })
    );
  });

  return Promise.resolve();
};

export default b2bPricingTierRoutes;
