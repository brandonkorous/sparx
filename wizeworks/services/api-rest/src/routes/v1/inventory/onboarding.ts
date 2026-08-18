// Onboarding — beating the spreadsheet (docs/146 Phase 11).
//
//   The guided setup and its clock (11.1)
//     GET   /v1/inventory/setup                     — where they are, and how long it has taken
//     POST  /v1/inventory/setup/steps               — complete / skip / reopen a step
//     POST  /v1/inventory/setup/dismiss             — stop asking
//
//   Reading somebody else's spreadsheet (11.2 + 11.7)
//     GET   /v1/inventory/import-recipes            — the files people arrive with
//     GET   /v1/inventory/import-profiles
//     POST  /v1/inventory/import-profiles
//     PATCH /v1/inventory/import-profiles/:id
//     DELETE /v1/inventory/import-profiles/:id
//     POST  /v1/inventory/imports/preview           — read a file, guess the columns, WRITE NOTHING
//
//   Resolving the rows that did not land (11.3)
//     POST  /v1/inventory/imports/:id/resolve
//
//   The opening balance (11.4)
//     GET   /v1/inventory/opening-balance
//     POST  /v1/inventory/opening-balance
//
//   Stock as a spreadsheet (11.5)
//     GET   /v1/inventory/stock-grid?format=csv
//     POST  /v1/inventory/stock-grid
//
//   The tenant's own columns (11.8)
//     GET    /v1/inventory/custom-fields
//     POST   /v1/inventory/custom-fields
//     PATCH  /v1/inventory/custom-fields/:id
//     DELETE /v1/inventory/custom-fields/:id
//     GET    /v1/inventory/custom-fields/values/:entity/:id
//     PATCH  /v1/inventory/custom-fields/values/:entity/:id
//
// ── Why preview is a POST that changes nothing ───────────────────────────────
//
// It carries a file, so it cannot be a GET. But it stores nothing, creates no
// batch and touches no stock: a person must be able to drag in last year's
// export, see the mapping land on the wrong columns, and close the tab having
// changed nothing at all. That is the difference between a mapping screen people
// experiment with and one they are afraid of.
//
// ── Role split ───────────────────────────────────────────────────────────────
//
// Setup and previews are `editor` — ordinary work by whoever is setting the
// business up. Custom-field DEFINITIONS are `admin`: adding a column changes
// every form and every export for everyone, and removing one hides data. Writing
// field VALUES is `editor`, because filling in a column is just work. The stock
// grid is `editor` for bookkeeping fields and posts real movements, so it sits
// where the bulk-adjust endpoint sits.

import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';
import { queryBool } from '@wizeworks/api-core/query';
import { CustomFieldEntity } from '@wizeworks/commerce-schemas';
import { inventoryService, toCsv, type CsvTable } from '@wizeworks/inventory';
import { ok, paged } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';

const IdPath = z.object({ id: z.string().uuid() });

const SetupStepBody = z.object({
  step: z.enum(['locations', 'import', 'mapping', 'opening_balance', 'alerts']),
  action: z.enum(['complete', 'skip', 'reopen']).optional(),
  result: z.record(z.string(), z.unknown()).optional(),
});

const PreviewBody = z.object({
  csv: z.string().min(1).max(20_000_000),
  filename: z.string().max(255).optional(),
  recipe_key: z.string().max(60).nullable().optional(),
  profile_id: z.string().uuid().nullable().optional(),
});

const ProfileQuery = z.object({ kind: z.string().max(30).optional() });

const OpeningBalanceBody = z.object({
  warehouse_id: z.string().uuid(),
  is_blind: z.boolean().optional(),
  note: z.string().max(500).nullable().optional(),
});

const GridQuery = z.object({
  format: z.enum(['json', 'csv']).optional(),
  warehouse_id: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  low_only: queryBool.optional(),
  take: z.coerce.number().int().min(1).max(5000).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const CustomFieldQuery = z.object({
  entity: CustomFieldEntity.optional(),
  include_inactive: queryBool.optional(),
});

/** A level is identified by two ids, everything else by one. Both spellings are
 *  accepted on the same route rather than split across two, because "set a
 *  custom field on this record" is one operation to every caller. */
const ValuePath = z.object({
  entity: CustomFieldEntity,
  id: z.string().min(1).max(100),
});

function sendCsv(reply: FastifyReply, table: CsvTable): FastifyReply {
  return reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="inventory-${table.name}.csv"`)
    .send(toCsv(table));
}

/** `variantId:warehouseId` for a level, a plain uuid for everything else. */
function valueTarget(
  entity: z.infer<typeof CustomFieldEntity>,
  id: string
): { id: string } | { variantId: string; warehouseId: string } {
  if (entity !== 'level') return { id };
  const [variantId, warehouseId] = id.split(':');
  if (!variantId || !warehouseId) {
    throw new Error('A stock position is identified as <item id>:<location id>');
  }
  return { variantId, warehouseId };
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventoryOnboardingRoutes: FastifyPluginAsync = async (app) => {
  // ── The guided setup ─────────────────────────────────────────────────────

  app.get('/v1/inventory/setup', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    return ok(await inventoryService.getSetupProgress(toInventoryContext(request)));
  });

  app.post('/v1/inventory/setup/steps', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const input = SetupStepBody.parse(request.body);
    return ok(
      await inventoryService.completeSetupStep(toInventoryContext(request), {
        step: input.step,
        ...(input.action ? { action: input.action } : {}),
        ...(input.result ? { result: input.result } : {}),
      })
    );
  });

  app.post('/v1/inventory/setup/dismiss', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const body = z.object({ dismissed: z.boolean().optional() }).parse(request.body ?? {});
    return ok(
      await inventoryService.dismissSetup(toInventoryContext(request), body.dismissed ?? true)
    );
  });

  // ── Reading somebody else's spreadsheet ──────────────────────────────────

  app.get('/v1/inventory/import-recipes', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    // Static: recipes ship in the source (docs/146 Phase 11.7), so this is a
    // list of what the code knows rather than a query.
    return ok({ recipes: inventoryService.listMigrationRecipes() });
  });

  app.get('/v1/inventory/import-profiles', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = ProfileQuery.parse(request.query);
    const items = await inventoryService.listImportProfiles(
      toInventoryContext(request),
      q.kind ?? 'stock'
    );
    return paged(items, { total: items.length, skip: 0, per_page: items.length });
  });

  app.post('/v1/inventory/import-profiles', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const created = await inventoryService.createImportProfile(
      toInventoryContext(request),
      request.body
    );
    return reply.status(201).send(ok(created));
  });

  app.patch('/v1/inventory/import-profiles/:id', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = IdPath.parse(request.params);
    return ok(
      await inventoryService.updateImportProfile(toInventoryContext(request), id, request.body)
    );
  });

  app.delete('/v1/inventory/import-profiles/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = IdPath.parse(request.params);
    await inventoryService.deleteImportProfile(toInventoryContext(request), id);
    return reply.status(204).send();
  });

  app.post('/v1/inventory/imports/preview', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const input = PreviewBody.parse(normalizeCsvBody(request.query, request.body));
    return ok(
      await inventoryService.previewImport(toInventoryContext(request), {
        csv: input.csv,
        filename: input.filename ?? null,
        recipeKey: input.recipe_key ?? null,
        profileId: input.profile_id ?? null,
      })
    );
  });

  // ── Resolving the rows that did not land ─────────────────────────────────

  app.post('/v1/inventory/imports/:id/resolve', async (request) => {
    await requireInventoryModule(request);
    // `editor`, not `admin`. Nothing is posted here — the plan is edited, and
    // applying it is still the admin step it was before.
    requireRole(request, 'editor');
    const { id } = IdPath.parse(request.params);
    return ok(
      await inventoryService.resolveImportRows(toInventoryContext(request), id, request.body)
    );
  });

  // ── The opening balance ──────────────────────────────────────────────────

  app.get('/v1/inventory/opening-balance', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    return ok(await inventoryService.openingBalanceStatus(toInventoryContext(request)));
  });

  app.post('/v1/inventory/opening-balance', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const input = OpeningBalanceBody.parse(request.body);
    const count = await inventoryService.startOpeningBalance(toInventoryContext(request), {
      warehouseId: input.warehouse_id,
      ...(input.is_blind !== undefined ? { isBlind: input.is_blind } : {}),
      note: input.note ?? null,
    });
    return reply.status(201).send(ok(count));
  });

  // ── Stock as a spreadsheet ───────────────────────────────────────────────

  app.get('/v1/inventory/stock-grid', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = GridQuery.parse(request.query);
    const filter = {
      warehouseId: q.warehouse_id ?? null,
      search: q.search ?? null,
      ...(q.low_only !== undefined ? { lowOnly: q.low_only } : {}),
      ...(q.take !== undefined ? { take: q.take } : {}),
      ...(q.skip !== undefined ? { skip: q.skip } : {}),
    };
    if (q.format === 'csv') {
      return sendCsv(
        reply,
        await inventoryService.stockGridCsv(toInventoryContext(request), filter)
      );
    }
    const page = await inventoryService.stockGrid(toInventoryContext(request), filter);
    return ok(page);
  });

  app.post('/v1/inventory/stock-grid', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    return ok(await inventoryService.saveStockGrid(toInventoryContext(request), request.body));
  });

  // ── The tenant's own columns ─────────────────────────────────────────────

  app.get('/v1/inventory/custom-fields', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = CustomFieldQuery.parse(request.query);
    const items = await inventoryService.listCustomFields(toInventoryContext(request), {
      ...(q.entity ? { entity: q.entity } : {}),
      ...(q.include_inactive !== undefined ? { includeInactive: q.include_inactive } : {}),
    });
    return paged(items, { total: items.length, skip: 0, per_page: items.length });
  });

  app.post('/v1/inventory/custom-fields', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const created = await inventoryService.createCustomField(
      toInventoryContext(request),
      request.body
    );
    return reply.status(201).send(ok(created));
  });

  app.patch('/v1/inventory/custom-fields/:id', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { id } = IdPath.parse(request.params);
    return ok(
      await inventoryService.updateCustomField(toInventoryContext(request), id, request.body)
    );
  });

  app.delete('/v1/inventory/custom-fields/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { id } = IdPath.parse(request.params);
    await inventoryService.deleteCustomField(toInventoryContext(request), id);
    return reply.status(204).send();
  });

  app.get('/v1/inventory/custom-fields/values/:entity/:id', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { entity, id } = ValuePath.parse(request.params);
    return ok(
      await inventoryService.getCustomFieldValues(
        toInventoryContext(request),
        entity,
        valueTarget(entity, id)
      )
    );
  });

  app.patch('/v1/inventory/custom-fields/values/:entity/:id', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { entity, id } = ValuePath.parse(request.params);
    const body = z.record(z.string(), z.unknown()).parse(request.body ?? {});
    return ok({
      values: await inventoryService.setCustomFieldValues(
        toInventoryContext(request),
        entity,
        valueTarget(entity, id),
        body
      ),
    });
  });
};

/** A preview may arrive as JSON or as a raw `text/csv` upload, in which case the
 *  filename and the chosen recipe ride in the query string — the same contract
 *  the import plan endpoint already offers. */
function normalizeCsvBody(rawQuery: unknown, body: unknown): unknown {
  if (body && typeof body === 'object' && '__csv' in body) {
    const query = (rawQuery ?? {}) as Record<string, string | undefined>;
    return {
      csv: (body as { __csv: string }).__csv,
      ...(query.filename ? { filename: query.filename } : {}),
      ...(query.recipe_key ? { recipe_key: query.recipe_key } : {}),
      ...(query.profile_id ? { profile_id: query.profile_id } : {}),
    };
  }
  return body;
}

export default inventoryOnboardingRoutes;
