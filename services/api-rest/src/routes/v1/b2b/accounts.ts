// B2B accounts — B2B-module-enriched view of the CRM's b2b_accounts spine.
//
// These routes add pricing tier assignment, account-level product overrides,
// fleet management (a generalized fitment selection per vehicle: a domain node +
// a value per range dimension), and the credit/status data that CRM's
// /v1/crm/b2b-accounts already returns.
//
//   GET    /v1/b2b/accounts                          → list (with tier/credit info)
//   GET    /v1/b2b/accounts/:id                      → fetch one (enriched)
//   PATCH  /v1/b2b/accounts/:id                      → update B2B fields (tier, credit, notes)
//   PUT    /v1/b2b/accounts/:id/fleet                  → replace fleet vehicle array
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

// A fleet vehicle entry. Generalized fitment: a vehicle identifies a node in the
// domain's tree (`nodeId`, the deepest level the account operates — e.g. the
// 6.7L Power Stroke) plus a numeric value per `range` dimension (`rangeValues`,
// e.g. Year 2020). `nodeId` null = the whole domain. Compatible-products queries
// match by node ancestry + range windows (mirrors fitmentService.lookup).
const FleetVehicleEntry = z.object({
  label: z.string().min(1).max(127), // "Truck #14", "Service Van A"
  vin: z
    .string()
    .length(17)
    .regex(/^[A-HJ-NPR-Z0-9]{17}$/, 'VIN excludes I, O, Q and is 17 chars')
    .optional(),
  domainId: z.string().uuid(),
  nodeId: z.string().uuid().nullish(),
  rangeValues: z
    .array(z.object({ dimensionKey: z.string().min(1), value: z.number() }))
    .max(16)
    .optional(),
  mileage: z.number().int().nonnegative().optional(),
  notes: z.string().max(2000).optional(),
  count: z.number().int().min(1).default(1),
});

const FleetVehiclesBody = z.object({
  vehicles: z.array(FleetVehicleEntry).max(100),
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

// One stored fleet vehicle (the JSONB shape persisted on engineProfiles).
interface StoredFleetVehicle {
  label?: string;
  vin?: string;
  domainId?: string;
  nodeId?: string | null;
  rangeValues?: { dimensionKey: string; value: number }[];
  mileage?: number;
  notes?: string;
  count?: number;
}

function readFleet(value: unknown): StoredFleetVehicle[] {
  return Array.isArray(value) ? (value as StoredFleetVehicle[]) : [];
}

// A fitment dimension as stored on a domain's `dimensions` JSONB.
interface StoredDimension {
  key: string;
  label: string;
  kind: 'level' | 'range';
  unit?: string;
}

// Resolved fleet vehicle for display — the node path (root → self) + the range
// values rendered with their dimension label and unit.
interface FleetVehicleView extends StoredFleetVehicle {
  domainName: string | null;
  nodeName: string | null;
  nodePath: string[];
  ranges: { dimensionKey: string; label: string; unit: string | null; value: number }[];
}

/**
 * Enrich stored fleet vehicles with display data (domain name, node path, and a
 * labelled range list) by reading the referenced domains' `dimensions` and the
 * referenced nodes' `name`/`pathNames` — generic over any domain's dimensions,
 * no hardcoded make/model/engine/year vocabulary.
 */
async function resolveFleetVehicles(
  ctx: { tenantId: string },
  vehicles: StoredFleetVehicle[]
): Promise<FleetVehicleView[]> {
  const domainIds = [...new Set(vehicles.map((v) => v.domainId).filter(Boolean) as string[])];
  const nodeIds = [...new Set(vehicles.map((v) => v.nodeId).filter(Boolean) as string[])];

  const [domains, nodes] = await withTenant(ctx, (tx) =>
    Promise.all([
      domainIds.length > 0
        ? tx.fitmentDomain.findMany({
            where: { id: { in: domainIds }, deletedAt: null },
            select: { id: true, displayName: true, dimensions: true },
          })
        : Promise.resolve([]),
      nodeIds.length > 0
        ? tx.fitmentNode.findMany({
            where: { id: { in: nodeIds }, deletedAt: null },
            select: { id: true, name: true, pathNames: true },
          })
        : Promise.resolve([]),
    ])
  );

  const domainById = new Map(domains.map((d) => [d.id, d]));
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  return vehicles.map((v) => {
    const domain = v.domainId ? domainById.get(v.domainId) : undefined;
    const dims: StoredDimension[] = Array.isArray(domain?.dimensions)
      ? (domain.dimensions as unknown as StoredDimension[])
      : [];
    const dimByKey = new Map(dims.map((d) => [d.key, d]));
    const node = v.nodeId ? nodeById.get(v.nodeId) : undefined;
    return {
      ...v,
      domainName: domain?.displayName ?? null,
      nodeName: node?.name ?? null,
      nodePath: node?.pathNames ?? [],
      ranges: (v.rangeValues ?? []).map((rv) => {
        const dim = dimByKey.get(rv.dimensionKey);
        return {
          dimensionKey: rv.dimensionKey,
          label: dim?.label ?? rv.dimensionKey,
          unit: dim?.unit ?? null,
          value: rv.value,
        };
      }),
    };
  });
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
    const fleetVehicles = await resolveFleetVehicles(ctx, readFleet(account.engineProfiles));
    return ok({
      ...toAccountView(account),
      fleetVehicles,
      overrideCount: account._count.productOverrides,
    });
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

  // ─── Fleet vehicles ──────────────────────────────────────────────────────
  // The fleet is stored as a JSONB array on engine_profiles; each entry is a
  // generalized fitment selection (a domain + the deepest node + a value per
  // range dimension), not an automotive-specific make/model/engine triple.

  app.put('/v1/b2b/accounts/:id/fleet', async (request) => {
    requireRole(request, 'editor');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);
    const body = FleetVehiclesBody.parse(request.body);

    const account = await withTenant(ctx, (tx) =>
      tx.b2BAccount.findFirst({ where: { id, tenantId: ctx.tenantId, deletedAt: null } })
    );
    if (!account) throw notFound('b2b account');

    // Validate every referenced domain + node belongs to this tenant so a fleet
    // can't pin to another tenant's fitment tree (RLS is the backstop, this is
    // the friendly error).
    const domainIds = [...new Set(body.vehicles.map((v) => v.domainId))];
    const nodeIds = [...new Set(body.vehicles.map((v) => v.nodeId).filter(Boolean) as string[])];
    const [domains, nodes] = await withTenant(ctx, (tx) =>
      Promise.all([
        tx.fitmentDomain.findMany({
          where: { id: { in: domainIds }, deletedAt: null },
          select: { id: true },
        }),
        nodeIds.length > 0
          ? tx.fitmentNode.findMany({
              where: { id: { in: nodeIds }, deletedAt: null },
              select: { id: true, domainId: true },
            })
          : Promise.resolve([]),
      ])
    );
    const knownDomains = new Set(domains.map((d) => d.id));
    const nodeDomain = new Map(nodes.map((n) => [n.id, n.domainId]));
    for (const v of body.vehicles) {
      if (!knownDomains.has(v.domainId)) throw notFound('fitment domain');
      if (v.nodeId && nodeDomain.get(v.nodeId) !== v.domainId) throw notFound('fitment node');
    }

    const updated = await withTenant(ctx, (tx) =>
      tx.b2BAccount.update({
        where: { id },
        data: {
          engineProfiles: body.vehicles,
          ...(body.fleetSize !== undefined ? { fleetSize: body.fleetSize } : {}),
          updatedAt: new Date(),
        },
        select: { id: true, engineProfiles: true, fleetSize: true },
      })
    );

    const fleetVehicles = await resolveFleetVehicles(ctx, readFleet(updated.engineProfiles));
    return ok({ id: updated.id, fleetSize: updated.fleetSize, fleetVehicles });
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

    const vehicles = readFleet(account.engineProfiles);
    if (vehicles.length === 0) {
      return ok({ data: [], meta: { total: 0 } });
    }

    // Resolve each vehicle's node ancestry once (path = ancestor ids incl. self,
    // root → self), so a make-level fitment rule still matches an engine-level
    // fleet vehicle (universal-to-specific).
    const fleetNodeIds = [...new Set(vehicles.map((v) => v.nodeId).filter(Boolean) as string[])];
    const fleetNodes =
      fleetNodeIds.length > 0
        ? await withTenant(ctx, (tx) =>
            tx.fitmentNode.findMany({
              where: { id: { in: fleetNodeIds }, deletedAt: null },
              select: { id: true, path: true },
            })
          )
        : [];
    const pathByNodeId = new Map(fleetNodes.map((n) => [n.id, n.path]));

    // One OR-clause per vehicle: scope to its domain, match the node chain (or a
    // whole-domain rule), and narrow by each range value (a rule with no window
    // on an axis matches any value; otherwise [min, max] must contain it). This
    // mirrors fitmentService.lookup so the fleet sees exactly what a storefront
    // drill to the same node would surface.
    const vehicleClauses = vehicles
      .filter((v) => v.domainId)
      .map((v) => {
        const ancestorIds = v.nodeId ? (pathByNodeId.get(v.nodeId) ?? [v.nodeId]) : null;
        const rangeMatches = (v.rangeValues ?? []).map((rv) => ({
          OR: [
            { ranges: { none: { dimensionKey: rv.dimensionKey } } },
            {
              ranges: {
                some: {
                  dimensionKey: rv.dimensionKey,
                  AND: [
                    { OR: [{ min: { lte: rv.value } }, { min: null }] },
                    { OR: [{ max: { gte: rv.value } }, { max: null }] },
                  ],
                },
              },
            },
          ],
        }));
        return {
          domainId: v.domainId,
          ...(ancestorIds ? { OR: [{ nodeId: { in: ancestorIds } }, { nodeId: null }] } : {}),
          ...(rangeMatches.length > 0 ? { AND: rangeMatches } : {}),
        };
      });

    if (vehicleClauses.length === 0) {
      return ok({ data: [], meta: { total: 0 } });
    }

    // Find distinct productIds matching ANY fleet vehicle.
    const fitmentRows = await withTenant(ctx, (tx) =>
      tx.productFitment.findMany({
        where: { OR: vehicleClauses, product: { deletedAt: null } },
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
          collection: { select: { id: true, name: true } },
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
          collection: { select: { id: true, name: true } },
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
          collection: { select: { id: true, name: true } },
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
