// B2B pricing tiers + per-tier product/collection overrides, plus the two price-
// resolution reads (one account × one variant, and one product's whole trade
// pricing picture). Extracted verbatim from the api-rest routes so REST and MCP
// drive the same implementation.
//
// A tier is a named trade discount (percentage or fixed) assigned to accounts; an
// override pins a specific variant/collection to a price or a deeper discount for
// that tier. Soft-delete keeps a tier's FK on its accounts but hides it from the
// list and resolves it to list price.

import { z } from 'zod';
import { prisma, withTenant, type Prisma } from '@sparx/db';
import { notFound } from '@sparx/api-core/errors';
import type { B2bContext } from './context.js';

// ── Schemas (shared with the REST routes — one source of truth) ───────────────

export const ListTiersQuery = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

export const TierBody = z.object({
  name: z.string().min(1).max(127),
  description: z.string().max(2000).optional(),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().min(0),
  productScope: z.enum(['all', 'collections', 'products']).default('all'),
  minOrderCents: z.number().int().min(0).default(0),
});

export const TierPatchBody = TierBody.partial();

export const TierOverrideBody = z
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

export const TierOverridePatchBody = z
  .object({
    variantId: z.string().uuid().optional(),
    collectionId: z.string().uuid().optional(),
    priceCents: z.number().int().min(0).optional(),
    discountPercentage: z.number().min(0).max(100).optional(),
    notes: z.string().max(1000).optional(),
  })
  .partial();

export type ListTiersInput = z.infer<typeof ListTiersQuery>;
export type TierInput = z.infer<typeof TierBody>;
export type TierPatchInput = z.infer<typeof TierPatchBody>;
export type TierOverrideInput = z.infer<typeof TierOverrideBody>;
export type TierOverridePatchInput = z.infer<typeof TierOverridePatchBody>;

// ── View mappers ──────────────────────────────────────────────────────────────

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

export type TierView = ReturnType<typeof toTierView>;

const TIER_COUNT_INCLUDE = { _count: { select: { accounts: true } } } as const;

// `name`, NOT `title` — ProductCollection has no `title` column, and an invalid
// select throws at runtime. The account-override include next door matches.
const OVERRIDE_INCLUDE = {
  variant: { select: { id: true, sku: true, title: true } },
  collection: { select: { id: true, name: true } },
} as const;

// ── Tiers ──────────────────────────────────────────────────────────────────────

export async function listTiers(
  ctx: B2bContext,
  input: ListTiersInput
): Promise<{ items: TierView[]; total: number; take: number }> {
  const take = Math.min(input.take ?? 50, 250);
  const skip = input.skip ?? 0;

  const where: Prisma.B2bPricingTierWhereInput = {
    tenantId: ctx.tenantId,
    deletedAt: null,
    ...(input.q
      ? {
          OR: [
            { name: { contains: input.q, mode: 'insensitive' } },
            { description: { contains: input.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const { tiers, total } = await withTenant(ctx, async (tx) => {
    const [tiers, total] = await Promise.all([
      tx.b2bPricingTier.findMany({
        where,
        orderBy: { name: 'asc' },
        include: TIER_COUNT_INCLUDE,
        take,
        skip,
      }),
      tx.b2bPricingTier.count({ where }),
    ]);
    return { tiers, total };
  });

  return { items: tiers.map(toTierView), total, take: input.take ?? 50 };
}

export async function getTier(ctx: B2bContext, id: string): Promise<TierView> {
  const tier = await withTenant(ctx, (tx) =>
    tx.b2bPricingTier.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
      include: TIER_COUNT_INCLUDE,
    })
  );
  if (!tier) throw notFound('pricing tier');
  return toTierView(tier);
}

export async function createTier(ctx: B2bContext, rawInput: unknown): Promise<TierView> {
  const body = TierBody.parse(rawInput);
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
      include: TIER_COUNT_INCLUDE,
    })
  );
  return toTierView(tier);
}

export async function updateTier(
  ctx: B2bContext,
  id: string,
  rawInput: unknown
): Promise<TierView> {
  const body = TierPatchBody.parse(rawInput);

  const existing = await withTenant(ctx, (tx) =>
    tx.b2bPricingTier.findFirst({ where: { id, tenantId: ctx.tenantId, deletedAt: null } })
  );
  if (!existing) throw notFound('pricing tier');

  const updated = await withTenant(ctx, (tx) =>
    tx.b2bPricingTier.update({
      where: { id },
      data: { ...body, updatedAt: new Date() },
      include: TIER_COUNT_INCLUDE,
    })
  );
  return toTierView(updated);
}

export async function deleteTier(ctx: B2bContext, id: string): Promise<void> {
  const existing = await withTenant(ctx, (tx) =>
    tx.b2bPricingTier.findFirst({ where: { id, tenantId: ctx.tenantId, deletedAt: null } })
  );
  if (!existing) throw notFound('pricing tier');

  // Soft-delete. Accounts retain their pricing_tier_id FK but the tier is hidden
  // from the list; the resolver returns list price for soft-deleted tiers.
  await withTenant(ctx, (tx) =>
    tx.b2bPricingTier.update({ where: { id }, data: { deletedAt: new Date() } })
  );
}

// ── Tier overrides ───────────────────────────────────────────────────────────

async function requireTier(ctx: B2bContext, tierId: string): Promise<void> {
  const tier = await withTenant(ctx, (tx) =>
    tx.b2bPricingTier.findFirst({ where: { id: tierId, tenantId: ctx.tenantId, deletedAt: null } })
  );
  if (!tier) throw notFound('pricing tier');
}

export async function listTierOverrides(ctx: B2bContext, tierId: string) {
  await requireTier(ctx, tierId);
  return withTenant(ctx, (tx) =>
    tx.b2bTierProductOverride.findMany({
      where: { tierId, tenantId: ctx.tenantId },
      orderBy: { createdAt: 'asc' },
      include: OVERRIDE_INCLUDE,
    })
  );
}

export async function addTierOverride(ctx: B2bContext, tierId: string, rawInput: unknown) {
  const body = TierOverrideBody.parse(rawInput);
  await requireTier(ctx, tierId);

  return withTenant(ctx, (tx) =>
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
      include: OVERRIDE_INCLUDE,
    })
  );
}

export async function updateTierOverride(
  ctx: B2bContext,
  tierId: string,
  oid: string,
  rawInput: unknown
) {
  const body = TierOverridePatchBody.parse(rawInput);
  const existing = await withTenant(ctx, (tx) =>
    tx.b2bTierProductOverride.findFirst({ where: { id: oid, tierId, tenantId: ctx.tenantId } })
  );
  if (!existing) throw notFound('override');

  return withTenant(ctx, (tx) =>
    tx.b2bTierProductOverride.update({
      where: { id: oid },
      data: { ...body, updatedAt: new Date() },
      include: OVERRIDE_INCLUDE,
    })
  );
}

export async function removeTierOverride(
  ctx: B2bContext,
  tierId: string,
  oid: string
): Promise<void> {
  const existing = await withTenant(ctx, (tx) =>
    tx.b2bTierProductOverride.findFirst({ where: { id: oid, tierId, tenantId: ctx.tenantId } })
  );
  if (!existing) throw notFound('override');
  await withTenant(ctx, (tx) => tx.b2bTierProductOverride.delete({ where: { id: oid } }));
}

// ── Price resolution reads ───────────────────────────────────────────────────

/** The effective price one account pays for one variant, via the SQL waterfall
 *  `resolve_b2b_price()` (account override → contract price → tier override →
 *  tier blanket discount → list). */
export async function resolveB2bPrice(
  ctx: B2bContext,
  input: { variantId: string; accountId: string }
): Promise<{ variantId: string; accountId: string; effectivePriceCents: number | null }> {
  const result = await prisma.$queryRaw<{ resolve_b2b_price: number | null }[]>`
    SELECT resolve_b2b_price(${input.variantId}::uuid, ${input.accountId}::uuid)
  `;
  return {
    variantId: input.variantId,
    accountId: input.accountId,
    effectivePriceCents: result[0]?.resolve_b2b_price ?? null,
  };
}

/** Prisma Decimal → number, preserving null. */
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

/** Every trade-pricing RULE that touches one product — its variants, the tiers,
 *  tier overrides, account overrides, and contract prices — joined once so a
 *  pricing panel renders in a single call rather than one request per account. */
export async function getProductPricing(ctx: B2bContext, productId: string) {
  const result = await withTenant(ctx, async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: productId, tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!product) return null;

    const variants = await tx.productVariant.findMany({
      where: { productId, deletedAt: null },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        sku: true,
        title: true,
        priceCents: true,
        costCents: true,
        currency: true,
      },
    });
    const variantIds = variants.map((v) => v.id);
    const empty = variantIds.length === 0;

    const [tiers, tierOverrides, accountOverrides, contractPrices] = await Promise.all([
      tx.b2bPricingTier.findMany({
        where: { tenantId: ctx.tenantId, deletedAt: null },
        orderBy: { name: 'asc' },
        include: { _count: { select: { accounts: true } } },
      }),
      empty
        ? Promise.resolve([])
        : tx.b2bTierProductOverride.findMany({
            where: { tenantId: ctx.tenantId, variantId: { in: variantIds } },
            orderBy: { createdAt: 'asc' },
            include: { tier: { select: { id: true, name: true, deletedAt: true } } },
          }),
      empty
        ? Promise.resolve([])
        : tx.b2bAccountProductOverride.findMany({
            where: { tenantId: ctx.tenantId, variantId: { in: variantIds } },
            orderBy: { createdAt: 'asc' },
            include: { account: { select: { id: true, companyName: true, status: true } } },
          }),
      empty
        ? Promise.resolve([])
        : tx.contractPrice.findMany({
            where: { tenantId: ctx.tenantId, variantId: { in: variantIds } },
            orderBy: { validFrom: 'desc' },
            include: { b2bAccount: { select: { id: true, companyName: true } } },
          }),
    ]);

    return { variants, tiers, tierOverrides, accountOverrides, contractPrices };
  });

  if (!result) throw notFound('product', productId);

  const now = Date.now();

  return {
    variants: result.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      title: v.title,
      priceCents: v.priceCents,
      costCents: v.costCents,
      currency: v.currency,
    })),
    tiers: result.tiers.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      discountType: t.discountType,
      discountValue: toNumber(t.discountValue) ?? 0,
      productScope: t.productScope,
      minOrderCents: t.minOrderCents,
      accountCount: t._count.accounts,
    })),
    tierOverrides: result.tierOverrides.map((o) => ({
      id: o.id,
      tierId: o.tierId,
      tierName: o.tier.name,
      tierDeleted: o.tier.deletedAt !== null,
      variantId: o.variantId,
      priceCents: o.priceCents,
      discountPercentage: toNumber(o.discountPercentage),
      notes: o.notes,
    })),
    accountOverrides: result.accountOverrides.map((o) => ({
      id: o.id,
      accountId: o.accountId,
      accountName: o.account.companyName,
      accountStatus: o.account.status,
      variantId: o.variantId,
      priceCents: o.priceCents,
      discountPercentage: toNumber(o.discountPercentage),
      minOrderQty: o.minOrderQty,
      maxOrderQty: o.maxOrderQty,
      notes: o.notes,
    })),
    contractPrices: result.contractPrices.map((c) => ({
      id: c.id,
      accountId: c.b2bAccountId,
      accountName: c.b2bAccount.companyName,
      variantId: c.variantId,
      priceCents: c.priceCents,
      validFrom: c.validFrom.toISOString(),
      validTo: c.validTo?.toISOString() ?? null,
      active: c.validFrom.getTime() <= now && (c.validTo === null || c.validTo.getTime() > now),
      notes: c.notes,
    })),
  };
}
