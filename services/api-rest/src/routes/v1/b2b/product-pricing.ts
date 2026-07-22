// B2B pricing, seen through ONE product.
//
//   GET /v1/b2b/product-pricing?product_id=<uuid>
//
// Why this exists rather than the client stitching it together: what a trade
// customer pays for a product is decided by FOUR separate resources, and every
// one of them is currently addressable only by the thing it hangs off —
// overrides by tier, overrides by account, contract prices by account. Asking
// "what does this product cost my trade customers" from those endpoints means a
// request per tier plus a request per account, which on a business with thirty
// accounts is thirty round trips to render one panel. So the join happens here,
// once, keyed on the product.
//
// It is READ-ONLY on purpose. Every write already has a home on the resource
// that owns it (POST/DELETE /v1/b2b/pricing-tiers/:id/overrides, the account
// equivalents, /v1/commerce/contract-prices), and duplicating those verbs under
// a product path would give two spellings for one write — which is how a cache
// ends up stale in exactly one surface.
//
// The waterfall the numbers below describe is resolve_b2b_price()'s: an
// account-level override beats a contract price beats a tier override beats the
// tier's blanket discount beats list. This endpoint reports every RULE that
// touches the product; `GET /v1/b2b/resolve-price` answers what one account
// actually pays for one variant.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant } from '@sparx/db';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { notFound } from '@sparx/api-core/errors';
import { requireB2bModule, toB2bContext } from '../../../lib/b2b-context.js';

const ProductQuery = z.object({ product_id: z.string().uuid() });

/** Prisma Decimal → number. A percentage arrives as a Decimal and would
 *  otherwise serialize as an object the client has to know how to unwrap. */
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

const b2bProductPricingRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/b2b/product-pricing', async (request) => {
    requireRole(request, 'viewer');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { product_id: productId } = ProductQuery.parse(request.query);

    const result = await withTenant(ctx, async (tx) => {
      // The product gates everything else: a 404 here has to be distinguishable
      // from "this product has no trade pricing", which is the overwhelmingly
      // common and entirely fine case.
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

      // A product with no variants cannot carry any of the three variant-grain
      // rules, and `{ in: [] }` would still cost three queries to prove it.
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

    return ok({
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
        // `all` means this tier's blanket discount applies to THIS product
        // without anybody having listed it — which is the difference between a
        // panel that says "nothing set up" and one that says "trade customers
        // already pay 15% less than list here".
        productScope: t.productScope,
        minOrderCents: t.minOrderCents,
        accountCount: t._count.accounts,
      })),
      tierOverrides: result.tierOverrides.map((o) => ({
        id: o.id,
        tierId: o.tierId,
        // A soft-deleted tier keeps its overrides in the table but resolves to
        // list price, so the row is reported with the fact that makes it inert
        // rather than as a live rule.
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
        // Computed here rather than in the browser: "is this agreement in
        // force" depends on the clock, and a client whose clock is a day out
        // must not be the thing that decides a contract has expired.
        active: c.validFrom.getTime() <= now && (c.validTo === null || c.validTo.getTime() > now),
        notes: c.notes,
      })),
    });
  });

  return Promise.resolve();
};

export default b2bProductPricingRoutes;
