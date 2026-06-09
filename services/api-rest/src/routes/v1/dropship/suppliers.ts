// Dropship suppliers — connect, configure, sync, catalog browse, import.
//
//   GET    /v1/dropship/suppliers                              → list
//   POST   /v1/dropship/suppliers                              → connect
//   GET    /v1/dropship/suppliers/:id                          → get one
//   PATCH  /v1/dropship/suppliers/:id                          → update
//   DELETE /v1/dropship/suppliers/:id                          → disconnect
//   POST   /v1/dropship/suppliers/:id/sync                     → trigger catalog sync
//   GET    /v1/dropship/suppliers/:id/catalog                  → browse raw catalog
//   POST   /v1/dropship/suppliers/:id/catalog/:productId/import → import to commerce

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { withTenant } from '@sparx/db';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { notFound, badRequest, conflict } from '@sparx/api-core/errors';
import { slugify, uniqueSlug } from '@sparx/api-core/slug';
import { createPublisher, publishEvent, type PublisherLogger } from '@sparx/events';
import { createAdapter } from '@sparx/dropship';
import type { PricingRule } from '@sparx/dropship';
import { applyPricingRule } from '@sparx/dropship';
import { requireDropshipModule, toDropshipContext } from '../../../lib/dropship-context.js';
import { env } from '../../../env.js';

const pubLogger: PublisherLogger = {
  info: (obj, msg) => console.info(msg ?? '', obj),
  warn: (obj, msg) => console.warn(msg ?? '', obj),
  error: (obj, msg) => console.error(msg ?? '', obj),
};
const publisher = createPublisher({ projectId: env.GCP_PROJECT_ID, logger: pubLogger });

const PathId = z.object({ id: z.string().uuid() });
const PathIdProduct = z.object({ id: z.string().uuid(), productId: z.string().uuid() });

const ListQuery = z.object({
  status: z.enum(['connecting', 'active', 'error', 'disconnected']).optional(),
  take: z.coerce.number().int().min(1).max(250).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const CatalogQuery = z.object({
  q: z.string().max(255).optional(),
  take: z.coerce.number().int().min(1).max(250).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const PricingRuleSchema = z.object({
  type: z.enum(['percentage_markup', 'multiplier', 'flat_markup', 'fixed_margin']),
  value: z.number().positive(),
  roundTo: z.enum(['cent', 'dollar', 'five_dollar']).optional(),
  maxMsrp: z.literal('use_supplier_msrp').optional(),
});

const SupplierBody = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['csv', 'dsers', 'spocket', 'faire', 'autods', 'custom']),
  credentials: z.record(z.string(), z.string()),
  pricingRule: PricingRuleSchema.nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

const SupplierPatchBody = z.object({
  name: z.string().min(1).max(255).optional(),
  credentials: z.record(z.string(), z.string()).optional(),
  pricingRule: PricingRuleSchema.nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

const ImportBody = z.object({
  pricingRuleOverride: PricingRuleSchema.optional(),
});

function toSupplierView(s: {
  id: string;
  name: string;
  type: string;
  status: string;
  lastSyncAt: Date | null;
  pricingRule: unknown;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: s.id,
    name: s.name,
    type: s.type,
    status: s.status,
    lastSyncAt: s.lastSyncAt?.toISOString() ?? null,
    pricingRule: (s.pricingRule as PricingRule | null) ?? null,
    notes: s.notes,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

function toDropshipProductView(dp: {
  id: string;
  supplierProductId: string;
  title: string;
  description: string | null;
  images: unknown;
  variants: unknown;
  costPriceCents: number;
  msrpCents: number | null;
  importedAt: Date;
  updatedAt: Date;
  links?: { id: string; productId: string; status: string }[];
}) {
  return {
    id: dp.id,
    supplierProductId: dp.supplierProductId,
    title: dp.title,
    description: dp.description,
    images: (dp.images as string[]) ?? [],
    variants: dp.variants,
    costPriceCents: dp.costPriceCents,
    msrpCents: dp.msrpCents,
    importedAt: dp.importedAt.toISOString(),
    updatedAt: dp.updatedAt.toISOString(),
    isImported: (dp.links?.length ?? 0) > 0,
    links: dp.links?.map((l) => ({ id: l.id, productId: l.productId, status: l.status })) ?? [],
  };
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const dropshipSupplierRoutes: FastifyPluginAsync = async (app) => {
  // ── List suppliers ───────────────────────────────────────────────────────────

  app.get('/v1/dropship/suppliers', async (request, reply) => {
    await requireDropshipModule(request);
    requireRole(request, 'admin');
    const { tenantId } = toDropshipContext(request);
    const query = ListQuery.parse(request.query);

    const [suppliers, total] = await withTenant({ tenantId }, async (tx) => {
      const where: Prisma.DropshipSupplierWhereInput = { tenantId, deletedAt: null };
      if (query.status) (where as Record<string, unknown>).status = query.status;
      return Promise.all([
        tx.dropshipSupplier.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: query.take,
          skip: query.skip,
        }),
        tx.dropshipSupplier.count({ where }),
      ]);
    });

    return reply.send(
      paged(suppliers.map(toSupplierView), { total, skip: query.skip, take: query.take })
    );
  });

  // ── Connect a supplier ───────────────────────────────────────────────────────

  app.post('/v1/dropship/suppliers', async (request, reply) => {
    await requireDropshipModule(request);
    requireRole(request, 'admin');
    const { tenantId, userId } = toDropshipContext(request);
    const body = SupplierBody.parse(request.body);

    // Validate connection inline (fails fast with 400 rather than waiting for worker).
    let connectionOk = false;
    try {
      const adapter = createAdapter(body.type, body.credentials);
      connectionOk = await adapter.authenticate(body.credentials);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Adapter authentication failed';
      throw badRequest(msg, 'CONNECTION_FAILED');
    }

    const supplier = await withTenant({ tenantId }, async (tx) => {
      return tx.dropshipSupplier.create({
        data: {
          tenantId,
          name: body.name,
          type: body.type,
          credentials: body.credentials as Prisma.InputJsonValue,
          status: connectionOk ? 'active' : 'error',
          pricingRule: body.pricingRule ? (body.pricingRule as Prisma.InputJsonValue) : Prisma.JsonNull,
          notes: body.notes ?? null,
        },
      });
    });

    await publishEvent(
      publisher,
      'dropship.supplier.connected',
      tenantId,
      userId,
      { supplierId: supplier.id, type: body.type, connectionOk },
      pubLogger
    );

    return reply.status(201).send(ok(toSupplierView(supplier)));
  });

  // ── Get one supplier ─────────────────────────────────────────────────────────

  app.get('/v1/dropship/suppliers/:id', async (request, reply) => {
    await requireDropshipModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toDropshipContext(request);
    const { id } = PathId.parse(request.params);

    const supplier = await withTenant({ tenantId }, async (tx) => {
      return tx.dropshipSupplier.findFirst({ where: { id, tenantId, deletedAt: null } });
    });
    if (!supplier) throw notFound('Supplier not found');

    return reply.send(ok(toSupplierView(supplier)));
  });

  // ── Update supplier ──────────────────────────────────────────────────────────

  app.patch('/v1/dropship/suppliers/:id', async (request, reply) => {
    await requireDropshipModule(request);
    requireRole(request, 'admin');
    const { tenantId } = toDropshipContext(request);
    const { id } = PathId.parse(request.params);
    const body = SupplierPatchBody.parse(request.body);

    const existing = await withTenant({ tenantId }, async (tx) => {
      return tx.dropshipSupplier.findFirst({ where: { id, tenantId, deletedAt: null } });
    });
    if (!existing) throw notFound('Supplier not found');

    // If credentials changed, re-validate connection.
    let newStatus: string | undefined;
    if (body.credentials) {
      try {
        const adapter = createAdapter(existing.type, body.credentials);
        const ok2 = await adapter.authenticate(body.credentials);
        newStatus = ok2 ? 'active' : 'error';
      } catch {
        newStatus = 'error';
      }
    }

    const updated = await withTenant({ tenantId }, async (tx) => {
      return tx.dropshipSupplier.update({
        where: { id },
        data: {
          ...(body.name !== undefined && { name: body.name }),
          ...(body.credentials !== undefined && {
            credentials: body.credentials as Prisma.InputJsonValue,
          }),
          ...(body.pricingRule !== undefined && {
            pricingRule: body.pricingRule
              ? (body.pricingRule as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          }),
          ...(body.notes !== undefined && { notes: body.notes }),
          ...(newStatus !== undefined && { status: newStatus }),
        },
      });
    });

    return reply.send(ok(toSupplierView(updated)));
  });

  // ── Disconnect supplier ──────────────────────────────────────────────────────

  app.delete('/v1/dropship/suppliers/:id', async (request, reply) => {
    await requireDropshipModule(request);
    requireRole(request, 'admin');
    const { tenantId } = toDropshipContext(request);
    const { id } = PathId.parse(request.params);

    const existing = await withTenant({ tenantId }, async (tx) => {
      return tx.dropshipSupplier.findFirst({ where: { id, tenantId, deletedAt: null } });
    });
    if (!existing) throw notFound('Supplier not found');

    await withTenant({ tenantId }, async (tx) => {
      return tx.dropshipSupplier.update({
        where: { id },
        data: { deletedAt: new Date(), status: 'disconnected' },
      });
    });

    return reply.status(204).send();
  });

  // ── Trigger catalog sync ─────────────────────────────────────────────────────

  app.post('/v1/dropship/suppliers/:id/sync', async (request, reply) => {
    await requireDropshipModule(request);
    requireRole(request, 'admin');
    const { tenantId, userId } = toDropshipContext(request);
    const { id } = PathId.parse(request.params);

    const supplier = await withTenant({ tenantId }, async (tx) => {
      return tx.dropshipSupplier.findFirst({ where: { id, tenantId, deletedAt: null } });
    });
    if (!supplier) throw notFound('Supplier not found');
    if (supplier.status === 'error') {
      throw badRequest('Cannot sync a supplier in error state', 'SUPPLIER_ERROR');
    }

    await publishEvent(
      publisher,
      'dropship.supplier.sync_started',
      tenantId,
      userId,
      { supplierId: id, type: supplier.type },
      pubLogger
    );

    return reply.send(ok({ supplierId: id, status: 'sync_queued' }));
  });

  // ── Browse supplier catalog (raw dropship_products) ──────────────────────────

  app.get('/v1/dropship/suppliers/:id/catalog', async (request, reply) => {
    await requireDropshipModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toDropshipContext(request);
    const { id } = PathId.parse(request.params);
    const query = CatalogQuery.parse(request.query);

    const supplier = await withTenant({ tenantId }, async (tx) => {
      return tx.dropshipSupplier.findFirst({ where: { id, tenantId, deletedAt: null } });
    });
    if (!supplier) throw notFound('Supplier not found');

    const [products, total] = await withTenant({ tenantId }, async (tx) => {
      const where: Prisma.DropshipProductWhereInput = { tenantId, supplierId: id };
      if (query.q) where.title = { contains: query.q, mode: 'insensitive' };
      return Promise.all([
        tx.dropshipProduct.findMany({
          where,
          include: {
            links: {
              select: { id: true, productId: true, status: true },
            },
          },
          orderBy: { importedAt: 'desc' },
          take: query.take,
          skip: query.skip,
        }),
        tx.dropshipProduct.count({ where }),
      ]);
    });

    return reply.send(
      paged(products.map(toDropshipProductView), { total, skip: query.skip, take: query.take })
    );
  });

  // ── Import a dropship product into the commerce catalog ──────────────────────
  //
  //   1. Look up the DropshipProduct row (must belong to this supplier + tenant).
  //   2. Apply the supplier's pricing rule (or an override from the request body).
  //   3. Create a commerce_products row + product_variants rows.
  //   4. Create a dropship_product_links row.
  //   5. Publish search.entity.changed so the product gets indexed.

  app.post('/v1/dropship/suppliers/:id/catalog/:productId/import', async (request, reply) => {
    await requireDropshipModule(request);
    requireRole(request, 'admin');
    const { tenantId, userId } = toDropshipContext(request);
    const { id, productId } = PathIdProduct.parse(request.params);
    const body = ImportBody.parse(request.body ?? {});

    const [supplier, dropshipProduct] = await withTenant({ tenantId }, async (tx) => {
      return Promise.all([
        tx.dropshipSupplier.findFirst({ where: { id, tenantId, deletedAt: null } }),
        tx.dropshipProduct.findFirst({
          where: { id: productId, supplierId: id, tenantId },
          include: {
            links: {
              where: { status: 'active' },
              select: { id: true, productId: true },
            },
          },
        }),
      ]);
    });

    if (!supplier) throw notFound('Supplier not found');
    if (!dropshipProduct) throw notFound('Dropship product not found');
    if (dropshipProduct.links.length > 0) {
      throw conflict('This product is already imported into your catalog', 'ALREADY_IMPORTED');
    }

    const pricingRule: PricingRule | null =
      body.pricingRuleOverride ?? (supplier.pricingRule as PricingRule | null) ?? null;

    const variants = dropshipProduct.variants as Array<{
      supplierSku: string;
      title: string;
      options: Record<string, string>;
      costPriceCents: number;
      msrpCents: number | null;
      inventoryQuantity: number | null;
      weight: number | null;
    }>;

    const result = await withTenant({ tenantId }, async (tx) => {
      // Generate a unique handle
      const baseHandle = slugify(dropshipProduct.title || 'product');
      const handle = await uniqueSlug(baseHandle, async (candidate) => {
        const existing = await tx.product.findFirst({
          where: { tenantId, handle: candidate, deletedAt: null },
        });
        return existing !== null;
      });

      // Create the commerce product
      const product = await tx.product.create({
        data: {
          tenantId,
          title: dropshipProduct.title,
          handle,
          description: dropshipProduct.description ?? null,
          status: 'draft',
          fulfillmentType: 'physical',
          metadata: {
            dropshipSupplierId: id,
            dropshipProductId: productId,
          },
        },
      });

      // Create variants
      const createdVariants = await Promise.all(
        variants.map((v, idx) => {
          const retailPrice = pricingRule
            ? applyPricingRule(v.costPriceCents, pricingRule)
            : (v.msrpCents ?? v.costPriceCents);

          const compareAt = pricingRule ? (v.msrpCents ?? null) : null;

          return tx.productVariant.create({
            data: {
              tenantId,
              productId: product.id,
              sku: v.supplierSku,
              title: v.title || undefined,
              priceCents: retailPrice,
              compareAtPriceCents: compareAt,
              costCents: v.costPriceCents,
              currency: 'USD',
              weightGrams: v.weight ?? undefined,
              isDefault: idx === 0,
              position: idx,
              dropshipSourceId: id,
            },
          });
        })
      );

      // Link the dropship product
      const link = await tx.dropshipProductLink.create({
        data: {
          tenantId,
          productId: product.id,
          dropshipProductId: productId,
          supplierSku: variants[0]?.supplierSku ?? '',
          status: 'active',
        },
      });

      return { product, variants: createdVariants, link };
    });

    await publishEvent(
      publisher,
      'search.entity.changed',
      tenantId,
      userId,
      { entityType: 'product', recordId: result.product.id, op: 'upsert' },
      pubLogger
    );

    return reply.status(201).send(
      ok({
        productId: result.product.id,
        linkId: result.link.id,
        variantCount: result.variants.length,
      })
    );
  });
};

export default dropshipSupplierRoutes;
