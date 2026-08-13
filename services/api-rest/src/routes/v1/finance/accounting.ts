// The accounting handoff (docs/148 §6) — export to, and import from, whoever
// actually keeps the books.
//
//   GET  /v1/finance/accounting                  → catalog + this tenant's connections
//   PUT  /v1/finance/accounting                  → connect / reconfigure
//   DELETE /v1/finance/accounting/:id            → disconnect
//   GET  /v1/finance/accounting/:id/mappings     → category ↔ their account
//   PUT  /v1/finance/accounting/:id/mappings     → save that table
//   GET  /v1/finance/accounting/:id/runs         → what the last syncs did
//   GET  /v1/finance/accounting/export           → download the file
//   POST /v1/finance/accounting/import/preview   → what WOULD be written
//   POST /v1/finance/accounting/import           → write it
//
// Export is a GET returning a file body rather than JSON, because the thing a
// person wants is a download they can forward to their accountant.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { badRequest } from '@sparx/api-core/errors';
import {
  accountingAdapter,
  accountingCatalog,
  clearCredentials,
  storeCredentials,
  buildExport,
  commitImport,
  deleteConnection,
  listConnections,
  listMappings,
  listSyncRuns,
  mappingsForExport,
  markExported,
  previewImport,
  recordSyncRun,
  setMappings,
  upsertConnection,
} from '@sparx/finance';
import {
  signAccountingOAuthState,
  verifyAccountingOAuthState,
} from '../../../lib/accounting-oauth.js';
import { accountingProviderSchema } from '@sparx/finance/schemas';
import {
  headerPropertyId,
  requireFinanceModule,
  toFinanceContext,
} from '../../../lib/finance-context.js';
import { resolveListScopeIds, resolvePropertyId } from '../../../lib/property.js';

const PathId = z.object({ id: z.string().uuid() });

const ConnectStartBody = z.object({
  /** Where the provider sends the browser back. Passed in by the app rather than
   *  derived here: the redirect must match the one registered with the vendor
   *  EXACTLY, and the app is the thing that knows its own origin. */
  redirectUri: z.string().min(1).max(2048),
});

const CallbackBody = z.object({
  code: z.string().min(1).max(4096),
  state: z.string().min(1).max(4096),
  /** Everything else the callback carried. QuickBooks puts the company file id
   *  in `realmId` here and nowhere else; a provider that needs nothing ignores it. */
  params: z.record(z.string(), z.string()).optional(),
});

const ConnectBody = z.object({
  provider: accountingProviderSchema,
  propertyId: z.string().uuid().nullish(),
  displayName: z.string().trim().max(255).nullish(),
  syncExpenses: z.boolean().optional(),
  syncInvoices: z.boolean().optional(),
  syncPayments: z.boolean().optional(),
  syncCadence: z.enum(['manual', 'daily', 'weekly']).optional(),
  syncFromDate: z.coerce.date().nullish(),
});

const MappingsBody = z.object({
  mappings: z.array(
    z.object({
      sparxType: z.enum([
        'expense_category',
        'tax_rate',
        'payment_method',
        'income_account',
        'vendor',
      ]),
      sparxId: z.string().max(200),
      categoryId: z.string().uuid().nullish(),
      externalId: z.string().max(200),
      externalName: z.string().max(255).nullish(),
      externalCode: z.string().max(60).nullish(),
    })
  ),
});

const ExportQuery = z.object({
  provider: accountingProviderSchema.default('csv'),
  from: z.coerce.date(),
  to: z.coerce.date(),
  connectionId: z.string().uuid().optional(),
  property: z.string().optional(),
  /** Stamp the exported rows so "what still needs sending" stays answerable. */
  markSent: z.coerce.boolean().optional(),
});

const ColumnMapSchema = z.object({
  date: z.string().min(1),
  description: z.string().min(1),
  amount: z.string().min(1),
  vendor: z.string().optional(),
  reference: z.string().optional(),
  category: z.string().optional(),
});

const ImportBody = z.object({
  csv: z.string().min(1).max(20_000_000),
  columns: ColumnMapSchema,
  delimiter: z.string().length(1).optional(),
  propertyId: z.string().uuid().nullish(),
  fallbackCategoryId: z.string().uuid(),
  invertAmounts: z.boolean().optional(),
  sourceKey: z.string().trim().min(1).max(180),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; route registration is sync.
const financeAccountingRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/finance/accounting', async (request) => {
    await requireFinanceModule(request);
    requireRole(request, 'viewer');
    const { tenantId } = toFinanceContext(request);
    return ok({
      catalog: accountingCatalog(),
      connections: await listConnections(tenantId),
    });
  });

  app.put('/v1/finance/accounting', async (request) => {
    await requireFinanceModule(request);
    const auth = requireRole(request, 'editor');
    const { tenantId } = toFinanceContext(request);
    const body = ConnectBody.parse(request.body);
    const propertyId =
      body.propertyId !== undefined
        ? body.propertyId
        : await resolvePropertyId(auth, headerPropertyId(request));
    return ok(await upsertConnection(tenantId, { ...body, propertyId }));
  });

  app.delete('/v1/finance/accounting/:id', async (request, reply) => {
    await requireFinanceModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toFinanceContext(request);
    const { id } = PathId.parse(request.params);
    await deleteConnection(tenantId, id);
    return reply.code(204).send();
  });

  app.get('/v1/finance/accounting/:id/mappings', async (request) => {
    await requireFinanceModule(request);
    requireRole(request, 'viewer');
    const { tenantId } = toFinanceContext(request);
    const { id } = PathId.parse(request.params);
    return ok(await listMappings(tenantId, id));
  });

  app.put('/v1/finance/accounting/:id/mappings', async (request) => {
    await requireFinanceModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toFinanceContext(request);
    const { id } = PathId.parse(request.params);
    const { mappings } = MappingsBody.parse(request.body);
    return ok({ saved: await setMappings(tenantId, id, mappings) });
  });

  app.get('/v1/finance/accounting/:id/runs', async (request) => {
    await requireFinanceModule(request);
    requireRole(request, 'viewer');
    const { tenantId } = toFinanceContext(request);
    const { id } = PathId.parse(request.params);
    return ok(await listSyncRuns(tenantId, id));
  });

  app.get('/v1/finance/accounting/export', async (request, reply) => {
    await requireFinanceModule(request);
    const auth = requireRole(request, 'viewer');
    const { tenantId } = toFinanceContext(request);
    const query = ExportQuery.parse(request.query);

    const propertyIds = await resolveListScopeIds(
      auth,
      query.property,
      request.headers['x-sparx-property-id']
    );
    const propertyId = propertyIds?.length === 1 ? propertyIds[0] : null;

    // A connection contributes its account mapping AND its books-closed date.
    // Without one, the export still works — it just posts to category names.
    const connection = query.connectionId
      ? (await listConnections(tenantId)).find((c) => c.id === query.connectionId)
      : undefined;
    if (query.connectionId && !connection) throw badRequest('Unknown accounting connection');

    const result = await buildExport(tenantId, query.provider, {
      from: query.from,
      to: query.to,
      propertyId,
      syncFromDate: connection?.syncFromDate ?? null,
      mappings: connection ? await mappingsForExport(tenantId, connection.id) : undefined,
    });

    if (query.markSent) {
      await markExported(tenantId, query.from, query.to, propertyId);
    }
    if (connection) {
      await recordSyncRun(tenantId, {
        connectionId: connection.id,
        direction: 'export',
        scope: 'expenses',
        periodStart: query.from,
        periodEnd: query.to,
        recordsTotal: result.rowCount + result.skipped.length,
        recordsSynced: result.rowCount,
        recordsSkipped: result.skipped.length,
        recordsFailed: 0,
        failures: result.skipped.length > 0 ? result.skipped : null,
      });
    }

    return (
      reply
        .header('content-type', result.contentType)
        .header('content-disposition', `attachment; filename="${result.filename}"`)
        // Rows left out are surfaced in a header rather than silently dropped —
        // the download itself cannot carry a warning.
        .header('x-sparx-skipped-rows', String(result.skipped.length))
        .send(result.body)
    );
  });

  // ── The OAuth round trip (docs/146 Phase 10.7–10.8) ───────────────────
  //
  //   POST /v1/finance/accounting/:id/connect   → { url } to send the browser to
  //   POST /v1/finance/accounting/callback      → exchange the code, store the grant
  //   POST /v1/finance/accounting/:id/disconnect → forget the grant, keep the history
  //
  // The connection row is created FIRST (through the existing PUT) and its id
  // rides in the signed state. A connect abandoned at the consent screen then
  // leaves a visible, deletable row rather than nothing — which is the difference
  // between "I started this and stopped" and a screen that forgot it happened.
  app.post('/v1/finance/accounting/:id/connect', async (request) => {
    await requireFinanceModule(request);
    const auth = requireRole(request, 'admin');
    const { tenantId } = toFinanceContext(request);
    const { id } = PathId.parse(request.params);
    const { redirectUri } = ConnectStartBody.parse(request.body);

    const connection = (await listConnections(tenantId)).find((c) => c.id === id);
    if (!connection) throw badRequest('That accounting connection no longer exists.');

    const adapter = accountingAdapter(connection.provider);
    if (!adapter) {
      throw badRequest(`sparx does not sign in to ${connection.provider}. Use the export instead.`);
    }
    if (!adapter.isConfigured()) {
      throw badRequest(adapter.unavailableReason());
    }

    const state = await signAccountingOAuthState({
      provider: connection.provider,
      tenantId,
      userId: auth.actorId ?? '',
      connectionId: id,
      redirectUri,
    });
    return ok({ url: adapter.authorizeUrl({ state, redirectUri }) });
  });

  app.post('/v1/finance/accounting/callback', async (request) => {
    await requireFinanceModule(request);
    const auth = requireRole(request, 'admin');
    const { tenantId } = toFinanceContext(request);
    const body = CallbackBody.parse(request.body);

    const decoded = await verifyAccountingOAuthState(body.state);
    // CSRF: the signed state must belong to the tenant that is asking. Without
    // this an attacker's consent redirect could attach their company file to
    // somebody else's books.
    if (decoded.tenantId !== tenantId) {
      throw badRequest('That accounting connect link belongs to a different account.');
    }

    const adapter = accountingAdapter(decoded.provider);
    if (!adapter) throw badRequest('That accounting system is no longer supported.');

    const credentials = await adapter.exchangeCode({
      code: body.code,
      redirectUri: decoded.redirectUri,
      ...(body.params ? { callbackParams: body.params } : {}),
    });

    const stored = await storeCredentials(tenantId, {
      connectionId: decoded.connectionId,
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      externalId: credentials.externalId,
      expiresAt: credentials.expiresAt,
    });
    void auth;
    return ok(stored);
  });

  app.post('/v1/finance/accounting/:id/disconnect', async (request) => {
    await requireFinanceModule(request);
    requireRole(request, 'admin');
    const { tenantId } = toFinanceContext(request);
    const { id } = PathId.parse(request.params);
    // The grant goes; the mapping table and the sync history stay. Both are work
    // somebody did, and a reconnect should not ask them to do it again.
    await clearCredentials(tenantId, id);
    return ok({ disconnected: true });
  });

  app.post('/v1/finance/accounting/import/preview', async (request) => {
    await requireFinanceModule(request);
    requireRole(request, 'editor');
    const body = ImportBody.parse(request.body);
    // Writes nothing. An import that commits 300 rows before showing what it did
    // is unrecoverable in practice.
    return ok(previewImport(body));
  });

  app.post('/v1/finance/accounting/import', async (request) => {
    await requireFinanceModule(request);
    const auth = requireRole(request, 'editor');
    const { tenantId } = toFinanceContext(request);
    const body = ImportBody.parse(request.body);
    const propertyId =
      body.propertyId !== undefined
        ? body.propertyId
        : await resolvePropertyId(auth, headerPropertyId(request));
    return ok(await commitImport(tenantId, { ...body, propertyId }));
  });
};

export default financeAccountingRoutes;
