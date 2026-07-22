// Dropshipping, seen through ONE product.
//
//   GET /v1/dropship/product-links?product_id=<uuid>
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
// Read-only. Importing is `POST /v1/dropship/suppliers/:id/catalog/:productId/
// import` and re-importing is its `reimport` sibling — both keyed on the
// SUPPLIER's catalog id, which is the right way round for the direction that
// operation actually runs.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant } from '@sparx/db';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { notFound } from '@sparx/api-core/errors';
import { requireDropshipModule, toDropshipContext } from '../../../lib/dropship-context.js';

const ProductQuery = z.object({ product_id: z.string().uuid() });

const dropshipProductLinkRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/dropship/product-links', async (request) => {
    await requireDropshipModule(request);
    requireRole(request, 'viewer');
    const { tenantId } = toDropshipContext(request);
    const { product_id: productId } = ProductQuery.parse(request.query);

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

    if (!result) throw notFound('product', productId);

    // Stamped by the importer onto the product it created. Reported separately
    // from the links because the two can disagree: a link removed by hand
    // leaves the stamp behind, and a panel that trusted only the stamp would
    // claim a supplier that no longer ships anything.
    const metadata = result.product.metadata as Record<string, unknown> | null;
    const stampedSupplierId =
      metadata && typeof metadata.dropshipSupplierId === 'string'
        ? metadata.dropshipSupplierId
        : null;

    return ok({
      stampedSupplierId,
      links: result.links.map((link) => {
        const source = link.dropshipProduct;
        const supplier = source.supplier;
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
      })),
    });
  });

  return Promise.resolve();
};

export default dropshipProductLinkRoutes;
