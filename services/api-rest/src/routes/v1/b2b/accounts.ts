// B2B accounts — B2B-module-enriched view of the CRM's b2b_accounts spine.
//
// These routes add pricing tier assignment, account-level product overrides,
// fleet/engine-profile management, and the credit/status data that
// CRM's /v1/crm/b2b-accounts already returns.
//
//   GET    /v1/b2b/accounts                          → list (with tier/credit info)
//   GET    /v1/b2b/accounts/:id                      → fetch one (enriched)
//   PATCH  /v1/b2b/accounts/:id                      → update B2B fields (tier, credit, notes)
//   PUT    /v1/b2b/accounts/:id/engine-profiles       → replace fleet profile array
//   GET    /v1/b2b/accounts/:id/compatible-products   → products compatible with fleet
//   GET    /v1/b2b/accounts/:id/overrides             → list per-account overrides
//   POST   /v1/b2b/accounts/:id/overrides             → add override
//   PATCH  /v1/b2b/accounts/:id/overrides/:oid        → update override
//   DELETE /v1/b2b/accounts/:id/overrides/:oid        → remove override

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant } from '@sparx/db';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { notFound } from '@sparx/api-core/errors';
import { requireB2bModule, toB2bContext } from '../../../lib/b2b-context.js';

const PathId = z.object({ id: z.string().uuid() });
const PathIdOid = z.object({ id: z.string().uuid(), oid: z.string().uuid() });

const ListQuery = z.object({
  status: z.enum(['active', 'credit_hold', 'suspended', 'inactive']).optional(),
  tier_id: z.string().uuid().optional(),
  overdue: z.coerce.boolean().optional(),
  q: z.string().max(255).optional(),
  take: z.coerce.number().int().min(1).max(250).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const AccountPatchBody = z.object({
  pricingTierId: z.string().uuid().nullable().optional(),
  creditLimitCents: z.number().int().min(0).optional(),
  paymentTerms: z.enum(['prepay', 'net30', 'net60', 'net90']).nullable().optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  status: z.enum(['active', 'credit_hold', 'suspended', 'inactive']).optional(),
  internalNotes: z.string().max(5000).nullable().optional(),
  fleetSize: z.number().int().min(0).nullable().optional(),
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

// An engine profile entry. fitmentVariantId / fitmentItemId / fitmentCategoryId
// store the IDs from the fitment vocabulary so compatible-products queries can
// be done by ID join rather than text match.
const EngineProfileEntry = z.object({
  fitmentCategoryId: z.string().uuid().optional(), // FitmentCategory (make)
  fitmentItemId: z.string().uuid().optional(), // FitmentItem (model)
  fitmentVariantId: z.string().uuid().optional(), // FitmentVariant (engine)
  year: z.number().int().min(1900).max(2100).optional(),
  displayName: z.string().max(255),
  count: z.number().int().min(1).default(1),
});

const EngineProfilesBody = z.object({
  profiles: z.array(EngineProfileEntry).max(100),
  fleetSize: z.number().int().min(0).optional(),
});

function toAccountView(a: {
  id: string;
  companyName: string;
  taxId: string | null;
  website: string | null;
  pricingTier: string | null;
  pricingTierId: string | null;
  creditLimit: unknown;
  creditUsed: unknown;
  paymentTerms: string | null;
  discountPercent: unknown;
  status: string;
  fleetSize: number | null;
  engineProfiles: unknown;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  pricingTierFk?: { id: string; name: string; discountType: string; discountValue: unknown } | null;
}) {
  const limit = Number(a.creditLimit ?? 0);
  const used = Number(a.creditUsed ?? 0);
  return {
    id: a.id,
    companyName: a.companyName,
    taxId: a.taxId,
    website: a.website,
    pricingTierId: a.pricingTierId,
    pricingTierName: a.pricingTierFk?.name ?? a.pricingTier,
    pricingTier: a.pricingTierFk
      ? {
          id: a.pricingTierFk.id,
          name: a.pricingTierFk.name,
          discountType: a.pricingTierFk.discountType,
          discountValue: Number(a.pricingTierFk.discountValue),
        }
      : null,
    creditLimitCents: Math.round(limit * 100),
    creditUsedCents: Math.round(used * 100),
    creditRemainingCents: Math.round(Math.max(0, limit - used) * 100),
    creditUtilizationPct: limit > 0 ? Math.round((used / limit) * 10000) / 100 : 0,
    paymentTerms: a.paymentTerms,
    discountPercent: Number(a.discountPercent ?? 0),
    status: a.status,
    fleetSize: a.fleetSize,
    engineProfiles: a.engineProfiles,
    notes: a.notes,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

const b2bAccountRoutes: FastifyPluginAsync = (app) => {
  // ─── List ─────────────────────────────────────────────────────────────────

  app.get('/v1/b2b/accounts', async (request) => {
    requireRole(request, 'viewer');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const q = ListQuery.parse(request.query);

    const where: Record<string, unknown> = {
      tenantId: ctx.tenantId,
      deletedAt: null,
    };
    if (q.status) where.status = q.status;
    if (q.tier_id) where.pricingTierId = q.tier_id;
    if (q.q) {
      where.OR = [
        { companyName: { contains: q.q, mode: 'insensitive' } },
        { taxId: { contains: q.q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      withTenant(ctx, (tx) =>
        tx.b2BAccount.findMany({
          where,
          take: q.take,
          skip: q.skip,
          orderBy: { companyName: 'asc' },
          include: {
            pricingTierFk: {
              select: { id: true, name: true, discountType: true, discountValue: true },
            },
          },
        })
      ),
      withTenant(ctx, (tx) => tx.b2BAccount.count({ where })),
    ]);

    return paged(items.map(toAccountView), { total, per_page: q.take });
  });

  // ─── Get one ──────────────────────────────────────────────────────────────

  app.get('/v1/b2b/accounts/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);

    const account = await withTenant(ctx, (tx) =>
      tx.b2BAccount.findFirst({
        where: { id, tenantId: ctx.tenantId, deletedAt: null },
        include: {
          pricingTierFk: {
            select: { id: true, name: true, discountType: true, discountValue: true },
          },
          _count: { select: { productOverrides: true } },
        },
      })
    );
    if (!account) throw notFound('b2b account');
    return ok({ ...toAccountView(account), overrideCount: account._count.productOverrides });
  });

  // ─── Patch (B2B-specific fields) ─────────────────────────────────────────

  app.patch('/v1/b2b/accounts/:id', async (request) => {
    requireRole(request, 'editor');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);
    const body = AccountPatchBody.parse(request.body);

    const existing = await withTenant(ctx, (tx) =>
      tx.b2BAccount.findFirst({ where: { id, tenantId: ctx.tenantId, deletedAt: null } })
    );
    if (!existing) throw notFound('b2b account');

    // Validate new tier belongs to this tenant.
    if (body.pricingTierId) {
      const tier = await withTenant(ctx, (tx) =>
        tx.b2bPricingTier.findFirst({
          where: { id: body.pricingTierId!, tenantId: ctx.tenantId, deletedAt: null },
        })
      );
      if (!tier) throw notFound('pricing tier');
    }

    const updated = await withTenant(ctx, (tx) =>
      tx.b2BAccount.update({
        where: { id },
        data: {
          pricingTierId: body.pricingTierId,
          // creditLimit/creditUsed stored as Decimal in CRM schema; cents→decimal.
          ...(body.creditLimitCents !== undefined
            ? { creditLimit: (body.creditLimitCents / 100).toFixed(2) }
            : {}),
          paymentTerms: body.paymentTerms,
          discountPercent: body.discountPercent,
          status: body.status,
          notes: body.internalNotes,
          fleetSize: body.fleetSize,
          updatedAt: new Date(),
        },
        include: {
          pricingTierFk: {
            select: { id: true, name: true, discountType: true, discountValue: true },
          },
        },
      })
    );
    return ok(toAccountView(updated));
  });

  // ─── Engine profiles (fleet) ─────────────────────────────────────────────

  app.put('/v1/b2b/accounts/:id/engine-profiles', async (request) => {
    requireRole(request, 'editor');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);
    const body = EngineProfilesBody.parse(request.body);

    const account = await withTenant(ctx, (tx) =>
      tx.b2BAccount.findFirst({ where: { id, tenantId: ctx.tenantId, deletedAt: null } })
    );
    if (!account) throw notFound('b2b account');

    const updated = await withTenant(ctx, (tx) =>
      tx.b2BAccount.update({
        where: { id },
        data: {
          engineProfiles: body.profiles,
          ...(body.fleetSize !== undefined ? { fleetSize: body.fleetSize } : {}),
          updatedAt: new Date(),
        },
        select: { id: true, engineProfiles: true, fleetSize: true },
      })
    );
    return ok(updated);
  });

  // ─── Compatible products (fleet-filtered catalog) ─────────────────────────

  app.get('/v1/b2b/accounts/:id/compatible-products', async (request) => {
    requireRole(request, 'viewer');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);
    const q = z
      .object({
        take: z.coerce.number().int().min(1).max(250).default(50),
        skip: z.coerce.number().int().min(0).default(0),
      })
      .parse(request.query);

    const account = await withTenant(ctx, (tx) =>
      tx.b2BAccount.findFirst({
        where: { id, tenantId: ctx.tenantId, deletedAt: null },
        select: { id: true, engineProfiles: true },
      })
    );
    if (!account) throw notFound('b2b account');

    const profiles = Array.isArray(account.engineProfiles)
      ? (account.engineProfiles as {
          fitmentCategoryId?: string;
          fitmentItemId?: string;
          fitmentVariantId?: string;
          year?: number;
        }[])
      : [];

    if (profiles.length === 0) {
      return ok({ data: [], meta: { total: 0 } });
    }

    // Collect all fitment node IDs across all profiles.
    const variantIds = profiles.map((p) => p.fitmentVariantId).filter(Boolean) as string[];
    const itemIds = profiles.map((p) => p.fitmentItemId).filter(Boolean) as string[];
    const categoryIds = profiles.map((p) => p.fitmentCategoryId).filter(Boolean) as string[];

    // Year ranges: find which profiles have a year and collect range filters.
    const yearFilters = profiles.filter((p) => typeof p.year === 'number').map((p) => p.year!);

    const fitmentWhere: Record<string, unknown> = {
      tenantId: ctx.tenantId,
      OR: [
        ...(variantIds.length > 0 ? [{ variantId: { in: variantIds } }] : []),
        ...(itemIds.length > 0 ? [{ itemId: { in: itemIds } }] : []),
        ...(categoryIds.length > 0 ? [{ categoryId: { in: categoryIds } }] : []),
      ],
    };

    // If all profiles have a year, add an AND-of-OR year range filter.
    if (yearFilters.length > 0) {
      fitmentWhere.OR = [
        ...((fitmentWhere.OR as unknown[]) ?? []),
        // Products with no range set (rangeMin IS NULL) match any year.
        { rangeMin: null },
      ];
    }

    // Find distinct productIds matching the fitment criteria.
    const fitmentRows = await withTenant(ctx, (tx) =>
      tx.productFitment.findMany({
        where: fitmentWhere,
        select: { productId: true },
        distinct: ['productId'],
      })
    );

    const productIds = fitmentRows.map((r) => r.productId);

    if (productIds.length === 0) {
      return ok({ data: [], meta: { total: 0 } });
    }

    const [products, total] = await withTenant(ctx, (tx) =>
      Promise.all([
        tx.product.findMany({
          where: { id: { in: productIds }, tenantId: ctx.tenantId, deletedAt: null },
          include: {
            variants: {
              where: { deletedAt: null },
              select: { id: true, sku: true, priceCents: true, title: true },
              take: 1,
            },
          },
          orderBy: { title: 'asc' },
          take: q.take,
          skip: q.skip,
        }),
        tx.product.count({
          where: { id: { in: productIds }, tenantId: ctx.tenantId, deletedAt: null },
        }),
      ])
    );

    return ok({ data: products, meta: { total, take: q.take, skip: q.skip } });
  });

  // ─── Account-level product overrides ─────────────────────────────────────

  app.get('/v1/b2b/accounts/:id/overrides', async (request) => {
    requireRole(request, 'viewer');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id: accountId } = PathId.parse(request.params);

    const account = await withTenant(ctx, (tx) =>
      tx.b2BAccount.findFirst({ where: { id: accountId, tenantId: ctx.tenantId, deletedAt: null } })
    );
    if (!account) throw notFound('b2b account');

    const overrides = await withTenant(ctx, (tx) =>
      tx.b2bAccountProductOverride.findMany({
        where: { accountId, tenantId: ctx.tenantId },
        orderBy: { createdAt: 'asc' },
        include: {
          variant: { select: { id: true, sku: true, title: true } },
          collection: { select: { id: true, title: true } },
        },
      })
    );

    return ok(overrides);
  });

  app.post('/v1/b2b/accounts/:id/overrides', async (request, reply) => {
    requireRole(request, 'editor');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id: accountId } = PathId.parse(request.params);
    const body = OverrideBody.parse(request.body);

    const account = await withTenant(ctx, (tx) =>
      tx.b2BAccount.findFirst({ where: { id: accountId, tenantId: ctx.tenantId, deletedAt: null } })
    );
    if (!account) throw notFound('b2b account');

    const override = await withTenant(ctx, (tx) =>
      tx.b2bAccountProductOverride.create({
        data: {
          tenantId: ctx.tenantId,
          accountId,
          variantId: body.variantId,
          collectionId: body.collectionId,
          priceCents: body.priceCents,
          discountPercentage: body.discountPercentage,
          notes: body.notes,
        },
        include: {
          variant: { select: { id: true, sku: true, title: true } },
          collection: { select: { id: true, title: true } },
        },
      })
    );

    reply.code(201);
    return ok(override);
  });

  app.patch('/v1/b2b/accounts/:id/overrides/:oid', async (request) => {
    requireRole(request, 'editor');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id: accountId, oid } = PathIdOid.parse(request.params);
    const body = OverrideBody.partial().parse(request.body);

    const existing = await withTenant(ctx, (tx) =>
      tx.b2bAccountProductOverride.findFirst({
        where: { id: oid, accountId, tenantId: ctx.tenantId },
      })
    );
    if (!existing) throw notFound('override');

    const updated = await withTenant(ctx, (tx) =>
      tx.b2bAccountProductOverride.update({
        where: { id: oid },
        data: { ...body, updatedAt: new Date() },
        include: {
          variant: { select: { id: true, sku: true, title: true } },
          collection: { select: { id: true, title: true } },
        },
      })
    );
    return ok(updated);
  });

  app.delete('/v1/b2b/accounts/:id/overrides/:oid', async (request, reply) => {
    requireRole(request, 'editor');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id: accountId, oid } = PathIdOid.parse(request.params);

    const existing = await withTenant(ctx, (tx) =>
      tx.b2bAccountProductOverride.findFirst({
        where: { id: oid, accountId, tenantId: ctx.tenantId },
      })
    );
    if (!existing) throw notFound('override');

    await withTenant(ctx, (tx) => tx.b2bAccountProductOverride.delete({ where: { id: oid } }));
    reply.code(204);
  });

  return Promise.resolve();
};

export default b2bAccountRoutes;
