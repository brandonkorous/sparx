// Dropshipping, seen through ONE product.
//
//   GET    /v1/dropship/product-links?product_id=<uuid>
//   PUT    /v1/dropship/product-links      → this supplier ships this product
//   DELETE /v1/dropship/product-links/:id  → they stop shipping it
//
// A dropshipped product is stitched together from three rows that nothing has
// ever joined for a product-side reader: the DropshipProductLink (which
// supplier SKU this product came from), the DropshipProduct (what the supplier
// charges us and what they say the product is), and the supplier itself (is the
// connection healthy, when did it last sync). Until now the only trace of any
// of this in a product editor was a "Priced by <supplier>" label derived from
// the variant's markup rule — which says nothing about whether the supplier is
// still connected or whether their cost has moved since import.
//
// The response also carries the product's VARIANTS with their
// `dropshipSourceId`, because a link is product-grain while sourcing is
// variant-grain: a product can be linked to a supplier while individual
// variants are sourced elsewhere or not at all, and a panel that only showed
// the link would present that as fully dropshipped.
//
// Importing is `POST /v1/dropship/suppliers/:id/catalog/:productId/import` and
// re-importing is its `reimport` sibling — both keyed on the SUPPLIER's catalog
// id, which is the right way round for the direction that operation actually runs.
//
// PUT and DELETE are the other direction, for a supplier with NO product list:
// the business's own supplier ships products the business already sells (sparx
// persona issue 171). Nothing can be imported from them, so the owner points the
// product at them and says their code for it and what they charge. That writes
// the same three rows an import does (the supplier's item, the link, the
// variants' source), so the order router, the margin on this panel and the profit
// reports read it unchanged. The variants change through the variant service,
// never a bare update: it keeps the audit trail, re-prices a markup rule bound to
// cost, and drops "send the old part first" on a part the supplier ships straight
// to the buyer.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant } from '@wizeworks/db';
import type { Prisma } from '@wizeworks/db';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { badRequest, conflict, notFound } from '@wizeworks/api-core/errors';
import { variantService } from '@wizeworks/commerce';
import { getVendor, handVersionsOf, handVersionsToStore } from '@wizeworks/dropship';
import { toCommerceContext } from '../../../lib/commerce-context.js';
import { requireDropshipModule, toDropshipContext } from '../../../lib/dropship-context.js';

const ProductQuery = z.object({ product_id: z.string().uuid() });
const LinkPath = z.object({ id: z.string().uuid() });

const LinkBody = z.object({
  product_id: z.string().uuid(),
  supplier_id: z.string().uuid(),
  supplier_sku: z.string().trim().min(1, 'Give their code for this product.').max(255),
  cost_cents: z.number().int().min(0).max(100_000_000),
  // Each version's own code and price, for a product that comes in more than
  // one (sparx persona issue 362). Without it every version takes the one above.
  versions: z
    .array(
      z.object({
        variant_id: z.string().uuid(),
        supplier_sku: z.string().trim().min(1, 'Give their code for each version.').max(255),
        cost_cents: z.number().int().min(0).max(100_000_000),
      })
    )
    .min(1)
    .optional(),
});

/** A supplier the owner points products at by hand: one with no product list
 *  to import from. Everything else is linked by importing from their list. */
function linkedByHand(type: string): boolean {
  const vendor = getVendor(type);
  return vendor !== undefined && !vendor.capabilities.catalogSync;
}

/** The product's dropshipping, as the panel reads it. Null when the product is
 *  not this tenant's or is deleted. */
async function readProductDropship(tenantId: string, productId: string) {
  const result = await withTenant({ tenantId }, async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: productId, tenantId, deletedAt: null },
      select: { id: true, metadata: true },
    });
    if (!product) return null;

    const [links, variants] = await Promise.all([
      tx.dropshipProductLink.findMany({
        where: { tenantId, productId },
        orderBy: { createdAt: 'asc' },
        include: {
          dropshipProduct: {
            select: {
              id: true,
              supplierProductId: true,
              title: true,
              costPriceCents: true,
              msrpCents: true,
              variants: true,
              importedAt: true,
              updatedAt: true,
              supplier: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                  status: true,
                  credentials: true,
                  lastSyncAt: true,
                  deletedAt: true,
                },
              },
            },
          },
        },
      }),
      tx.productVariant.findMany({
        where: { productId, deletedAt: null },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          sku: true,
          title: true,
          priceCents: true,
          costCents: true,
          currency: true,
          dropshipSourceId: true,
        },
      }),
    ]);

    return { product, links, variants };
  });
  if (!result) return null;

  // Stamped by the importer onto the product it created. Reported separately
  // from the links because the two can disagree: a link removed by hand
  // leaves the stamp behind, and a panel that trusted only the stamp would
  // claim a supplier that no longer ships anything.
  const metadata = result.product.metadata as Record<string, unknown> | null;
  const stampedSupplierId =
    metadata && typeof metadata.dropshipSupplierId === 'string'
      ? metadata.dropshipSupplierId
      : null;

  const versionCodes = new Map(
    result.links.flatMap((link) =>
      handVersionsOf(link.dropshipProduct.variants).map(
        (v) => [v.variantId, v.supplierSku] as const
      )
    )
  );

  return {
    stampedSupplierId,
    links: result.links.map((link) => {
      const source = link.dropshipProduct;
      const supplier = source.supplier;
      const byHand = linkedByHand(supplier.type);
      const credentials = (supplier.credentials as Record<string, string> | null) ?? {};
      return {
        id: link.id,
        status: link.status,
        supplierSku: link.supplierSku,
        createdAt: link.createdAt.toISOString(),
        supplier: {
          id: supplier.id,
          name: supplier.name,
          type: supplier.type,
          // A disconnected supplier is soft-deleted rather than removed, and
          // its links survive. Reporting the tombstone is what lets the panel
          // say "this product is orphaned" instead of showing a healthy-
          // looking row for a connection that no longer exists.
          status: supplier.deletedAt ? 'disconnected' : supplier.status,
          disconnected: supplier.deletedAt !== null,
          lastSyncAt: supplier.lastSyncAt?.toISOString() ?? null,
          // Whether this product came from their list (and can be pulled again)
          // or was pointed at them by hand (and is changed here instead).
          catalogSync: !byHand,
          // Where their orders go, for a supplier who takes them by email. Not a
          // secret: the owner typed it and the supplier page shows it.
          ordersTo:
            byHand && typeof credentials.orderEmail === 'string' ? credentials.orderEmail : null,
        },
        source: {
          id: source.id,
          supplierProductId: source.supplierProductId,
          title: source.title,
          costPriceCents: source.costPriceCents,
          msrpCents: source.msrpCents,
          variantCount: Array.isArray(source.variants) ? source.variants.length : 0,
          importedAt: source.importedAt.toISOString(),
          updatedAt: source.updatedAt.toISOString(),
        },
      };
    }),
    variants: result.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      title: v.title,
      priceCents: v.priceCents,
      costCents: v.costCents,
      currency: v.currency,
      dropshipSourceId: v.dropshipSourceId,
      // The supplier's own code for this version, when the owner gave one per
      // version (sparx persona issue 362); null when one code covers them all.
      supplierSku: versionCodes.get(v.id) ?? null,
    })),
  };
}

const dropshipProductLinkRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/dropship/product-links', async (request) => {
    await requireDropshipModule(request);
    requireRole(request, 'viewer');
    const { tenantId } = toDropshipContext(request);
    const { product_id: productId } = ProductQuery.parse(request.query);

    const view = await readProductDropship(tenantId, productId);
    if (!view) throw notFound('product', productId);
    return ok(view);
  });

  // ── This supplier ships this product ─────────────────────────────────────────
  //
  // Idempotent: the same call again changes their code or their price.
  app.put('/v1/dropship/product-links', async (request) => {
    await requireDropshipModule(request);
    requireRole(request, 'admin');
    const { tenantId } = toDropshipContext(request);
    const body = LinkBody.parse(request.body);

    const [product, supplier, existing, variants] = await withTenant({ tenantId }, (tx) =>
      Promise.all([
        tx.product.findFirst({
          where: { id: body.product_id, tenantId, deletedAt: null },
          select: { id: true, title: true },
        }),
        tx.dropshipSupplier.findFirst({
          where: { id: body.supplier_id, tenantId, deletedAt: null },
          select: { id: true, name: true, type: true },
        }),
        tx.dropshipProductLink.findMany({
          where: { tenantId, productId: body.product_id },
          select: {
            dropshipProduct: {
              select: { supplierId: true, supplier: { select: { name: true } } },
            },
          },
        }),
        tx.productVariant.findMany({
          where: { productId: body.product_id, deletedAt: null },
          select: { id: true, sku: true, title: true },
        }),
      ])
    );
    if (!product) throw notFound('product', body.product_id);
    if (!supplier) throw notFound('supplier', body.supplier_id);
    if (!linkedByHand(supplier.type)) {
      throw badRequest(
        `${supplier.name} has a product list of their own. Bring this product in from it, so their price and stock come with it.`,
        'LINK_BY_IMPORT'
      );
    }
    const other = existing.find((link) => link.dropshipProduct.supplierId !== supplier.id);
    if (other) {
      throw conflict(
        `${other.dropshipProduct.supplier.name} already ships ${product.title}. Stop them shipping it first.`,
        'ALREADY_SHIPPED_BY_ANOTHER'
      );
    }

    // Each version's code and price, for every version on sale: a version left
    // out would be sent with another one's code.
    const versions = body.versions?.map((v) => ({
      variantId: v.variant_id,
      supplierSku: v.supplier_sku,
      costPriceCents: v.cost_cents,
    }));
    if (versions) {
      const ours = new Set(variants.map((v) => v.id));
      const named = new Set(versions.map((v) => v.variantId));
      if (versions.some((v) => !ours.has(v.variantId)) || variants.some((v) => !named.has(v.id))) {
        throw badRequest(
          `Give their code and price for each version of ${product.title}, and only its own.`,
          'VERSIONS_DO_NOT_MATCH'
        );
      }
    }
    const titleOf = (variantId: string) => {
      const variant = variants.find((v) => v.id === variantId);
      return variant?.title ?? variant?.sku ?? product.title;
    };
    const stored = (versions
      ? handVersionsToStore(versions, titleOf)
      : []) as unknown as Prisma.InputJsonValue;

    await withTenant({ tenantId }, async (tx) => {
      // Their item for this product. Keyed on our product id: they have no list,
      // so there is no id of theirs to key it on.
      const item = await tx.dropshipProduct.upsert({
        where: {
          tenantId_supplierId_supplierProductId: {
            tenantId,
            supplierId: supplier.id,
            supplierProductId: product.id,
          },
        },
        create: {
          tenantId,
          supplierId: supplier.id,
          supplierProductId: product.id,
          title: product.title,
          costPriceCents: body.cost_cents,
          variants: stored,
        },
        update: { title: product.title, costPriceCents: body.cost_cents, variants: stored },
      });
      await tx.dropshipProductLink.upsert({
        where: {
          tenantId_productId_dropshipProductId: {
            tenantId,
            productId: product.id,
            dropshipProductId: item.id,
          },
        },
        create: {
          tenantId,
          productId: product.id,
          dropshipProductId: item.id,
          supplierSku: body.supplier_sku,
          status: 'active',
        },
        update: { supplierSku: body.supplier_sku, status: 'active' },
      });
    });

    // Every version of the product ships from them, each at its own price when
    // the versions were priced one by one.
    const ctx = toCommerceContext(request);
    for (const variant of variants) {
      const own = versions?.find((v) => v.variantId === variant.id);
      await variantService.update(ctx, variant.id, {
        dropshipSourceId: supplier.id,
        costCents: own?.costPriceCents ?? body.cost_cents,
      });
    }

    const view = await readProductDropship(tenantId, product.id);
    if (!view) throw notFound('product', product.id);
    return ok(view);
  });

  // ── They stop shipping it ────────────────────────────────────────────────────
  //
  // The product stays on sale and goes back to being shipped by the business.
  // What it cost stays on the variants: it is still the last price paid. Orders
  // already sent to the supplier are not touched.
  app.delete('/v1/dropship/product-links/:id', async (request) => {
    await requireDropshipModule(request);
    requireRole(request, 'admin');
    const { tenantId } = toDropshipContext(request);
    const { id } = LinkPath.parse(request.params);

    const link = await withTenant({ tenantId }, (tx) =>
      tx.dropshipProductLink.findFirst({
        where: { id, tenantId },
        select: {
          id: true,
          productId: true,
          dropshipProductId: true,
          dropshipProduct: { select: { supplierId: true, supplier: { select: { type: true } } } },
        },
      })
    );
    if (!link) throw notFound('link', id);
    const supplierId = link.dropshipProduct.supplierId;

    const sourced = await withTenant({ tenantId }, (tx) =>
      tx.productVariant.findMany({
        where: { productId: link.productId, deletedAt: null, dropshipSourceId: supplierId },
        select: { id: true },
      })
    );
    const ctx = toCommerceContext(request);
    for (const variant of sourced) {
      await variantService.update(ctx, variant.id, { dropshipSourceId: null });
    }

    await withTenant({ tenantId }, async (tx) => {
      await tx.dropshipProductLink.delete({ where: { id: link.id } });
      // Their item was made for this link alone when they have no list of their
      // own; an imported item is their catalog, and stays.
      if (linkedByHand(link.dropshipProduct.supplier.type)) {
        await tx.dropshipProduct.delete({ where: { id: link.dropshipProductId } });
      }
    });

    const view = await readProductDropship(tenantId, link.productId);
    if (!view) throw notFound('product', link.productId);
    return ok(view);
  });

  return Promise.resolve();
};

export default dropshipProductLinkRoutes;
