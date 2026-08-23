// The stock side of the accounting handoff (docs/146 Phase 10.7–10.8).
//
//   GET  /v1/inventory/accounting/journal?from=&to=      — what would be posted
//   POST /v1/inventory/accounting/journal                — post it
//   GET  /v1/inventory/accounting/accounts?connection_id — their chart of accounts
//   POST /v1/inventory/accounting/balance                — pull the inventory
//                                                          account's balance into
//                                                          a reconciliation snapshot
//
// ── Why this lives under /inventory and not under /finance ───────────────────
//
// The CONNECTION is finance's — one OAuth grant per accounting package per
// business, configured on the Accounting settings screen (docs/148 §6), and
// these routes take its id rather than owning one. What is inventory's is the
// journal: which movements became cost, which became shrinkage, which were a
// transfer that posts nothing. A finance route computing that would need to know
// the stock ledger's reason vocabulary, and then two modules would own it.
//
// ── The role mapping, and why it is a separate `sparxType` ───────────────────
//
// Finance's mapping table maps EXPENSE CATEGORIES to accounts. A stock journal
// maps five fixed ROLES — the asset, cost of goods, accrued purchases,
// shrinkage, corrections — which are not categories and never will be. They ride
// the same table under `sparxType: 'inventory_account'` because the table was
// built loosely-keyed for exactly this (docs/148 §6: "the mappable set grows"),
// and a sixth nullable FK column per concept is the thing that design avoided.
//
// ── The gate ─────────────────────────────────────────────────────────────────
//
// Nothing is posted unless the entry balances, every role it uses is mapped, and
// the period is outside the tenant's closed months. All three are checked BEFORE
// the request leaves, because the alternative is discovering an unmapped account
// halfway through writing somebody's books.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { JOURNAL_ACCOUNT_ROLES } from '@wizeworks/commerce-schemas';
import { inventoryService } from '@wizeworks/inventory';
import {
  accountingAdapter,
  listConnections,
  listMappings,
  loadCredentials,
  recordSyncRun,
  setMappings,
} from '@wizeworks/finance';
import { ok } from '@wizeworks/api-core/envelope';
import { badRequest, notFound } from '@wizeworks/api-core/errors';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';

/** The `sparxType` these five rows use in the shared mapping table. */
const MAPPING_TYPE = 'inventory_account';

const JournalQuery = z.object({
  connection_id: z.string().uuid(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  warehouse_id: z.string().uuid().optional(),
});

const PostJournalBody = z.object({
  connection_id: z.string().uuid(),
  from: z.string().datetime(),
  to: z.string().datetime(),
  warehouse_id: z.string().uuid().optional(),
});

const AccountsQuery = z.object({ connection_id: z.string().uuid() });

const RoleMappingBody = z.object({
  connection_id: z.string().uuid(),
  mappings: z
    .array(
      z.object({
        role: z.enum(JOURNAL_ACCOUNT_ROLES),
        externalId: z.string().trim().min(1).max(200),
        externalName: z.string().trim().max(255).optional(),
        externalCode: z.string().trim().max(60).optional(),
      })
    )
    .max(20),
});

const BalanceBody = z.object({
  connection_id: z.string().uuid(),
  as_of: z.string().datetime().optional(),
  /** Their account for the stock asset. Defaults to whatever the `inventory`
   *  role is mapped to, which is the account this is about in every real case. */
  account_external_id: z.string().trim().min(1).max(200).optional(),
  account_name: z.string().trim().min(1).max(200).optional(),
});

const DAY_MS = 24 * 60 * 60 * 1000;

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventoryAccountingRoutes: FastifyPluginAsync = async (app) => {
  // What would be posted, and whether it can be. A read, always — the whole
  // point is to look before sending.
  app.get('/v1/inventory/accounting/journal', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = JournalQuery.parse(request.query);
    const ctx = toInventoryContext(request);
    const { roles, closedThrough } = await loadRoleMapping(ctx.tenantId, q.connection_id);

    const to = q.to ? new Date(q.to) : new Date();
    const from = q.from ? new Date(q.from) : new Date(to.getTime() - 30 * DAY_MS);

    const preview = await inventoryService.previewInventoryJournal(
      ctx,
      { from, to, warehouseId: q.warehouse_id ?? null },
      { mappedRoles: new Set(Object.keys(roles)), booksClosedThrough: closedThrough }
    );
    return ok({ ...preview, mappedRoles: roles });
  });

  app.post('/v1/inventory/accounting/journal', async (request) => {
    await requireInventoryModule(request);
    // `admin`: this writes into somebody's books.
    requireRole(request, 'admin');
    const body = PostJournalBody.parse(request.body);
    const ctx = toInventoryContext(request);

    const { connection, credentials } = await loadCredentials(ctx.tenantId, body.connection_id);
    const adapter = accountingAdapter(connection.provider);
    if (!adapter) {
      throw badRequest(`We cannot post journals to ${connection.provider} yet.`);
    }

    const { roles, closedThrough } = await loadRoleMapping(ctx.tenantId, body.connection_id);
    const preview = await inventoryService.previewInventoryJournal(
      ctx,
      {
        from: new Date(body.from),
        to: new Date(body.to),
        warehouseId: body.warehouse_id ?? null,
      },
      { mappedRoles: new Set(Object.keys(roles)), booksClosedThrough: closedThrough }
    );

    if (!preview.gate.ok) {
      // The refusals are the response, not a generic 400 message. Each one names
      // something the owner can go and fix.
      throw badRequest(preview.gate.reasons.join(' '));
    }

    try {
      const posted = await adapter.postJournal(credentials, {
        journal: preview.journal,
        accounts: roles,
        reference: preview.reference,
        memo: preview.memo,
      });
      await recordSyncRun(ctx.tenantId, {
        connectionId: body.connection_id,
        direction: 'export',
        scope: 'invoices',
        trigger: 'manual',
        periodStart: new Date(body.from),
        periodEnd: new Date(body.to),
        recordsTotal: preview.journal.lines.length,
        recordsSynced: posted.alreadyPosted ? 0 : preview.journal.lines.length,
        recordsSkipped: posted.alreadyPosted ? preview.journal.lines.length : 0,
        recordsFailed: 0,
      });
      return ok({
        externalId: posted.externalId,
        alreadyPosted: posted.alreadyPosted,
        reference: preview.reference,
        journal: preview.journal,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The entry could not be sent';
      await recordSyncRun(ctx.tenantId, {
        connectionId: body.connection_id,
        direction: 'export',
        scope: 'invoices',
        trigger: 'manual',
        periodStart: new Date(body.from),
        periodEnd: new Date(body.to),
        recordsTotal: preview.journal.lines.length,
        recordsSynced: 0,
        recordsSkipped: 0,
        recordsFailed: preview.journal.lines.length,
        failures: [{ recordType: 'journal', code: 'post_failed', message }],
      });
      throw error;
    }
  });

  // Their chart of accounts, so the mapping screen offers real choices instead
  // of a free-text box (docs/148 §6 rule 2).
  app.get('/v1/inventory/accounting/accounts', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const q = AccountsQuery.parse(request.query);
    const ctx = toInventoryContext(request);
    const { connection, credentials } = await loadCredentials(ctx.tenantId, q.connection_id);
    const adapter = accountingAdapter(connection.provider);
    if (!adapter) {
      throw badRequest(`We cannot read the chart of accounts from ${connection.provider} yet.`);
    }
    const accounts = await adapter.listAccounts(credentials);
    return ok({ accounts, roles: JOURNAL_ACCOUNT_ROLES });
  });

  app.put('/v1/inventory/accounting/accounts', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const body = RoleMappingBody.parse(request.body);
    const ctx = toInventoryContext(request);
    const saved = await setMappings(
      ctx.tenantId,
      body.connection_id,
      body.mappings.map((mapping) => ({
        sparxType: MAPPING_TYPE,
        sparxId: mapping.role,
        externalId: mapping.externalId,
        ...(mapping.externalName ? { externalName: mapping.externalName } : {}),
        ...(mapping.externalCode ? { externalCode: mapping.externalCode } : {}),
      }))
    );
    return ok({ saved });
  });

  // Pull the inventory account's balance into a reconciliation snapshot (10.9).
  // This is the half of the reconciliation sparx cannot derive: it keeps no
  // ledger, so the figure has to come from theirs or from a person.
  app.post('/v1/inventory/accounting/balance', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const body = BalanceBody.parse(request.body);
    const ctx = toInventoryContext(request);
    const asOf = body.as_of ? new Date(body.as_of) : new Date();

    const { connection, credentials } = await loadCredentials(ctx.tenantId, body.connection_id);
    const adapter = accountingAdapter(connection.provider);
    if (!adapter) {
      throw badRequest(`We cannot read balances from ${connection.provider} yet.`);
    }

    const { roles, names } = await loadRoleMapping(ctx.tenantId, body.connection_id);
    const accountExternalId = body.account_external_id ?? roles.inventory;
    if (!accountExternalId) {
      throw badRequest(
        'Match your stock asset account to one in your books first — otherwise there is nothing to compare against.'
      );
    }

    const balance = await adapter.accountBalance(credentials, accountExternalId, asOf);
    if (!balance) {
      throw notFound('Account balance', accountExternalId);
    }

    const snapshot = await inventoryService.recordGlSnapshot(ctx, {
      asOf,
      accountName: body.account_name ?? names.inventory ?? accountExternalId,
      accountCode: accountExternalId,
      balanceCents: balance.balanceCents,
      currency: balance.currency,
      source: connection.provider === 'xero' ? 'xero' : 'quickbooks_online',
      connectionId: body.connection_id,
      note: `Read from ${connection.displayName ?? connection.provider}`,
    });

    return ok(snapshot);
  });
};

/**
 * The role → account map for one connection, plus the closed-books date.
 *
 * Returns the account ids keyed by role (what the adapter needs) and the account
 * NAMES keyed by role (what a person needs to read), because a screen showing
 * "1200" where it could show "Stock on hand" is a screen somebody has to
 * translate.
 */
async function loadRoleMapping(
  tenantId: string,
  connectionId: string
): Promise<{
  roles: Record<string, string>;
  names: Record<string, string>;
  closedThrough: Date | null;
}> {
  const mappings = await listMappings(tenantId, connectionId);
  const roles: Record<string, string> = {};
  const names: Record<string, string> = {};
  for (const mapping of mappings) {
    if (mapping.sparxType !== MAPPING_TYPE) continue;
    roles[mapping.sparxId] = mapping.externalId;
    if (mapping.externalName) names[mapping.sparxId] = mapping.externalName;
  }
  // The connection row is read through `listConnections` rather than
  // `loadCredentials`: this is a settings read, and `loadCredentials` refreshes
  // the OAuth token as a side effect. Refreshing a token to find out a date
  // would burn a refresh — which Xero rotates and invalidates — on a screen
  // that is only looking.
  const connections = await listConnections(tenantId);
  const connection = connections.find((c) => c.id === connectionId);
  if (!connection) throw notFound('Accounting connection', connectionId);

  return { roles, names, closedThrough: connection.syncFromDate };
}

export default inventoryAccountingRoutes;
