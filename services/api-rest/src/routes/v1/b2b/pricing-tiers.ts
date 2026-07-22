// B2B pricing tiers + per-tier product/collection overrides.
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

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Prisma } from '@sparx/db';
import { prisma, withTenant } from '@sparx/db';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { notFound } from '@sparx/api-core/errors';
import { requireB2bModule, toB2bContext } from '../../../lib/b2b-context.js';

const PathId = z.object({ id: z.string().uuid() });
const PathIdOid = z.object({ id: z.string().uuid(), oid: z.string().uuid() });

const ListTiersQuery = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const TierBody = z.object({
  name: z.string().min(1).max(127),
  description: z.string().max(2000).optional(),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().min(0),
  productScope: z.enum(['all', 'collections', 'products']).default('all'),
  minOrderCents: z.number().int().min(0).default(0),
});

const OverrideBody = z
  .object({
    variantId: z.string().uuid().optional(),
    collectionId: z.string().uuid().optional(),
    priceCents: z.number().int().min(0).optional(),
    discountPercentage: z.number().min(0).max(100).optional(),
    notes: z.string().max(1000).optional(),
  })
  .refine((d) => Boolean(d.variantId) !== Boolean(d.collectionId), {
    message: 'Provide exactly one of variantId or collectionId',
  })
  .refine(
    (d) => Boolean(d.priceCents !== undefined) !== Boolean(d.discountPercentage !== undefined),
    { message: 'Provide exactly one of priceCents or discountPercentage' }
  );

function toTierView(t: {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  discountType: string;
  discountValue: unknown;
  productScope: string;
  minOrderCents: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  _count?: { accounts: number };
}) {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    discountType: t.discountType,
    discountValue: Number(t.discountValue),
    productScope: t.productScope,
    minOrderCents: t.minOrderCents,
    accountCount: t._count?.accounts ?? undefined,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

const b2bPricingTierRoutes: FastifyPluginAsync = (app) => {
  // ─── Tiers ────────────────────────────────────────────────────────────────

  app.get('/v1/b2b/pricing-tiers', async (request) => {
    requireRole(request, 'viewer');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const q = ListTiersQuery.parse(request.query);
    const take = Math.min(q.take ?? 50, 250);
    const skip = q.skip ?? 0;

    const where: Prisma.B2bPricingTierWhereInput = {
      tenantId: ctx.tenantId,
      deletedAt: null,
      ...(q.q
        ? {
            OR: [
              { name: { contains: q.q, mode: 'insensitive' } },
              { description: { contains: q.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const { tiers, total } = await withTenant(ctx, async (tx) => {
      const [tiers, total] = await Promise.all([
        tx.b2bPricingTier.findMany({
          where,
          orderBy: { name: 'asc' },
          include: { _count: { select: { accounts: true } } },
          take,
          skip,
        }),
        tx.b2bPricingTier.count({ where }),
      ]);
      return { tiers, total };
    });

    return paged(tiers.map(toTierView), { total, per_page: q.take ?? 50 });
  });

  app.post('/v1/b2b/pricing-tiers', async (request, reply) => {
    requireRole(request, 'editor');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const body = TierBody.parse(request.body);

    const tier = await withTenant(ctx, (tx) =>
      tx.b2bPricingTier.create({
        data: {
          tenantId: ctx.tenantId,
          name: body.name,
          description: body.description,
          discountType: body.discountType,
          discountValue: body.discountValue,
          productScope: body.productScope,
          minOrderCents: body.minOrderCents,
        },
        include: { _count: { select: { accounts: true } } },
      })
    );

    reply.code(201);
    return ok(toTierView(tier));
  });

  app.get('/v1/b2b/pricing-tiers/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);

    const tier = await withTenant(ctx, (tx) =>
      tx.b2bPricingTier.findFirst({
        where: { id, tenantId: ctx.tenantId, deletedAt: null },
        include: { _count: { select: { accounts: true } } },
      })
    );
    if (!tier) throw notFound('pricing tier');
    return ok(toTierView(tier));
  });

  app.patch('/v1/b2b/pricing-tiers/:id', async (request) => {
    requireRole(request, 'editor');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);
    const body = TierBody.partial().parse(request.body);

    const existing = await withTenant(ctx, (tx) =>
      tx.b2bPricingTier.findFirst({ where: { id, tenantId: ctx.tenantId, deletedAt: null } })
    );
    if (!existing) throw notFound('pricing tier');

    const updated = await withTenant(ctx, (tx) =>
      tx.b2bPricingTier.update({
        where: { id },
        data: { ...body, updatedAt: new Date() },
        include: { _count: { select: { accounts: true } } },
      })
    );
    return ok(toTierView(updated));
  });

  app.delete('/v1/b2b/pricing-tiers/:id', async (request, reply) => {
    requireRole(request, 'admin');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);

    const existing = await withTenant(ctx, (tx) =>
      tx.b2bPricingTier.findFirst({ where: { id, tenantId: ctx.tenantId, deletedAt: null } })
    );
    if (!existing) throw notFound('pricing tier');

    // Soft-delete. Accounts retain their pricing_tier_id FK but the tier is
    // hidden from the list; the service returns list price for soft-deleted tiers.
    await withTenant(ctx, (tx) =>
      tx.b2bPricingTier.update({ where: { id }, data: { deletedAt: new Date() } })
    );
    reply.code(204);
  });

  // ─── Tier overrides ───────────────────────────────────────────────────────

  app.get('/v1/b2b/pricing-tiers/:id/overrides', async (request) => {
    requireRole(request, 'viewer');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id: tierId } = PathId.parse(request.params);

    const tier = await withTenant(ctx, (tx) =>
      tx.b2bPricingTier.findFirst({
        where: { id: tierId, tenantId: ctx.tenantId, deletedAt: null },
      })
    );
    if (!tier) throw notFound('pricing tier');

    const overrides = await withTenant(ctx, (tx) =>
      tx.b2bTierProductOverride.findMany({
        where: { tierId, tenantId: ctx.tenantId },
        orderBy: { createdAt: 'asc' },
        include: {
          variant: { select: { id: true, sku: true, title: true } },
          // `name`, NOT `title` — ProductCollection has no `title` column, and
          // an invalid select throws at runtime, which made every tier-override
          // read and write answer 500. The account-override routes next door
          // already spell it correctly.
          collection: { select: { id: true, name: true } },
        },
      })
    );

    return ok(overrides);
  });

  app.post('/v1/b2b/pricing-tiers/:id/overrides', async (request, reply) => {
    requireRole(request, 'editor');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id: tierId } = PathId.parse(request.params);
    const body = OverrideBody.parse(request.body);

    const tier = await withTenant(ctx, (tx) =>
      tx.b2bPricingTier.findFirst({
        where: { id: tierId, tenantId: ctx.tenantId, deletedAt: null },
      })
    );
    if (!tier) throw notFound('pricing tier');

    const override = await withTenant(ctx, (tx) =>
      tx.b2bTierProductOverride.create({
        data: {
          tenantId: ctx.tenantId,
          tierId,
          variantId: body.variantId,
          collectionId: body.collectionId,
          priceCents: body.priceCents,
          discountPercentage: body.discountPercentage,
          notes: body.notes,
        },
        include: {
          variant: { select: { id: true, sku: true, title: true } },
          // `name`, NOT `title` — ProductCollection has no `title` column, and
          // an invalid select throws at runtime, which made every tier-override
          // read and write answer 500. The account-override routes next door
          // already spell it correctly.
          collection: { select: { id: true, name: true } },
        },
      })
    );

    reply.code(201);
    return ok(override);
  });

  app.patch('/v1/b2b/pricing-tiers/:id/overrides/:oid', async (request) => {
    requireRole(request, 'editor');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id: tierId, oid } = PathIdOid.parse(request.params);
    const body = OverrideBody.partial().parse(request.body);

    const existing = await withTenant(ctx, (tx) =>
      tx.b2bTierProductOverride.findFirst({
        where: { id: oid, tierId, tenantId: ctx.tenantId },
      })
    );
    if (!existing) throw notFound('override');

    const updated = await withTenant(ctx, (tx) =>
      tx.b2bTierProductOverride.update({
        where: { id: oid },
        data: { ...body, updatedAt: new Date() },
        include: {
          variant: { select: { id: true, sku: true, title: true } },
          // `name`, NOT `title` — ProductCollection has no `title` column, and
          // an invalid select throws at runtime, which made every tier-override
          // read and write answer 500. The account-override routes next door
          // already spell it correctly.
          collection: { select: { id: true, name: true } },
        },
      })
    );
    return ok(updated);
  });

  app.delete('/v1/b2b/pricing-tiers/:id/overrides/:oid', async (request, reply) => {
    requireRole(request, 'editor');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id: tierId, oid } = PathIdOid.parse(request.params);

    const existing = await withTenant(ctx, (tx) =>
      tx.b2bTierProductOverride.findFirst({
        where: { id: oid, tierId, tenantId: ctx.tenantId },
      })
    );
    if (!existing) throw notFound('override');

    await withTenant(ctx, (tx) => tx.b2bTierProductOverride.delete({ where: { id: oid } }));
    reply.code(204);
  });

  // ─── Price resolution endpoint ────────────────────────────────────────────
  // Exposes resolve_b2b_price() for the dashboard's pricing preview + the
  // B2B portal's cart price display.

  app.get('/v1/b2b/resolve-price', async (request) => {
    requireRole(request, 'viewer');
    await requireB2bModule(request);
    const { variant_id: variantId, account_id: accountId } = z
      .object({
        variant_id: z.string().uuid(),
        account_id: z.string().uuid(),
      })
      .parse(request.query);

    const result = await prisma.$queryRaw<{ resolve_b2b_price: number | null }[]>`
      SELECT resolve_b2b_price(${variantId}::uuid, ${accountId}::uuid)
    `;

    const effectivePrice = result[0]?.resolve_b2b_price ?? null;
    return ok({ variantId, accountId, effectivePriceCents: effectivePrice });
  });

  return Promise.resolve();
};

export default b2bPricingTierRoutes;
