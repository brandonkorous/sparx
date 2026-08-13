'use client';

// The spend half of Finance (docs/148) — the billable module's data layer.
//
// Money is CENTS on the wire, everywhere. The API sends integers so a rounding
// error cannot reach a ledger; `formatCents` is the only thing that divides.
//
// The money-IN hooks live beside these in payments-data / payouts-data /
// receivables-data and are deliberately separate: they read data the tenant
// already bought with a selling module, and they stay free.

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import { api } from '../../lib/api/client';
import { getTokenState, resolveToken } from '../../lib/api/token';

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

export interface AccountingConnection {
  id: string;
  provider: string;
  propertyId: string | null;
  status: string;
  displayName: string | null;
  syncCadence: string;
  syncFromDate: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
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
      api.get<{ jobs: JobProfit[] }>('/v1/finance/jobs', {
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
 * A raw fetch rather than `api.*`, because the export route answers with a FILE
 * — the shared client unwraps a JSON envelope and would throw on a CSV body. The
 * two things it still has to borrow from the client are the resolved API origin
 * and a live bearer token, so a long-open pane cannot download with a dead one.
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
}): Promise<{ filename: string; skipped: number }> {
  const state = await getTokenState();
  const token = await resolveToken();

  const query = new URLSearchParams({
    provider: params.provider,
    from: params.from,
    to: params.to,
    ...(params.connectionId ? { connectionId: params.connectionId } : {}),
    ...(params.markSent ? { markSent: 'true' } : {}),
  });

  const response = await fetch(`${state.apiUrl}/v1/finance/accounting/export?${query.toString()}`, {
    headers: {
      authorization: `Bearer ${token}`,
      ...(state.propertyId ? { 'x-sparx-property-id': state.propertyId } : {}),
    },
  });

  if (!response.ok) {
    // The error path DOES answer JSON — the file body only exists on success.
    // Rebuilt as a real ApiError so `spendErrorMessage` treats it exactly like
    // any other 4xx and shows the server's own sentence.
    const detail = (await response.json().catch(() => null)) as {
      error?: { message?: string; code?: string; request_id?: string };
    } | null;
    throw new ApiError(response.status, {
      success: false,
      error: {
        message: detail?.error?.message ?? 'The export could not be built.',
        code: detail?.error?.code ?? 'EXPORT_FAILED',
        request_id: detail?.error?.request_id ?? '',
      },
    });
  }

  const disposition = response.headers.get('content-disposition') ?? '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'expenses.csv';
  const skipped = Number(response.headers.get('x-sparx-skipped-rows') ?? '0');

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  // Revoking immediately races the download in Safari; a tick is enough and the
  // object is tiny compared with leaking it for the pane's lifetime.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);

  return { filename, skipped: Number.isFinite(skipped) ? skipped : 0 };
}

export function useImportPreview() {
  return useMutation({
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
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/**
 * A typed money string → integer cents, or null if it isn't money.
 *
 * Pure string arithmetic, NOT `Math.round(Number(x) * 100)`. That shortcut is
 * wrong for three-decimal input — `Number('0.145') * 100` is 14.499999999999998,
 * so it rounds DOWN to 14¢ — and a form is exactly where a person types one.
 * (The same bug was found and fixed in the CSV importer; this is the UI half.)
 */
export function parseMoneyToCents(input: string): number | null {
  const trimmed = input.trim().replace(/[,\s]/g, '');
  if (trimmed === '') return null;
  const negative = trimmed.startsWith('-');
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  if (!/^\d*\.?\d*$/.test(unsigned) || !/\d/.test(unsigned)) return null;

  const [whole = '', fraction = ''] = unsigned.split('.');
  const wholeCents = (whole === '' ? 0 : Number(whole)) * 100;
  if (!Number.isSafeInteger(wholeCents)) return null;
  const cents = Number(`${fraction}00`.slice(0, 2));
  const roundUp = Number(fraction[2] ?? '0') >= 5 ? 1 : 0;
  const total = wholeCents + cents + roundUp;
  return negative ? -total : total;
}

/** Cents → the string a money input shows. Fixed two places, no separators —
 *  a grouped "1,234.00" cannot be typed back in without stripping it first. */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}
