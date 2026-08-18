// The connection to the tenant's accounting system, its category↔account mapping,
// and the log of what each sync actually did (docs/148 §6).
//
// Only the `csv` provider is live today: it needs no OAuth app and it validates
// the whole export shape end to end. The OAuth providers are registered in the
// catalog as `coming_soon` so the panel can honestly say sparx will talk to them,
// with their connect control disabled and the reason shown — rather than a button
// that throws.

import {
  withTenant,
  type FinanceAccountingConnection,
  type FinanceAccountingMapping,
  type Prisma,
  type TxClient,
} from '@wizeworks/db';

import { FinanceError } from '../errors';
import type { AccountingProvider } from '../schemas';
import { exportColumns } from './export';
import { accountingProviderAvailability } from './providers';

export class AccountingConnectionNotFoundError extends FinanceError {
  constructor(id: string) {
    super('ACCOUNTING_CONNECTION_NOT_FOUND', `Accounting connection ${id} not found`);
    this.name = 'AccountingConnectionNotFoundError';
  }
}

export class AccountingProviderUnavailableError extends FinanceError {
  constructor(provider: string, reason: string) {
    super('ACCOUNTING_PROVIDER_UNAVAILABLE', reason);
    this.name = 'AccountingProviderUnavailableError';
    this.provider = provider;
  }
  readonly provider: string;
}

export interface AccountingProviderDescriptor {
  provider: AccountingProvider;
  name: string;
  /** oauth | file — decides whether connecting is a redirect or an upload. */
  connect: 'oauth' | 'file';
  availability: 'available' | 'coming_soon';
  unavailableReason?: string;
  blurb: string;
  /** What the exported file will contain, so nobody downloads to find out. */
  exportColumns: readonly string[];
}

/**
 * What a tenant can connect, and honestly whether they can connect it today.
 *
 * `coming_soon` is registered rather than hidden because "does sparx work with
 * Xero?" needs an answer on the screen, and "not yet, and here is what it will
 * do" is a better one than an empty list.
 */
export function accountingCatalog(): AccountingProviderDescriptor[] {
  const soon = (
    provider: AccountingProvider,
    name: string,
    connect: 'oauth' | 'file',
    blurb: string
  ): AccountingProviderDescriptor => ({
    provider,
    name,
    connect,
    availability: 'coming_soon',
    unavailableReason:
      connect === 'oauth'
        ? `Direct ${name} sync is not switched on yet. You can still export a file below and import it into ${name} today.`
        : `A one-click ${name} layout is not ready yet. The spreadsheet export below works with it today.`,
    blurb,
    exportColumns: exportColumns(provider),
  });

  /** A provider with a real adapter behind it. `coming_soon` only when this
   *  deployment has no OAuth app for the vendor. */
  const live = (
    provider: AccountingProvider,
    name: string,
    blurb: string
  ): AccountingProviderDescriptor => {
    const availability = accountingProviderAvailability(provider);
    return {
      provider,
      name,
      connect: 'oauth',
      availability: availability.available ? 'available' : 'coming_soon',
      ...(availability.reason ? { unavailableReason: availability.reason } : {}),
      blurb,
      exportColumns: exportColumns(provider),
    };
  };

  return [
    {
      provider: 'csv',
      name: 'Spreadsheet / your accountant',
      connect: 'file',
      availability: 'available',
      blurb:
        'Download your spending as a spreadsheet, with every column labelled. Works with any accounting package, and with an accountant who just wants the numbers.',
      exportColumns: exportColumns('csv'),
    },
    // QuickBooks and Xero have LIVE adapters (docs/146 Phase 10.7–10.8). Whether
    // a tenant can press connect depends on whether this installation has an
    // OAuth app registered with the vendor, which is an environment variable
    // rather than a feature — so availability is asked, not asserted, and the
    // export below stays the honest answer where it is not configured.
    live(
      'quickbooks_online',
      'QuickBooks Online',
      'Send stock journals, bills and expenses straight to QuickBooks Online.'
    ),
    live('xero', 'Xero', 'Send stock journals, bills and expenses straight to Xero.'),
    soon(
      'quickbooks_desktop',
      'QuickBooks Desktop',
      'file',
      'A file laid out for QuickBooks Desktop’s import.'
    ),
    soon('sage50', 'Sage 50 (Peachtree)', 'file', 'A file laid out for Sage 50’s import.'),
    soon('freshbooks', 'FreshBooks', 'oauth', 'Send expenses straight to FreshBooks.'),
    soon('wave', 'Wave', 'oauth', 'Send expenses straight to Wave.'),
  ];
}

export function assertProviderAvailable(provider: AccountingProvider): void {
  const descriptor = accountingCatalog().find((d) => d.provider === provider);
  if (!descriptor) throw new AccountingProviderUnavailableError(provider, 'Unknown provider');
  if (descriptor.availability !== 'available') {
    throw new AccountingProviderUnavailableError(
      provider,
      descriptor.unavailableReason ?? 'Not available yet'
    );
  }
}

export async function listConnections(
  tenantId: string,
  propertyId?: string | null
): Promise<FinanceAccountingConnection[]> {
  return withTenant({ tenantId }, (tx) =>
    tx.financeAccountingConnection.findMany({
      where: propertyId !== undefined ? { propertyId } : {},
      orderBy: { createdAt: 'asc' },
    })
  );
}

/**
 * A connection as the BROWSER may see it.
 *
 * `listConnections` returns the Prisma row, which carries `accessTokenEnc` and
 * `refreshTokenEnc`. Handing that row to `ok()` ships both ciphertexts to every
 * `viewer` who opens the accounting screen — they are encrypted, but a
 * credential nobody needs is a credential that should not be on the wire, and
 * the workbench's `AccountingConnection` interface listing nine safe fields does
 * not stop the server serialising all twenty. A type on the client is a claim
 * about the wire, never a filter on it.
 *
 * So the projection is an ALLOW-LIST, and it lives here rather than in the route:
 * a second consumer of `listConnections` should not have to rediscover which
 * fields are safe, and adding a column to the model must not silently widen what
 * the API returns.
 *
 * `connected` is the field the UI actually wants and cannot derive without the
 * secret: a row can exist with no grant behind it (created just before an OAuth
 * redirect the person then abandoned). Without it the screen has to infer
 * sign-in from `status`, which is `active` from the moment the row is written —
 * so a half-finished connect would read as connected, which is the exact class
 * of lie this module is careful about everywhere else.
 */
export interface PublicAccountingConnection {
  id: string;
  provider: string;
  propertyId: string | null;
  status: string;
  displayName: string | null;
  externalId: string | null;
  syncExpenses: boolean;
  syncInvoices: boolean;
  syncPayments: boolean;
  syncCadence: string;
  syncFromDate: Date | null;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  lastError: unknown;
  createdAt: Date;
  /** True only when a usable grant is stored. Never inferred from `status`. */
  connected: boolean;
  /** When the stored access token expires, for a "needs reconnecting" hint.
   *  The token itself never leaves the server. */
  tokenExpiresAt: Date | null;
}

export function toPublicConnection(row: FinanceAccountingConnection): PublicAccountingConnection {
  return {
    id: row.id,
    provider: row.provider,
    propertyId: row.propertyId,
    status: row.status,
    displayName: row.displayName,
    externalId: row.externalId,
    syncExpenses: row.syncExpenses,
    syncInvoices: row.syncInvoices,
    syncPayments: row.syncPayments,
    syncCadence: row.syncCadence,
    syncFromDate: row.syncFromDate,
    lastSyncAt: row.lastSyncAt,
    lastSyncStatus: row.lastSyncStatus,
    lastError: row.lastError,
    createdAt: row.createdAt,
    connected: row.accessTokenEnc !== null,
    tokenExpiresAt: row.tokenExpiresAt,
  };
}

/** The tenant's connections, safe to serialise. Prefer this over
 *  `listConnections` in anything that reaches a browser. */
export async function listPublicConnections(
  tenantId: string,
  propertyId?: string | null
): Promise<PublicAccountingConnection[]> {
  return (await listConnections(tenantId, propertyId)).map(toPublicConnection);
}

export interface UpsertConnectionInput {
  provider: AccountingProvider;
  propertyId?: string | null;
  displayName?: string | null;
  syncExpenses?: boolean;
  syncInvoices?: boolean;
  syncPayments?: boolean;
  syncCadence?: 'manual' | 'daily' | 'weekly';
  /** The tenant's books-closed date. Nothing before it is ever exported. */
  syncFromDate?: Date | null;
  settings?: Record<string, unknown>;
}

/**
 * Connect or reconfigure. Keyed on (tenant, site, provider) so reconnecting the
 * same package to the same business updates rather than accumulating.
 *
 * There is no compound-unique upsert here: the grain's unique index is NULLS NOT
 * DISTINCT (hand-SQL), which Prisma does not model, so a `where` on the triple
 * cannot address the tenant-wide (null-property) row. Find-then-write is exact.
 */
export async function upsertConnection(
  tenantId: string,
  input: UpsertConnectionInput
): Promise<FinanceAccountingConnection> {
  assertProviderAvailable(input.provider);
  const propertyId = input.propertyId ?? null;

  return withTenant({ tenantId }, async (tx) => {
    const existing = await tx.financeAccountingConnection.findFirst({
      where: { provider: input.provider, propertyId },
    });

    const data = {
      displayName: input.displayName ?? null,
      ...(input.syncExpenses !== undefined ? { syncExpenses: input.syncExpenses } : {}),
      ...(input.syncInvoices !== undefined ? { syncInvoices: input.syncInvoices } : {}),
      ...(input.syncPayments !== undefined ? { syncPayments: input.syncPayments } : {}),
      ...(input.syncCadence !== undefined ? { syncCadence: input.syncCadence } : {}),
      ...(input.syncFromDate !== undefined ? { syncFromDate: input.syncFromDate } : {}),
      ...(input.settings !== undefined
        ? { settings: input.settings as Prisma.InputJsonValue }
        : {}),
    };

    if (existing) {
      return tx.financeAccountingConnection.update({ where: { id: existing.id }, data });
    }
    return tx.financeAccountingConnection.create({
      data: { tenantId, propertyId, provider: input.provider, status: 'active', ...data },
    });
  });
}

export async function deleteConnection(tenantId: string, id: string): Promise<void> {
  await withTenant({ tenantId }, async (tx) => {
    const existing = await tx.financeAccountingConnection.findUnique({ where: { id } });
    if (!existing) throw new AccountingConnectionNotFoundError(id);
    await tx.financeAccountingConnection.delete({ where: { id } });
  });
}

/* ── Mapping ───────────────────────────────────────────────────────────────── */

export interface MappingInput {
  /** `inventory_account` maps the five ROLES a stock journal posts to (docs/146
   *  Phase 10.7) rather than an expense category. Same table by design — docs/148
   *  §6 built this loosely-keyed precisely so the mappable set could grow without
   *  a nullable FK column per concept. */
  sparxType:
    | 'expense_category'
    | 'tax_rate'
    | 'payment_method'
    | 'income_account'
    | 'vendor'
    | 'inventory_account';
  sparxId: string;
  categoryId?: string | null;
  externalId: string;
  externalName?: string | null;
  externalCode?: string | null;
}

export async function setMappings(
  tenantId: string,
  connectionId: string,
  mappings: readonly MappingInput[]
): Promise<number> {
  return withTenant({ tenantId }, async (tx) => {
    const connection = await tx.financeAccountingConnection.findUnique({
      where: { id: connectionId },
    });
    if (!connection) throw new AccountingConnectionNotFoundError(connectionId);

    for (const mapping of mappings) {
      await tx.financeAccountingMapping.upsert({
        where: {
          connectionId_sparxType_sparxId: {
            connectionId,
            sparxType: mapping.sparxType,
            sparxId: mapping.sparxId,
          },
        },
        update: {
          externalId: mapping.externalId,
          externalName: mapping.externalName ?? null,
          externalCode: mapping.externalCode ?? null,
          categoryId: mapping.categoryId ?? null,
        },
        create: {
          tenantId,
          connectionId,
          sparxType: mapping.sparxType,
          sparxId: mapping.sparxId,
          categoryId: mapping.categoryId ?? null,
          externalId: mapping.externalId,
          externalName: mapping.externalName ?? null,
          externalCode: mapping.externalCode ?? null,
        },
      });
    }
    return mappings.length;
  });
}

/**
 * Every mapping saved against a connection, for the settings screen to READ
 * BACK. `mappingsForExport` below answers a different question — it is the
 * narrow lookup the export needs and is keyed for that — and a settings surface
 * that could only write would leave someone unable to see what they had already
 * mapped, which is the state that makes people re-enter it.
 */
export async function listMappings(
  tenantId: string,
  connectionId: string
): Promise<FinanceAccountingMapping[]> {
  return withTenant({ tenantId }, (tx) =>
    tx.financeAccountingMapping.findMany({
      where: { connectionId },
      orderBy: [{ sparxType: 'asc' }, { createdAt: 'asc' }],
    })
  );
}

/** The category → account lookup `buildExport` takes. */
export async function mappingsForExport(
  tenantId: string,
  connectionId: string
): Promise<Map<string, { externalName?: string | null; externalCode?: string | null }>> {
  const rows = await withTenant({ tenantId }, (tx) =>
    tx.financeAccountingMapping.findMany({
      where: { connectionId, sparxType: 'expense_category' },
    })
  );
  return new Map(
    rows.map((r) => [r.sparxId, { externalName: r.externalName, externalCode: r.externalCode }])
  );
}

/* ── Sync runs ─────────────────────────────────────────────────────────────── */

export interface RecordRunInput {
  connectionId: string;
  direction: 'export' | 'import';
  scope: 'expenses' | 'invoices' | 'payments' | 'accounts' | 'vendors';
  trigger?: 'manual' | 'scheduled' | 'event';
  periodStart?: Date | null;
  periodEnd?: Date | null;
  recordsTotal: number;
  recordsSynced: number;
  recordsSkipped: number;
  recordsFailed: number;
  failures?: unknown;
}

/** Log a completed run. `partial` is a first-class outcome, not an error: the
 *  failure that matters is the 3 records out of 140 that bounced. */
export async function recordSyncRun(
  tenantId: string,
  input: RecordRunInput,
  tx?: TxClient
): Promise<void> {
  const status =
    input.recordsFailed === 0 ? 'success' : input.recordsSynced > 0 ? 'partial' : 'failed';

  const run = async (client: TxClient): Promise<void> => {
    await client.financeAccountingSyncRun.create({
      data: {
        tenantId,
        connectionId: input.connectionId,
        direction: input.direction,
        scope: input.scope,
        trigger: input.trigger ?? 'manual',
        status,
        periodStart: input.periodStart ?? null,
        periodEnd: input.periodEnd ?? null,
        recordsTotal: input.recordsTotal,
        recordsSynced: input.recordsSynced,
        recordsSkipped: input.recordsSkipped,
        recordsFailed: input.recordsFailed,
        failures: (input.failures ?? null) as Prisma.InputJsonValue,
        finishedAt: new Date(),
      },
    });
    await client.financeAccountingConnection.update({
      where: { id: input.connectionId },
      data: { lastSyncAt: new Date(), lastSyncStatus: status },
    });
  };

  if (tx) await run(tx);
  else await withTenant({ tenantId }, run);
}

export async function listSyncRuns(
  tenantId: string,
  connectionId: string,
  limit = 20
): Promise<unknown[]> {
  return withTenant({ tenantId }, (tx) =>
    tx.financeAccountingSyncRun.findMany({
      where: { connectionId },
      orderBy: { startedAt: 'desc' },
      take: limit,
    })
  );
}

/** Mark exported expenses so "what still needs sending" is an index scan rather
 *  than a diff against a remote list. */
export async function markExported(
  tenantId: string,
  from: Date,
  to: Date,
  propertyId?: string | null
): Promise<number> {
  return withTenant({ tenantId }, async (tx) => {
    const result = await tx.financeExpense.updateMany({
      where: {
        deletedAt: null,
        incurredAt: { gte: from, lte: to },
        ...(propertyId !== undefined && propertyId !== null ? { propertyId } : {}),
      },
      data: { exportedAt: new Date() },
    });
    return result.count;
  });
}
