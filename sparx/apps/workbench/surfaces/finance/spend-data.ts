'use client';

// The spend half of Finance (docs/148) — the billable module's data layer.
//
// Money is CENTS on the wire, everywhere. The API sends integers so a rounding
// error cannot reach a ledger; `formatCents` is the only thing that divides.
//
// The money-IN hooks live beside these in payments-data / payouts-data /
// receivables-data and are deliberately separate: they read data the tenant
// already bought with a selling module, and they stay free.

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { apiErrorMessage } from '../../lib/api-error';
import { api } from '../../lib/api/client';
import { downloadServerFile } from '../../lib/api/download';
import { readMoney } from '../../lib/read-money';

/* ── Shapes ────────────────────────────────────────────────────────────────── */

export type ExpenseKind = 'cost_of_sale' | 'labor' | 'operating';

export interface ExpenseCategory {
  id: string;
  name: string;
  slug: string | null;
  kind: ExpenseKind;
  color: string | null;
  /** Seeded: renameable, never deletable — a deriver finds it by slug. */
  isSystem: boolean;
  exportCode: string | null;
  sortOrder: number;
  archivedAt: string | null;
}

export interface Vendor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  accountRef: string | null;
  paymentTerms: string | null;
  supplierId: string | null;
  companyId: string | null;
  notes: string | null;
  archivedAt: string | null;
  /** Only present when the list was asked for it — an extra aggregate per row. */
  spendCents: number | null;
}

export interface ExpenseAllocation {
  id: string;
  targetType: 'order' | 'booking' | 'customer' | 'product' | 'site';
  targetId: string;
  targetLabel: string | null;
  amountCents: number;
}

export interface Expense {
  id: string;
  propertyId: string | null;
  description: string;
  amountCents: number;
  currency: string;
  taxCents: number;
  incurredAt: string;
  paidAt: string | null;
  dueAt: string | null;
  paymentMethod: string | null;
  reference: string | null;
  notes: string | null;
  source: string;
  /** False for a derived row — it is corrected at its source, not here. */
  editable: boolean;
  exportedAt: string | null;
  externalRef: string | null;
  category: { id: string; name: string; kind: ExpenseKind; color: string | null } | null;
  vendor: { id: string; name: string } | null;
  allocations: ExpenseAllocation[];
  allocatedCents: number;
  /** Spend left on the business rather than a job — overhead. */
  unallocatedCents: number;
  attachments: { id: string; assetId: string; key: string | null; filename: string | null }[];
  createdAt: string;
  updatedAt: string;
}

export interface ExpensePage {
  items: Expense[];
  nextCursor: string | null;
  /** The FILTER's total, not the page's — it must not move as someone scrolls. */
  totalCents: number;
  /** How many costs match the FILTER, same whole-set grain as `totalCents`.
   *  Ask for one row and read this when the only question is "is this period
   *  empty?" — paging the lot to count them is the same answer, slower. */
  totalCount: number;
}

export interface RecurringExpense {
  id: string;
  propertyId: string | null;
  name: string;
  categoryId: string;
  vendorId: string | null;
  amountCents: number;
  currency: string;
  cadence: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual';
  dayOfMonth: number | null;
  startsOn: string;
  endsOn: string | null;
  nextRunOn: string | null;
  lastGeneratedOn: string | null;
  autoGenerate: boolean;
  isActive: boolean;
  notes: string | null;
}

export interface ProfitFigures {
  revenueCents: number;
  cogsCents: number;
  feeCents: number;
  costOfSaleCents: number;
  laborCents: number;
  operatingCents: number;
  unallocatedCents: number;
  grossProfitCents: number;
  netProfitCents: number;
  /** When these figures were last worked out — null when they never have been.
   *  NOT when the browser last fetched: the rollup is rebuilt once a day, so the
   *  two are hours apart and only this one is about the numbers. */
  computedAt: string | null;
}

export interface ProfitResponse {
  range: { from: string; to: string };
  current: ProfitFigures;
  /** The same span immediately before, for "vs last period". */
  previous: ProfitFigures;
  series: { bucket: string; revenueCents: number; netProfitCents: number }[] | null;
}

export interface AccountingProvider {
  provider: string;
  name: string;
  connect: 'oauth' | 'file';
  availability: 'available' | 'coming_soon';
  unavailableReason?: string;
  blurb: string;
  exportColumns: string[];
}

/**
 * Mirrors `PublicAccountingConnection` in `@wizeworks/finance` — the server's
 * allow-list projection, not the database row. The row carries the encrypted
 * access and refresh tokens and never crosses the wire.
 *
 * `connected` is the field to branch on, NOT `status`. A row is written with
 * `status: 'active'` the moment somebody presses Connect, which is before the
 * provider has been anywhere near it — so `status` says "this row is in use"
 * and only `connected` says "there is a grant behind it". Reading sign-in off
 * `status` is how a screen tells someone they are connected to QuickBooks when
 * they abandoned the consent page ten minutes ago.
 */
export interface AccountingConnection {
  id: string;
  provider: string;
  propertyId: string | null;
  status: string;
  displayName: string | null;
  externalId: string | null;
  syncCadence: string;
  syncFromDate: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastError: unknown;
  connected: boolean;
  tokenExpiresAt: string | null;
}

export interface ImportPreviewRow {
  line: number;
  incurredAt: string | null;
  description: string;
  amountCents: number | null;
  vendorName: string | null;
  reference: string | null;
  categoryName: string | null;
  error: string | null;
}

export interface ImportPreview {
  rows: ImportPreviewRow[];
  headers: string[];
  validCount: number;
  errorCount: number;
  totalCents: number;
}

export interface SyncRun {
  id: string;
  direction: string;
  scope: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  recordsTotal: number;
  recordsSynced: number;
  recordsSkipped: number;
  recordsFailed: number;
  errorMessage: string | null;
}

/** Where a job's revenue figure came from. An order knows what it collected; a
 *  booking only knows the service's list price, and the two must never be shown
 *  as if they were the same kind of fact (docs/148 §5). */
export type RevenueBasis = 'collected' | 'list_price';

export interface JobProfit {
  type: 'order' | 'booking';
  id: string;
  label: string;
  customerName: string | null;
  propertyId: string | null;
  occurredAt: string;
  currency: string;
  revenueCents: number;
  revenueBasis: RevenueBasis;
  cogsCents: number;
  /** Things this job sold whose cost was never recorded. Above zero, the cost
   *  and margin are not known and `marginRate` is null (persona issue 924). */
  uncostedLines: number;
  feeCents: number;
  allocatedCents: number;
  marginCents: number;
  /** Null when there is no revenue to divide by — NOT zero. See the server. */
  marginRate: number | null;
}

/* ── Filters ───────────────────────────────────────────────────────────────── */

export interface ExpenseFilters {
  categoryId?: string;
  vendorId?: string;
  from?: string;
  to?: string;
  unpaidOnly?: boolean;
  search?: string;
  limit?: number;
  cursor?: string;
}

const SPEND_KEY = ['finance', 'spend'] as const;

/* ── Reads ─────────────────────────────────────────────────────────────────── */

export function useExpenses(filters: ExpenseFilters) {
  return useQuery({
    queryKey: [...SPEND_KEY, 'expenses', filters],
    queryFn: () =>
      api.get<ExpensePage>('/v1/finance/expenses', {
        ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(filters.vendorId ? { vendorId: filters.vendorId } : {}),
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
        ...(filters.unpaidOnly ? { unpaidOnly: 'true' } : {}),
        ...(filters.search ? { search: filters.search } : {}),
        ...(filters.cursor ? { cursor: filters.cursor } : {}),
        limit: String(filters.limit ?? 50),
      }),
    placeholderData: (previous) => previous,
  });
}

export function useExpense(id: string) {
  return useQuery({
    queryKey: [...SPEND_KEY, 'expense', id],
    queryFn: () => api.get<Expense>(`/v1/finance/expenses/${encodeURIComponent(id)}`),
    enabled: id !== 'new',
  });
}

export function useExpenseCategories(includeArchived = false) {
  return useQuery({
    queryKey: [...SPEND_KEY, 'categories', includeArchived],
    queryFn: () =>
      api.get<ExpenseCategory[]>(
        '/v1/finance/categories',
        includeArchived ? { includeArchived: 'true' } : {}
      ),
  });
}

export function useVendors(opts: { withSpend?: boolean; includeArchived?: boolean } = {}) {
  return useQuery({
    queryKey: [...SPEND_KEY, 'vendors', opts],
    queryFn: () =>
      api.get<Vendor[]>('/v1/finance/vendors', {
        ...(opts.withSpend ? { withSpend: 'true' } : {}),
        ...(opts.includeArchived ? { includeArchived: 'true' } : {}),
      }),
  });
}

export function useRecurring(includeInactive = false) {
  return useQuery({
    queryKey: [...SPEND_KEY, 'recurring', includeInactive],
    queryFn: () =>
      api.get<RecurringExpense[]>(
        '/v1/finance/recurring',
        includeInactive ? { includeInactive: 'true' } : {}
      ),
  });
}

export function useProfit(range: { from: string; to: string; series?: boolean }) {
  return useQuery({
    queryKey: [...SPEND_KEY, 'profit', range],
    queryFn: () =>
      api.get<ProfitResponse>('/v1/finance/profit', {
        from: range.from,
        to: range.to,
        ...(range.series ? { series: 'true' } : {}),
      }),
    placeholderData: (previous) => previous,
  });
}

export interface JobProfitFilters {
  from: string;
  to: string;
  sort?: 'margin_asc' | 'margin_desc' | 'revenue_desc' | 'recent';
  types?: ('order' | 'booking')[];
  limit?: number;
}

export function useJobProfit(filters: JobProfitFilters) {
  return useQuery({
    queryKey: [...SPEND_KEY, 'jobs', filters],
    queryFn: () =>
      // `openBookings`: appointments that happened and were never closed (issue 926).
      api.get<{ jobs: JobProfit[]; openBookings?: number }>('/v1/finance/jobs', {
        from: filters.from,
        to: filters.to,
        sort: filters.sort ?? 'margin_asc',
        ...(filters.types?.length ? { types: filters.types.join(',') } : {}),
        limit: String(filters.limit ?? 100),
      }),
    placeholderData: (previous) => previous,
  });
}

export function useAccounting() {
  return useQuery({
    queryKey: [...SPEND_KEY, 'accounting'],
    queryFn: () =>
      api.get<{ catalog: AccountingProvider[]; connections: AccountingConnection[] }>(
        '/v1/finance/accounting'
      ),
  });
}

export interface AccountingMapping {
  id: string;
  sparxType: string;
  sparxId: string;
  categoryId: string | null;
  externalId: string;
  externalName: string | null;
  externalCode: string | null;
}

export function useMappings(connectionId: string | null) {
  return useQuery({
    queryKey: [...SPEND_KEY, 'accounting', 'mappings', connectionId],
    queryFn: () =>
      api.get<AccountingMapping[]>(
        `/v1/finance/accounting/${encodeURIComponent(connectionId ?? '')}/mappings`
      ),
    enabled: connectionId !== null,
  });
}

export function useSyncRuns(connectionId: string | null) {
  return useQuery({
    queryKey: [...SPEND_KEY, 'accounting', 'runs', connectionId],
    queryFn: () =>
      api.get<SyncRun[]>(`/v1/finance/accounting/${encodeURIComponent(connectionId ?? '')}/runs`),
    enabled: connectionId !== null,
  });
}

/* ── Writes ────────────────────────────────────────────────────────────────── */

/** Everything spend-related shares one cache root, so any write refreshes the
 *  list, the bills screen AND the profit figure together. They are three views of
 *  one number; letting them disagree for a render is how a total looks broken. */
function useInvalidateSpend() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: SPEND_KEY });
}

export interface ExpenseDraft {
  categoryId: string;
  vendorId: string | null;
  description: string;
  amountCents: number;
  currency: string;
  taxCents: number;
  incurredAt: string;
  paidAt: string | null;
  dueAt: string | null;
  paymentMethod: string | null;
  reference: string | null;
  notes: string | null;
  allocations: {
    targetType: string;
    targetId: string;
    targetLabel: string | null;
    amountCents: number;
  }[];
  attachmentAssetIds: string[];
}

export function useSaveExpense(id: string) {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: (draft: ExpenseDraft) =>
      id === 'new'
        ? api.post<Expense>('/v1/finance/expenses', draft)
        : api.patch<Expense>(`/v1/finance/expenses/${encodeURIComponent(id)}`, draft),
    onSuccess: invalidate,
  });
}

export function useSetExpensePaid() {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: (input: { id: string; paidAt: string | null; paymentMethod?: string | null }) =>
      api.post<Expense>(`/v1/finance/expenses/${encodeURIComponent(input.id)}/paid`, {
        paidAt: input.paidAt,
        paymentMethod: input.paymentMethod ?? null,
      }),
    onSuccess: invalidate,
  });
}

export function useDeleteExpense() {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/finance/expenses/${encodeURIComponent(id)}`),
    onSuccess: invalidate,
  });
}

export function useSaveVendor(id: string | null) {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: (draft: Partial<Vendor> & { name: string }) =>
      id
        ? api.patch<Vendor>(`/v1/finance/vendors/${encodeURIComponent(id)}`, draft)
        : api.post<Vendor>('/v1/finance/vendors', draft),
    onSuccess: invalidate,
  });
}

export function useArchiveVendor() {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: (input: { id: string; archived: boolean }) =>
      api.post<Vendor>(`/v1/finance/vendors/${encodeURIComponent(input.id)}/archive`, {
        archived: input.archived,
      }),
    onSuccess: invalidate,
  });
}

export function useSaveCategory(id: string | null) {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: (draft: { name: string; kind: ExpenseKind; color?: string | null }) =>
      id
        ? api.patch<ExpenseCategory>(`/v1/finance/categories/${encodeURIComponent(id)}`, draft)
        : api.post<ExpenseCategory>('/v1/finance/categories', draft),
    onSuccess: invalidate,
  });
}

export function useArchiveCategory() {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: (input: { id: string; archived: boolean }) =>
      api.post<ExpenseCategory>(`/v1/finance/categories/${encodeURIComponent(input.id)}/archive`, {
        archived: input.archived,
      }),
    onSuccess: invalidate,
  });
}

export function useDeleteCategory() {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/finance/categories/${encodeURIComponent(id)}`),
    onSuccess: invalidate,
  });
}

export function useSaveRecurring(id: string | null) {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: (draft: Record<string, unknown>) =>
      id
        ? api.patch<RecurringExpense>(`/v1/finance/recurring/${encodeURIComponent(id)}`, draft)
        : api.post<RecurringExpense>('/v1/finance/recurring', draft),
    onSuccess: invalidate,
  });
}

export function useDeleteRecurring() {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/finance/recurring/${encodeURIComponent(id)}`),
    onSuccess: invalidate,
  });
}

export function useGenerateRecurring() {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: () =>
      api.post<{ templates: number; generated: number }>('/v1/finance/recurring/generate', {}),
    onSuccess: invalidate,
  });
}

/** Rebuild the profit rollup for a range. The rollup is a cache of a subtraction,
 *  so this is always safe — an owner who just entered a bill expects the number to
 *  move, and waiting for tonight's worker is not an answer. */
export function useRecomputeProfit() {
  const invalidate = useInvalidateSpend();
  return useMutation({
    meta: { running: 'work your profit out again' },
    mutationFn: (range: { from: string; to: string }) =>
      api.post<{ recomputed: number }>('/v1/finance/profit/recompute', range),
    onSuccess: invalidate,
  });
}

export interface ConnectionDraft {
  provider: string;
  displayName?: string | null;
  syncCadence?: 'manual' | 'daily' | 'weekly';
  syncFromDate?: string | null;
  syncExpenses?: boolean;
  syncInvoices?: boolean;
  syncPayments?: boolean;
}

export function useSaveConnection() {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: (draft: ConnectionDraft) =>
      api.put<AccountingConnection>('/v1/finance/accounting', draft),
    onSuccess: invalidate,
  });
}

export function useDeleteConnection() {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/finance/accounting/${encodeURIComponent(id)}`),
    onSuccess: invalidate,
  });
}

/* ── The OAuth round trip ───────────────────────────────────────────────────
 *
 * Three calls, in this order, and the order is forced by the server: the
 * connection ROW must exist before the redirect, because its id rides inside the
 * signed `state` and is where the callback puts the grant. A connect abandoned
 * at the consent screen therefore leaves a visible, deletable row rather than
 * nothing — the difference between "I started this and stopped" and a screen
 * that forgot it happened.
 *
 *   useSaveConnection()        → create/find the row              (editor)
 *   useStartAccountingConnect  → { url } to send the browser to   (admin)
 *   useCompleteAccountingConnect → exchange the code, store grant (admin)
 *
 * All three are admin-gated server-side except the row write. That is deliberate:
 * reading the screen is `viewer`, changing the books-closed date is `editor`, and
 * attaching a company's accounts to this tenant is `admin`.
 */

/** Ask the server where to send the browser. `redirectUri` must match the one
 *  registered with the vendor EXACTLY and is replayed at token exchange, so it
 *  is sent by the app that owns the origin rather than guessed on the server. */
export function useStartAccountingConnect() {
  return useMutation({
    mutationFn: ({ id, redirectUri }: { id: string; redirectUri: string }) =>
      api.post<{ url: string }>(`/v1/finance/accounting/${encodeURIComponent(id)}/connect`, {
        redirectUri,
      }),
  });
}

/** Hand back what the provider returned. `params` carries everything else on the
 *  callback query — QuickBooks puts the company file id in `realmId` there and
 *  nowhere else, and without it every later request 401s. */
export function useCompleteAccountingConnect() {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: (input: { code: string; state: string; params?: Record<string, string> }) =>
      api.post<AccountingConnection>('/v1/finance/accounting/callback', input),
    onSuccess: invalidate,
  });
}

/** Forget the grant, keep the row, the mapping table and the history — all three
 *  are work somebody did, and reconnecting should not ask them to redo it. */
export function useDisconnectAccounting() {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ disconnected: boolean }>(
        `/v1/finance/accounting/${encodeURIComponent(id)}/disconnect`,
        {}
      ),
    onSuccess: invalidate,
  });
}

export interface MappingDraft {
  sparxType: 'expense_category' | 'tax_rate' | 'payment_method' | 'income_account' | 'vendor';
  sparxId: string;
  categoryId?: string | null;
  externalId: string;
  externalName?: string | null;
  externalCode?: string | null;
}

export function useSaveMappings(connectionId: string) {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: (mappings: MappingDraft[]) =>
      api.put<{ saved: number }>(
        `/v1/finance/accounting/${encodeURIComponent(connectionId)}/mappings`,
        { mappings }
      ),
    onSuccess: invalidate,
  });
}

/**
 * Download the accounting export.
 *
 * `downloadServerFile` rather than `api.*`, because the export route answers
 * with a FILE and the shared client unwraps a JSON envelope, which would throw
 * on a CSV body. It resolves the API origin and a live bearer token at click
 * time, so a long-open pane cannot download from the wrong place or with a dead
 * token, and it rebuilds a refusal as a real `ApiError` so `spendErrorMessage`
 * shows the server's own sentence.
 *
 * Returns the number of rows the server left out. That count arrives in a header
 * because a download cannot carry a warning, and dropping it on the floor is how
 * an export silently omits the month before the books were closed.
 */
export async function downloadAccountingExport(params: {
  provider: string;
  from: string;
  to: string;
  connectionId?: string | null;
  markSent?: boolean;
}): Promise<{ filename: string; rowCount: number; skipped: number }> {
  const query = new URLSearchParams({
    provider: params.provider,
    from: params.from,
    to: params.to,
    ...(params.connectionId ? { connectionId: params.connectionId } : {}),
    ...(params.markSent ? { markSent: 'true' } : {}),
  });

  const { filename, headers } = await downloadServerFile(
    `/v1/finance/accounting/export?${query.toString()}`,
    'expenses.csv'
  );

  const skipped = Number(headers.get('x-sparx-skipped-rows') ?? '0');
  // How many rows the file actually carries. A header-only CSV downloads exactly
  // like a full one, so without this the caller cannot tell a person which they
  // just got — and "every cost in that period is in the file" is technically
  // true of an empty one, which is the worst kind of true.
  const rows = Number(headers.get('x-sparx-row-count') ?? 'NaN');

  return {
    filename,
    // -1, not 0, when the header is absent: an older server that does not send
    // it has told us NOTHING about the row count, and reporting that as "no
    // costs" would invent the very claim this exists to stop.
    rowCount: Number.isFinite(rows) ? rows : -1,
    skipped: Number.isFinite(skipped) ? skipped : 0,
  };
}

export function useImportPreview() {
  return useMutation({
    meta: { running: 'read that file' },
    mutationFn: (body: Record<string, unknown>) =>
      api.post<ImportPreview>('/v1/finance/accounting/import/preview', body),
  });
}

export function useCommitImport() {
  const invalidate = useInvalidateSpend();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post<{ imported: number; skipped: number; errors: { line: number; message: string }[] }>(
        '/v1/finance/accounting/import',
        body
      ),
    onSuccess: invalidate,
  });
}

/* ── Errors ────────────────────────────────────────────────────────────────── */

/** The server's own sentence for a 4xx, verbatim — these routes name the real
 *  problem ("That category is still used by 12 costs") far better than anything
 *  this side could infer from a status code. A 5xx carries no such sentence. */
export function spendErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/**
 * A typed money string → integer cents, or null if it isn't money.
 *
 * This used to be its own parser, and it threw every comma away before looking:
 * `.replace(/[,\s]/g, '')` reads "1,250" as twelve hundred and fifty, which is
 * right, and "46,80" as four thousand six hundred and eighty, which is a cost a
 * hundred times over, recorded without a murmur (issue 488). It kept the exact
 * string arithmetic that `Math.round(Number(x) * 100)` gets wrong on three
 * decimals — so THAT moved into `readMoney`, and this now asks it, which knows
 * which of `.` and `,` separates the cents in the text in front of it.
 */
export function parseMoneyToCents(input: string): number | null {
  if (input.trim() === '') return null;
  const { amount } = readMoney(input, { allowZero: true });
  return amount === null ? null : Math.round(amount * 100);
}

/** Cents → the string a money input shows. Fixed two places, no separators —
 *  a grouped "1,234.00" cannot be typed back in without stripping it first. */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}
