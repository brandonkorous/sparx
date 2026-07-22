// Dropship products — the cross-supplier catalog aggregate.
//
//   GET /v1/dropship/products  → every supplier's dropship_products, merged
//
// The per-supplier catalog (`/suppliers/:id/catalog`) answers "what does THIS
// supplier offer". The Supplier-products surface asks the cross-cutting question
// no single per-supplier read can answer — "what can I import, and what have I
// imported, across ALL my suppliers" — without the client fanning out one
// request per supplier and then sorting and paging a merged window by hand. That
// client merge is a correctness bug the moment it pages: it sorts one page of
// each supplier and presents the union as the answer. This does it as ONE
// server-paged, server-sorted, server-filtered query.
//
// Returns the same `toDropshipProductView` shape as the catalog endpoint (so the
// UI has one product shape), plus the owning supplier's id + name on each row.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { withTenant } from '@sparx/db';
import { paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireDropshipModule, toDropshipContext } from '../../../lib/dropship-context.js';
import { toDropshipProductView } from './suppliers.js';

// Sortable columns are a server-side whitelist — the enum rejects anything off
// the list rather than interpolating a client string into the orderBy.
const ProductSort = z.enum(['title', 'costPriceCents', 'importedAt']);

const ListQuery = z.object({
  supplierId: z.string().uuid().optional(),
  // `imported` = already in your catalog (a link exists); `available` = offered
  // but not yet imported. Mirrors the isImported flag the view carries.
  status: z.enum(['imported', 'available']).optional(),
  q: z.string().max(255).optional(),
  sort_by: ProductSort.optional(),
  order: z.enum(['asc', 'desc']).optional(),
  take: z.coerce.number().int().min(1).max(250).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const dropshipProductsRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/dropship/products', async (request, reply) => {
    await requireDropshipModule(request);
    // `editor` to match the sibling catalog read — same catalog data, same
    // sensitivity — rather than the `admin` the supplier config reads use.
    requireRole(request, 'editor');
    const { tenantId } = toDropshipContext(request);
    const query = ListQuery.parse(request.query);

    const [products, total] = await withTenant({ tenantId }, async (tx) => {
      const where: Prisma.DropshipProductWhereInput = { tenantId };
      if (query.supplierId) where.supplierId = query.supplierId;
      if (query.q) where.title = { contains: query.q, mode: 'insensitive' };
      if (query.status === 'imported') where.links = { some: {} };
      else if (query.status === 'available') where.links = { none: {} };

      const orderBy: Prisma.DropshipProductOrderByWithRelationInput = {
        [query.sort_by ?? 'importedAt']: query.order ?? 'desc',
      };

      return Promise.all([
        tx.dropshipProduct.findMany({
          where,
          include: {
            supplier: { select: { id: true, name: true } },
            links: {
              // Same shape the catalog read returns: the commerce PUBLISH state
              // rides along so "imported" never reads as "on sale".
              select: {
                id: true,
                productId: true,
                status: true,
                product: { select: { status: true } },
              },
            },
          },
          orderBy,
          take: query.take,
          skip: query.skip,
        }),
        tx.dropshipProduct.count({ where }),
      ]);
    });

    const rows = products.map((p) => ({
      ...toDropshipProductView(p),
      supplierId: p.supplier.id,
      supplierName: p.supplier.name,
    }));

    return reply.send(paged(rows, { total, skip: query.skip, take: query.take }));
  });

  return Promise.resolve();
};

export default dropshipProductsRoutes;
