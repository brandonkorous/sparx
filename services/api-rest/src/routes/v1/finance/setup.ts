// Categories and vendors — the two lists the spend form picks from (docs/148 §3).
//
//   GET    /v1/finance/categories        → the owner's spend buckets
//   POST   /v1/finance/categories        → invent one
//   PATCH  /v1/finance/categories/:id    → rename / recolour / re-kind
//   POST   /v1/finance/categories/:id/archive → hide without touching history
//   DELETE /v1/finance/categories/:id    → only if invented AND unused
//
//   GET    /v1/finance/vendors           → who you pay, with spend-to-date
//   POST   /v1/finance/vendors           → add one
//   GET    /v1/finance/vendors/:id       → one
//   PATCH  /v1/finance/vendors/:id       → edit
//   POST   /v1/finance/vendors/:id/archive → the only removal; never a delete

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import {
  archiveCategory,
  archiveVendor,
  createCategory,
  createVendor,
  deleteCategory,
  getVendor,
  listCategories,
  listVendors,
  updateCategory,
  updateVendor,
  vendorSpendCents,
} from '@sparx/finance';
import {
  createCategorySchema,
  createVendorSchema,
  updateCategorySchema,
  updateVendorSchema,
} from '@sparx/finance/schemas';
import { requireFinanceModule, toFinanceContext } from '../../../lib/finance-context.js';

const PathId = z.object({ id: z.string().uuid() });
const ArchiveBody = z.object({ archived: z.boolean().default(true) });
const CategoryQuery = z.object({ includeArchived: z.coerce.boolean().optional() });
const VendorQuery = z.object({
  includeArchived: z.coerce.boolean().optional(),
  search: z.string().trim().max(200).optional(),
  /** Spend-to-date is an extra aggregate per row, so the picker can skip it. */
  withSpend: z.coerce.boolean().optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; route registration is sync.
const financeSetupRoutes: FastifyPluginAsync = async (app) => {
  /* ── Categories ─────────────────────────────────────────────────────────── */

  app.get('/v1/finance/categories', async (request) => {
    await requireFinanceModule(request);
    requireRole(request, 'viewer');
    const { tenantId } = toFinanceContext(request);
    const query = CategoryQuery.parse(request.query);
    const rows = await listCategories(tenantId, { includeArchived: query.includeArchived });
    return ok(
      rows.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        kind: c.kind,
        color: c.color,
        // Drives whether the UI offers Delete or only Archive — a seeded category
        // is addressed by slug from a deriver and can never be removed.
        isSystem: c.isSystem,
        exportCode: c.exportCode,
        sortOrder: c.sortOrder,
        archivedAt: c.archivedAt,
      }))
    );
  });

  app.post('/v1/finance/categories', async (request, reply) => {
    await requireFinanceModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toFinanceContext(request);
    const input = createCategorySchema.parse(request.body);
    return reply.code(201).send(ok(await createCategory(tenantId, input)));
  });

  app.patch('/v1/finance/categories/:id', async (request) => {
    await requireFinanceModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toFinanceContext(request);
    const { id } = PathId.parse(request.params);
    const input = updateCategorySchema.parse({ ...(request.body as object), id });
    return ok(await updateCategory(tenantId, input));
  });

  app.post('/v1/finance/categories/:id/archive', async (request) => {
    await requireFinanceModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toFinanceContext(request);
    const { id } = PathId.parse(request.params);
    const { archived } = ArchiveBody.parse(request.body ?? {});
    return ok(await archiveCategory(tenantId, id, archived));
  });

  app.delete('/v1/finance/categories/:id', async (request, reply) => {
    await requireFinanceModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toFinanceContext(request);
    const { id } = PathId.parse(request.params);
    await deleteCategory(tenantId, id);
    return reply.code(204).send();
  });

  /* ── Vendors ────────────────────────────────────────────────────────────── */

  app.get('/v1/finance/vendors', async (request) => {
    await requireFinanceModule(request);
    requireRole(request, 'viewer');
    const { tenantId } = toFinanceContext(request);
    const query = VendorQuery.parse(request.query);
    const rows = await listVendors(tenantId, {
      includeArchived: query.includeArchived,
      search: query.search,
    });

    const spend = query.withSpend
      ? await Promise.all(rows.map((v) => vendorSpendCents(tenantId, v.id)))
      : null;

    return ok(
      rows.map((v, i) => ({
        id: v.id,
        name: v.name,
        email: v.email,
        phone: v.phone,
        website: v.website,
        address: v.address,
        accountRef: v.accountRef,
        paymentTerms: v.paymentTerms,
        supplierId: v.supplierId,
        companyId: v.companyId,
        notes: v.notes,
        archivedAt: v.archivedAt,
        spendCents: spend ? (spend[i] ?? 0) : null,
      }))
    );
  });

  app.post('/v1/finance/vendors', async (request, reply) => {
    await requireFinanceModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toFinanceContext(request);
    const input = createVendorSchema.parse(request.body);
    return reply.code(201).send(ok(await createVendor(tenantId, input)));
  });

  app.get('/v1/finance/vendors/:id', async (request) => {
    await requireFinanceModule(request);
    requireRole(request, 'viewer');
    const { tenantId } = toFinanceContext(request);
    const { id } = PathId.parse(request.params);
    const vendor = await getVendor(tenantId, id);
    return ok({ ...vendor, spendCents: await vendorSpendCents(tenantId, id) });
  });

  app.patch('/v1/finance/vendors/:id', async (request) => {
    await requireFinanceModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toFinanceContext(request);
    const { id } = PathId.parse(request.params);
    const input = updateVendorSchema.parse({ ...(request.body as object), id });
    return ok(await updateVendor(tenantId, input));
  });

  // Archive, never delete: a vendor with history is a payee on last year's books,
  // and removing it would blank the "who did we pay" column on every expense.
  app.post('/v1/finance/vendors/:id/archive', async (request) => {
    await requireFinanceModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toFinanceContext(request);
    const { id } = PathId.parse(request.params);
    const { archived } = ArchiveBody.parse(request.body ?? {});
    return ok(await archiveVendor(tenantId, id, archived));
  });
};

export default financeSetupRoutes;
