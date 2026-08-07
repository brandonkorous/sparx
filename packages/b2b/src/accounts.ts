// B2B-module-enriched view of the CRM b2b_accounts spine: trade config (validated
// pricing-tier FK, credit limit, terms, status), the account's fleet (a JSONB
// array of generalized fitment selections), per-account product overrides, and the
// fleet-filtered compatible-products read. Extracted from the api-rest routes.
//
// Boundary with CRM: @sparx/crm's b2bAccountService owns the account RECORD
// (companyName, taxId, assigned rep, the free-text `pricingTier` label). These
// functions own the B2B MODULE's enrichments — chiefly the validated `pricingTierId`
// FK (CRM only sets the label string) and the override / fleet tables.

import { z } from 'zod';
import { withTenant } from '@sparx/db';
import { notFound } from '@sparx/api-core/errors';
// A trade account IS the CRM's company row, so its tenant-declared properties go
// through the CRM's single write path rather than a second one here (docs/144
// §3). `@sparx/b2b` already depends on `@sparx/crm`, and crm does not depend
// back, so this adds no cycle.
import { asBag, objectDefService, resolvePropertyBag, toJsonInput } from '@sparx/crm';
import type { B2bContext } from './context.js';

// ── Schemas ──────────────────────────────────────────────────────────────────

export const AccountListQuery = z.object({
  status: z.enum(['active', 'credit_hold', 'suspended', 'inactive']).optional(),
  tier_id: z.string().uuid().optional(),
  overdue: z.coerce.boolean().optional(),
  q: z.string().max(255).optional(),
  take: z.coerce.number().int().min(1).max(250).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

export const AccountPatchBody = z.object({
  pricingTierId: z.string().uuid().nullable().optional(),
  creditLimitCents: z.number().int().min(0).optional(),
  paymentTerms: z.enum(['prepay', 'net30', 'net60', 'net90']).nullable().optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  status: z.enum(['active', 'credit_hold', 'suspended', 'inactive']).optional(),
  internalNotes: z.string().max(5000).nullable().optional(),
  fleetSize: z.number().int().min(0).nullable().optional(),
  // The extra details this business tracks on a company (docs/144 §3). A trade
  // account IS the CRM's company, so the same declared properties have to be
  // writable from the wholesale pane — otherwise the same record answers
  // differently depending on which door you came in through. NO `.default({})`:
  // a default survives `.partial()` and would fabricate an empty bag on every
  // patch, wiping properties the caller never mentioned.
  customProperties: z.record(z.string(), z.unknown()).optional(),
});

export const AccountOverrideBody = z
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

export const AccountOverridePatchBody = z
  .object({
    variantId: z.string().uuid().optional(),
    collectionId: z.string().uuid().optional(),
    priceCents: z.number().int().min(0).optional(),
    discountPercentage: z.number().min(0).max(100).optional(),
    notes: z.string().max(1000).optional(),
  })
  .partial();

// A fleet vehicle entry. Generalized fitment: a vehicle identifies a node in the
// domain's tree (`nodeId`, the deepest level the account operates) plus a numeric
// value per `range` dimension (`rangeValues`). `nodeId` null = the whole domain.
export const FleetVehicleEntry = z.object({
  label: z.string().min(1).max(127),
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

export const FleetVehiclesBody = z.object({
  vehicles: z.array(FleetVehicleEntry).max(100),
  fleetSize: z.number().int().min(0).optional(),
});

export const CompatibleProductsQuery = z.object({
  take: z.coerce.number().int().min(1).max(250).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

export type AccountListInput = z.infer<typeof AccountListQuery>;
export type AccountPatchInput = z.infer<typeof AccountPatchBody>;
export type AccountOverrideInput = z.infer<typeof AccountOverrideBody>;
export type AccountOverridePatchInput = z.infer<typeof AccountOverridePatchBody>;
export type FleetVehiclesInput = z.infer<typeof FleetVehiclesBody>;

// ── View mappers ──────────────────────────────────────────────────────────────

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
  customProperties?: unknown;
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
    customProperties: asBag(a.customProperties),
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

export type AccountView = ReturnType<typeof toAccountView>;

const PRICING_TIER_FK_SELECT = {
  pricingTierFk: { select: { id: true, name: true, discountType: true, discountValue: true } },
} as const;

const ACCOUNT_OVERRIDE_INCLUDE = {
  variant: { select: { id: true, sku: true, title: true } },
  collection: { select: { id: true, name: true } },
} as const;

// ── Fleet (JSONB on engine_profiles) helpers ──────────────────────────────────

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

interface StoredDimension {
  key: string;
  label: string;
  kind: 'level' | 'range';
  unit?: string;
}

interface FleetVehicleView extends StoredFleetVehicle {
  domainName: string | null;
  nodeName: string | null;
  nodePath: string[];
  ranges: { dimensionKey: string; label: string; unit: string | null; value: number }[];
}

/** Enrich stored fleet vehicles with display data (domain name, node path, and a
 *  labelled range list) by reading the referenced domains' `dimensions` and the
 *  referenced nodes' names — generic over any domain's dimensions. */
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

// ── Accounts ────────────────────────────────────────────────────────────────

export async function listAccounts(
  ctx: B2bContext,
  input: AccountListInput
): Promise<{ items: AccountView[]; total: number; take: number }> {
  const where: Record<string, unknown> = { tenantId: ctx.tenantId, deletedAt: null };
  if (input.status) where.status = input.status;
  if (input.tier_id) where.pricingTierId = input.tier_id;
  if (input.q) {
    where.OR = [
      { companyName: { contains: input.q, mode: 'insensitive' } },
      { taxId: { contains: input.q, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    withTenant(ctx, (tx) =>
      tx.b2BAccount.findMany({
        where,
        take: input.take,
        skip: input.skip,
        orderBy: { companyName: 'asc' },
        include: PRICING_TIER_FK_SELECT,
      })
    ),
    withTenant(ctx, (tx) => tx.b2BAccount.count({ where })),
  ]);

  return { items: items.map(toAccountView), total, take: input.take };
}

export async function getAccount(ctx: B2bContext, id: string) {
  const account = await withTenant(ctx, (tx) =>
    tx.b2BAccount.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
      include: {
        ...PRICING_TIER_FK_SELECT,
        _count: { select: { productOverrides: true } },
      },
    })
  );
  if (!account) throw notFound('b2b account');
  const fleetVehicles = await resolveFleetVehicles(ctx, readFleet(account.engineProfiles));
  return {
    ...toAccountView(account),
    fleetVehicles,
    overrideCount: account._count.productOverrides,
  };
}

/** Update the B2B-module trade config on an account: the validated pricing-tier FK
 *  (CRM only sets the free-text label), credit limit, terms, discount, status,
 *  internal notes, fleet size. */
export async function updateTradeConfig(
  ctx: B2bContext,
  id: string,
  rawInput: unknown
): Promise<AccountView> {
  const body = AccountPatchBody.parse(rawInput);

  const existing = await withTenant(ctx, (tx) =>
    tx.b2BAccount.findFirst({ where: { id, tenantId: ctx.tenantId, deletedAt: null } })
  );
  if (!existing) throw notFound('b2b account');

  // A new tier must belong to this tenant (RLS is the backstop; this is the
  // friendly 404).
  if (body.pricingTierId) {
    const tier = await withTenant(ctx, (tx) =>
      tx.b2bPricingTier.findFirst({
        where: { id: body.pricingTierId!, tenantId: ctx.tenantId, deletedAt: null },
      })
    );
    if (!tier) throw notFound('pricing tier');
  }

  const updated = await withTenant(ctx, async (tx) => {
    // ONE write path for declared properties, shared with the CRM's own company
    // pane: validate against the tenant's schema, recompute calculated fields,
    // then merge onto what is stored. `undefined` when the patch says nothing
    // about them, which leaves the stored bag untouched.
    const customProperties = resolvePropertyBag({
      schema: await objectDefService.schemaFor(ctx, 'company', tx),
      existing: existing.customProperties,
      incoming: body.customProperties,
    });

    return tx.b2BAccount.update({
      where: { id },
      data: {
        pricingTierId: body.pricingTierId,
        // creditLimit is a Decimal (dollars) in the CRM schema; cents → decimal.
        ...(body.creditLimitCents !== undefined
          ? { creditLimit: (body.creditLimitCents / 100).toFixed(2) }
          : {}),
        paymentTerms: body.paymentTerms,
        discountPercent: body.discountPercent,
        status: body.status,
        notes: body.internalNotes,
        fleetSize: body.fleetSize,
        ...(customProperties !== undefined
          ? { customProperties: toJsonInput(customProperties) }
          : {}),
        updatedAt: new Date(),
      },
      include: PRICING_TIER_FK_SELECT,
    });
  });
  return toAccountView(updated);
}

/** Replace the account's fleet. Each vehicle is validated to reference a fitment
 *  domain (and, if given, a node under that domain) belonging to this tenant. */
export async function setFleet(ctx: B2bContext, id: string, rawInput: unknown) {
  const body = FleetVehiclesBody.parse(rawInput);

  const account = await withTenant(ctx, (tx) =>
    tx.b2BAccount.findFirst({ where: { id, tenantId: ctx.tenantId, deletedAt: null } })
  );
  if (!account) throw notFound('b2b account');

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
  return { id: updated.id, fleetSize: updated.fleetSize, fleetVehicles };
}

/** Catalog filtered to what the account's fleet is compatible with (node-ancestry
 *  + range-window match, mirroring fitmentService.lookup). */
export async function listCompatibleProducts(
  ctx: B2bContext,
  id: string,
  input: z.infer<typeof CompatibleProductsQuery>
) {
  const account = await withTenant(ctx, (tx) =>
    tx.b2BAccount.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true, engineProfiles: true },
    })
  );
  if (!account) throw notFound('b2b account');

  const vehicles = readFleet(account.engineProfiles);
  if (vehicles.length === 0) return { data: [], meta: { total: 0 } };

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

  if (vehicleClauses.length === 0) return { data: [], meta: { total: 0 } };

  const fitmentRows = await withTenant(ctx, (tx) =>
    tx.productFitment.findMany({
      where: { OR: vehicleClauses, product: { deletedAt: null } },
      select: { productId: true },
      distinct: ['productId'],
    })
  );
  const productIds = fitmentRows.map((r) => r.productId);
  if (productIds.length === 0) return { data: [], meta: { total: 0 } };

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
        take: input.take,
        skip: input.skip,
      }),
      tx.product.count({
        where: { id: { in: productIds }, tenantId: ctx.tenantId, deletedAt: null },
      }),
    ])
  );

  return { data: products, meta: { total, take: input.take, skip: input.skip } };
}

// ── Account-level product overrides ──────────────────────────────────────────

async function requireAccount(ctx: B2bContext, accountId: string): Promise<void> {
  const account = await withTenant(ctx, (tx) =>
    tx.b2BAccount.findFirst({ where: { id: accountId, tenantId: ctx.tenantId, deletedAt: null } })
  );
  if (!account) throw notFound('b2b account');
}

export async function listAccountOverrides(ctx: B2bContext, accountId: string) {
  await requireAccount(ctx, accountId);
  return withTenant(ctx, (tx) =>
    tx.b2bAccountProductOverride.findMany({
      where: { accountId, tenantId: ctx.tenantId },
      orderBy: { createdAt: 'asc' },
      include: ACCOUNT_OVERRIDE_INCLUDE,
    })
  );
}

export async function addAccountOverride(ctx: B2bContext, accountId: string, rawInput: unknown) {
  const body = AccountOverrideBody.parse(rawInput);
  await requireAccount(ctx, accountId);

  return withTenant(ctx, (tx) =>
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
      include: ACCOUNT_OVERRIDE_INCLUDE,
    })
  );
}

export async function updateAccountOverride(
  ctx: B2bContext,
  accountId: string,
  oid: string,
  rawInput: unknown
) {
  const body = AccountOverridePatchBody.parse(rawInput);
  const existing = await withTenant(ctx, (tx) =>
    tx.b2bAccountProductOverride.findFirst({
      where: { id: oid, accountId, tenantId: ctx.tenantId },
    })
  );
  if (!existing) throw notFound('override');

  return withTenant(ctx, (tx) =>
    tx.b2bAccountProductOverride.update({
      where: { id: oid },
      data: { ...body, updatedAt: new Date() },
      include: ACCOUNT_OVERRIDE_INCLUDE,
    })
  );
}

export async function removeAccountOverride(
  ctx: B2bContext,
  accountId: string,
  oid: string
): Promise<void> {
  const existing = await withTenant(ctx, (tx) =>
    tx.b2bAccountProductOverride.findFirst({
      where: { id: oid, accountId, tenantId: ctx.tenantId },
    })
  );
  if (!existing) throw notFound('override');
  await withTenant(ctx, (tx) => tx.b2bAccountProductOverride.delete({ where: { id: oid } }));
}
