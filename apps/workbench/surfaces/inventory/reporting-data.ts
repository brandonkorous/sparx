'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE FIGURES, WHO GETS THEM, AND THE BOOKS THEY HAVE TO AGREE WITH
// (docs/146 Phase 10)
//
// Five performance reports, the schedules that email them, the spreadsheet
// import, and the reconciliation against the tenant's accounting system.
//
// ── The one shape everything here shares ─────────────────────────────────
//
// A RATIO WHOSE DENOMINATOR NOBODY MEASURED IS NULL, NOT ZERO.
//
// This is the third phase in a row to need saying, and it bites hardest on a
// ratio, because a ratio hides its own inputs. "Fill rate 100%" reads exactly
// the same whether four thousand order lines shipped complete or nothing was
// ever recorded — and the second one is far more common in a young tenant.
//
// So every percentage below is `number | null`, every report carries a count of
// what it could NOT measure (`unmeasuredLines`, `uncostedUnits`,
// `unattributedUnits`), and every screen renders those counts as a sentence
// rather than dropping them. `formatPercent` returns "not measured" for null and
// never "0%".
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { api } from '../../lib/api/client';
import type { Tone } from './data';

/* ── The report catalogue ───────────────────────────────────────────────── */

export interface ReportCatalogEntry {
    key: string;
    label: string;
    description: string;
    /** True when the report covers a PERIOD rather than a moment — the schedule
     *  form only asks for a window for these. */
    windowed: boolean;
}

export interface SummaryLine {
    label: string;
    value: string;
    /** Set when the line reports something that could NOT be measured. Rendered
     *  apart from the statistics, because a missing number and a small number look
     *  identical in a column and mean opposite things. */
    isGap?: boolean;
}

export const reportingKeys = {
    all: ['inventory', 'reporting'] as const,
    catalog: () => [...reportingKeys.all, 'catalog'] as const,
    report: (key: string, filter: string) => [...reportingKeys.all, 'report', key, filter] as const,
    schedules: () => [...reportingKeys.all, 'schedules'] as const,
    schedule: (id: string) => [...reportingKeys.all, 'schedule', id] as const,
    imports: (status: string) => [...reportingKeys.all, 'imports', status] as const,
    importBatch: (id: string) => [...reportingKeys.all, 'import', id] as const,
    reconciliation: (asOf: string) => [...reportingKeys.all, 'reconciliation', asOf] as const,
    snapshots: () => [...reportingKeys.all, 'snapshots'] as const,
};

export function useReportCatalog() {
    return useQuery({
        queryKey: reportingKeys.catalog(),
        queryFn: () => api.get<{ reports: ReportCatalogEntry[] }>('/v1/inventory/reports/catalog'),
        staleTime: 5 * 60 * 1000,
    });
}

export interface ReportFilters {
    warehouseId?: string;
    supplierId?: string;
    days?: number;
    from?: string;
    to?: string;
    take?: number;
}

export interface ReportRun<T> {
    key: string;
    label: string;
    generatedAt: string;
    summary: SummaryLine[];
    rowCount: number;
    data: T;
}

function filterParams(filters: ReportFilters): Record<string, string | number> {
    return {
        ...(filters.warehouseId ? { warehouse_id: filters.warehouseId } : {}),
        ...(filters.supplierId ? { supplier_id: filters.supplierId } : {}),
        ...(filters.days !== undefined ? { days: filters.days } : {}),
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
        ...(filters.take !== undefined ? { take: filters.take } : {}),
    };
}

function filterKey(filters: ReportFilters): string {
    return [
        filters.warehouseId ?? '',
        filters.supplierId ?? '',
        filters.days ?? '',
        filters.from ?? '',
        filters.to ?? '',
        filters.take ?? '',
    ].join(':');
}

/** Run any report by key. One hook for eighteen reports, because the API is one
 *  endpoint over the registry — a hook per report would be the same list of
 *  names kept in step by hand for the fourth time. */
export function useReport<T>(key: string, filters: ReportFilters = {}, enabled = true) {
    return useQuery({
        queryKey: reportingKeys.report(key, filterKey(filters)),
        queryFn: () => api.get<ReportRun<T>>(`/v1/inventory/reports/${key}`, filterParams(filters)),
        enabled: enabled && key !== '',
        placeholderData: (previous) => previous,
    });
}

/** The CSV download URL for a report, with the filters the screen is showing.
 *  A link rather than a fetch: the browser's own download handling is better
 *  than anything we would build, and it survives a big file. */
export function reportCsvPath(key: string, filters: ReportFilters): string {
    const params = new URLSearchParams({ format: 'csv' });
    for (const [name, value] of Object.entries(filterParams(filters))) {
        params.set(name, String(value));
    }
    return `/v1/inventory/reports/${key}?${params.toString()}`;
}

/* ── The five performance reports ───────────────────────────────────────── */

export interface SellThroughRow {
    variantId: string;
    warehouseId: string;
    sku: string;
    title: string;
    warehouseCode: string;
    unitsSold: number;
    unitsOnHandAtEnd: number;
    unitsAvailable: number;
    sellThroughPct: number | null;
}

export interface SellThroughReport {
    range: { from: string; to: string };
    periodDays: number;
    totals: {
        unitsSold: number;
        unitsOnHandAtEnd: number;
        unitsAvailable: number;
        sellThroughPct: number | null;
    };
    rows: SellThroughRow[];
    inactiveLines: number;
}

export interface GmroiRow {
    variantId: string;
    sku: string;
    title: string;
    unitsSold: number;
    revenueCents: number;
    cogsCents: number;
    grossMarginCents: number;
    grossMarginPct: number | null;
    avgInventoryCostCents: number;
    gmroi: number | null;
    unattributedUnits: number;
}

export interface GmroiReport {
    range: { from: string; to: string };
    periodDays: number;
    currency: string;
    totals: {
        revenueCents: number;
        cogsCents: number;
        grossMarginCents: number;
        grossMarginPct: number | null;
        avgInventoryCostCents: number;
        gmroi: number | null;
    };
    averageFromDailyRollup: boolean;
    rows: GmroiRow[];
    unattributedUnits: number;
    uncostedUnits: number;
}

export interface FillRateVariantRow {
    variantId: string;
    sku: string;
    title: string;
    linesMeasured: number;
    linesShort: number;
    unitsOrdered: number;
    unitsShort: number;
    lineFillRatePct: number | null;
}

export interface FillRateReport {
    range: { from: string; to: string };
    periodDays: number;
    linesMeasured: number;
    linesFilledComplete: number;
    linesShort: number;
    unmeasuredLines: number;
    unitsOrdered: number;
    unitsShort: number;
    unitsFilled: number;
    lineFillRatePct: number | null;
    unitFillRatePct: number | null;
    worstVariants: FillRateVariantRow[];
}

export interface StockoutRow {
    variantId: string;
    warehouseId: string;
    sku: string;
    title: string;
    warehouseCode: string;
    episodeCount: number;
    daysOut: number;
    currentlyOut: boolean;
    availabilityPct: number | null;
    unmeasuredMovements: number;
}

export interface StockoutFrequencyReport {
    range: { from: string; to: string };
    periodDays: number;
    rows: StockoutRow[];
    linesAffected: number;
    totalEpisodes: number;
    unmeasuredLines: number;
}

export interface MovementSummaryRow {
    reason: string;
    group: 'inbound' | 'sold' | 'lost' | 'corrected' | 'internal';
    movements: number;
    unitsIn: number;
    unitsOut: number;
    netUnits: number;
    costCents: number | null;
}

export interface MovementSummaryReport {
    range: { from: string; to: string };
    periodDays: number;
    currency: string;
    rows: MovementSummaryRow[];
    totalMovements: number;
    totalUnitsIn: number;
    totalUnitsOut: number;
    netUnits: number;
    uncostedMovements: number;
}

/* ── Scheduled delivery ─────────────────────────────────────────────────── */

export interface ReportSchedule {
    id: string;
    reportKey: string;
    reportLabel: string;
    name: string;
    cadence: 'daily' | 'weekly' | 'monthly';
    dayOfWeek: number | null;
    dayOfMonth: number | null;
    hour: number;
    timezone: string;
    recipients: string[];
    format: 'csv' | 'summary';
    filters: ReportFilters;
    isActive: boolean;
    nextRunAt: string | null;
    lastRunAt: string | null;
    lastRunStatus: string | null;
    consecutiveFailures: number;
    /** True when repeated failures stopped it. The screen says so — an inactive
     *  switch with no explanation is a support ticket. */
    pausedByFailures: boolean;
    createdAt: string;
}

export interface ReportDelivery {
    id: string;
    status: 'success' | 'partial' | 'failed' | 'skipped';
    trigger: 'scheduled' | 'manual';
    recipients: string[];
    rowCount: number | null;
    periodStart: string | null;
    periodEnd: string | null;
    error: string | null;
    sentAt: string;
}

export interface ReportScheduleDetail extends ReportSchedule {
    deliveries: ReportDelivery[];
}

export function useReportSchedules() {
    return useQuery({
        queryKey: reportingKeys.schedules(),
        queryFn: () => api.list<ReportSchedule>('/v1/inventory/report-schedules'),
    });
}

export function useReportSchedule(id: string) {
    return useQuery({
        queryKey: reportingKeys.schedule(id),
        queryFn: () => api.get<ReportScheduleDetail>(`/v1/inventory/report-schedules/${id}`),
        enabled: id !== '' && id !== 'new',
    });
}

function useInvalidateSchedules() {
    const queryClient = useQueryClient();
    return () => {
        void queryClient.invalidateQueries({ queryKey: reportingKeys.all });
    };
}

export interface ReportScheduleInput {
    reportKey: string;
    name: string;
    cadence: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    hour: number;
    timezone: string;
    recipients: string[];
    format: 'csv' | 'summary';
    filters: ReportFilters;
    isActive: boolean;
}

export function useCreateReportSchedule() {
    const invalidate = useInvalidateSchedules();
    return useMutation({
        mutationFn: (input: ReportScheduleInput) =>
            api.post<ReportSchedule>('/v1/inventory/report-schedules', input),
        onSuccess: invalidate,
    });
}

export function useUpdateReportSchedule(id: string) {
    const invalidate = useInvalidateSchedules();
    return useMutation({
        mutationFn: (input: Partial<ReportScheduleInput>) =>
            api.patch<ReportSchedule>(`/v1/inventory/report-schedules/${id}`, input),
        onSuccess: invalidate,
    });
}

export function useDeleteReportSchedule() {
    const invalidate = useInvalidateSchedules();
    return useMutation({
        mutationFn: (id: string) => api.delete<void>(`/v1/inventory/report-schedules/${id}`),
        onSuccess: invalidate,
    });
}

export interface DeliveryResult {
    scheduleId: string;
    status: 'success' | 'partial' | 'failed' | 'skipped';
    recipients: number;
    rowCount: number | null;
    error: string | null;
}

/** Send it now. The identical path a scheduled run takes, which is the only
 *  reason it is worth having — a test send down a different route tests
 *  nothing. */
export function useRunReportSchedule(id: string) {
    const invalidate = useInvalidateSchedules();
    return useMutation({
        mutationFn: () => api.post<DeliveryResult>(`/v1/inventory/report-schedules/${id}/run`, {}),
        onSuccess: invalidate,
    });
}

/* ── The spreadsheet import ─────────────────────────────────────────────── */

export interface ImportRowPlan {
    /** 1-based, counting the header as line 1 — matches what the operator sees
     *  when they open the file to fix it. */
    line: number;
    sku: string | null;
    variantId: string | null;
    warehouseId: string | null;
    /** `skipped` is a person's decision, not a parse result (docs/146 Phase
     *  11.3) — a row that could have been applied and deliberately was not.
     *  Distinct from `no_change`: "we left it out" and "it was already right"
     *  look identical in a total and mean opposite things. */
    outcome: 'apply' | 'no_change' | 'error' | 'skipped';
    currentOnHand: number | null;
    newOnHand: number | null;
    delta: number;
    error: string | null;
    /** The item name the file carried, so a row whose code matches nothing can
     *  offer to create it with a name rather than with a bare code. */
    name?: string | null;
    unitCostCents?: number | null;
    customFields?: Record<string, unknown>;
    resolution?: 'skip' | 'match' | 'create';
}

/** The dry-run headline, recomputed from the stored plan so it always agrees
 *  with the rows on screen: "412 matched, 18 new items, 6 to sort out". */
export interface ImportPlanSummary {
    totalRows: number;
    applyCount: number;
    noChangeCount: number;
    errorCount: number;
    skippedCount: number;
    matchedCount: number;
    newItemCount: number;
    unitsChanged: number;
}

export interface ImportBatch {
    id: string;
    kind: string;
    status: 'planned' | 'applied' | 'discarded' | 'failed';
    filename: string | null;
    warehouseId: string | null;
    warehouseName: string | null;
    reason: string;
    rowsTotal: number;
    rowsToApply: number;
    rowsNoChange: number;
    rowsInvalid: number;
    unitsChanged: number;
    rowsApplied: number;
    reversedAt: string | null;
    error: string | null;
    createdBy: string | null;
    createdAt: string;
    appliedAt: string | null;
}

export interface ImportBatchDetail extends ImportBatch {
    plan: ImportRowPlan[];
    summary?: ImportPlanSummary;
}

export interface ApplyImportResult extends ImportBatchDetail {
    /** Rows whose custom-field values were written (docs/146 Phase 11.8). */
    fieldsUpdated?: number;
    /** Rows whose stock had moved since the plan was made. Surfaced, not
     *  swallowed: the operator approved a number and this says where reality
     *  disagreed. */
    driftedRows: number;
}

export function useImportBatches(status?: string) {
    return useQuery({
        queryKey: reportingKeys.imports(status ?? 'any'),
        queryFn: () =>
            api.list<ImportBatch>('/v1/inventory/imports', {
                ...(status ? { status } : {}),
                take: 100,
            }),
    });
}

export function useImportBatch(id: string) {
    return useQuery({
        queryKey: reportingKeys.importBatch(id),
        queryFn: () => api.get<ImportBatchDetail>(`/v1/inventory/imports/${id}`),
        enabled: id !== '' && id !== 'new',
    });
}

function useInvalidateImports() {
    const queryClient = useQueryClient();
    return () => {
        void queryClient.invalidateQueries({ queryKey: reportingKeys.all });
    };
}

export interface PlanImportInput {
    csv: string;
    filename?: string;
    warehouse_id?: string;
    reason?: string;
    /** Field key → the heading in THIS file (docs/146 Phase 11.2). Absent fields
     *  fall back to the importer's own alias list. */
    mapping?: Record<string, string>;
    profile_id?: string;
    decimal?: '.' | ',';
    create_missing_items?: boolean;
}

/** Parse and work out what the file WOULD do. Writes no stock. */
export function usePlanImport() {
    const invalidate = useInvalidateImports();
    return useMutation({
        mutationFn: (input: PlanImportInput) =>
            api.post<ImportBatchDetail>('/v1/inventory/imports', input),
        onSuccess: invalidate,
    });
}

export function useApplyImport() {
    const invalidate = useInvalidateImports();
    return useMutation({
        mutationFn: (id: string) =>
            api.post<ApplyImportResult>(`/v1/inventory/imports/${id}/apply`, {}),
        onSuccess: invalidate,
    });
}

export function useDiscardImport() {
    const invalidate = useInvalidateImports();
    return useMutation({
        mutationFn: (id: string) =>
            api.post<ImportBatchDetail>(`/v1/inventory/imports/${id}/discard`, {}),
        onSuccess: invalidate,
    });
}

export function useReverseImport() {
    const invalidate = useInvalidateImports();
    return useMutation({
        mutationFn: (id: string) =>
            api.post<ImportBatchDetail>(`/v1/inventory/imports/${id}/reverse`, {}),
        onSuccess: invalidate,
    });
}

/** Current stock in the columns the importer reads — the start of the count →
 *  correct → upload round trip. */
export function importTemplatePath(warehouseId?: string): string {
    const params = new URLSearchParams();
    if (warehouseId) params.set('warehouse_id', warehouseId);
    const query = params.toString();
    return `/v1/inventory/imports/template${query ? `?${query}` : ''}`;
}

/* ── Stock versus the books ─────────────────────────────────────────────── */

export interface ReconciliationLine {
    kind: string;
    description: string;
    /** Null where the figure could not be established — which is different from a
     *  difference of nothing. */
    amountCents: number | null;
    source: string;
    reference: string | null;
}

export interface GlReconciliation {
    asOf: string;
    currency: string;
    sparxValueCents: number;
    /** Null when nobody has told sparx what the books say. */
    ledgerValueCents: number | null;
    ledgerAccountName: string | null;
    ledgerAsOf: string | null;
    ledgerSource: string | null;
    explainedCents: number;
    /** Null without a ledger figure. Zero is the GOOD outcome. */
    unexplainedCents: number | null;
    lines: ReconciliationLine[];
    awaitingLedgerFigure: boolean;
}

export interface GlSnapshot {
    id: string;
    asOf: string;
    accountName: string;
    accountCode: string | null;
    balanceCents: number;
    currency: string;
    source: string;
    note: string | null;
    capturedBy: string | null;
    createdAt: string;
}

export function useGlReconciliation(asOf?: string) {
    return useQuery({
        queryKey: reportingKeys.reconciliation(asOf ?? 'today'),
        queryFn: () =>
            api.get<GlReconciliation>('/v1/inventory/gl-reconciliation', {
                ...(asOf ? { as_of: asOf } : {}),
            }),
        placeholderData: (previous) => previous,
    });
}

export function useGlSnapshots() {
    return useQuery({
        queryKey: reportingKeys.snapshots(),
        queryFn: () => api.list<GlSnapshot>('/v1/inventory/gl-snapshots', { take: 50 }),
    });
}

export interface GlSnapshotInput {
    as_of: string;
    account_name: string;
    account_code?: string | null;
    balance_cents: number;
    currency?: string;
    note?: string | null;
}

export function useRecordGlSnapshot() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: GlSnapshotInput) =>
            api.post<GlSnapshot>('/v1/inventory/gl-snapshots', input),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: reportingKeys.all });
        },
    });
}

/* ── Saying a figure out loud ───────────────────────────────────────────── */

const NUMBER = new Intl.NumberFormat();

/** A percentage, or the SENTENCE that no percentage exists. Never "0%" — that
 *  is the exact lie this phase is built to stop. */
export function formatPercent(value: number | null | undefined): string {
    return value === null || value === undefined ? 'Not measured' : `${value}%`;
}

export function formatRatio(value: number | null | undefined): string {
    return value === null || value === undefined ? 'Not measured' : value.toFixed(2);
}

export function formatCount(value: number): string {
    return NUMBER.format(value);
}

/** Days out, said the way a person would: hours below a day, days above it. */
export function formatDaysOut(days: number): string {
    if (days < 1) {
        const hours = Math.max(1, Math.round(days * 24));
        return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    }
    const rounded = Math.round(days * 10) / 10;
    return `${rounded} ${rounded === 1 ? 'day' : 'days'}`;
}

/** Sell-through as a stocking verdict, colored by what to DO about it —
 *  buy less, carry on, buy more. Grey is not one of the answers. */
export function sellThroughTone(pct: number | null): Tone {
    if (pct === null) return 'neutral';
    if (pct < 20) return 'warning';
    if (pct > 80) return 'info';
    return 'success';
}

export function sellThroughVerdict(pct: number | null): string {
    if (pct === null) return 'Nothing to measure';
    if (pct < 20) return 'Too much on the shelf';
    if (pct > 80) return 'Selling out — buy more';
    return 'Healthy';
}

export function gmroiTone(value: number | null): Tone {
    if (value === null) return 'neutral';
    if (value < 0) return 'danger';
    if (value < 1) return 'warning';
    if (value < 3) return 'info';
    return 'success';
}

export function gmroiVerdict(value: number | null): string {
    if (value === null) return 'Nothing to measure';
    if (value < 0) return 'Selling below cost';
    if (value < 1) return 'Not paying for itself';
    if (value < 3) return 'Fair';
    return 'Strong';
}

export function fillRateTone(pct: number | null): Tone {
    if (pct === null) return 'neutral';
    if (pct < 90) return 'danger';
    if (pct < 95) return 'warning';
    if (pct < 98) return 'info';
    return 'success';
}

export function fillRateVerdict(pct: number | null): string {
    if (pct === null) return 'Nothing to measure';
    if (pct < 90) return 'Customers are going elsewhere';
    if (pct < 95) return 'Below what buyers expect';
    if (pct < 98) return 'Good';
    return 'Excellent';
}

/** Movement groups, colored by what they MEAN rather than by direction: stock
 *  arriving and stock sold are both good and different; stock lost is not. */
export function movementGroupTone(group: MovementSummaryRow['group']): Tone {
    switch (group) {
        case 'inbound':
            return 'info';
        case 'sold':
            return 'success';
        case 'lost':
            return 'danger';
        case 'corrected':
            return 'warning';
        default:
            return 'neutral';
    }
}

export function movementGroupLabel(group: MovementSummaryRow['group']): string {
    switch (group) {
        case 'inbound':
            return 'Came in';
        case 'sold':
            return 'Sold';
        case 'lost':
            return 'Lost';
        case 'corrected':
            return 'Corrected';
        default:
            return 'Moved about';
    }
}

export function movementReasonLabel(reason: string): string {
    const labels: Record<string, string> = {
        receive: 'Deliveries booked in',
        return: 'Customer returns',
        cancel: 'Cancelled orders',
        sale: 'Sold',
        loss: 'Lost',
        damage: 'Damaged',
        recount: 'Count corrections',
        transfer_in: 'Moved in from another location',
        transfer_out: 'Moved out to another location',
        reserve: 'Held for an order',
        release: 'Hold released',
        manual: 'Manual corrections',
        sync: 'Corrections from a connected system',
    };
    return labels[reason] ?? reason;
}

export function importStatusTone(status: ImportBatch['status']): Tone {
    switch (status) {
        case 'applied':
            return 'success';
        case 'planned':
            return 'info';
        case 'failed':
            return 'danger';
        default:
            return 'neutral';
    }
}

export function importStatusLabel(batch: ImportBatch): string {
    if (batch.reversedAt) return 'Undone';
    switch (batch.status) {
        case 'planned':
            return 'Waiting for you';
        case 'applied':
            return 'Applied';
        case 'discarded':
            return 'Thrown away';
        case 'failed':
            return 'Failed';
        default:
            return batch.status;
    }
}

export function deliveryStatusTone(status: ReportDelivery['status']): Tone {
    switch (status) {
        case 'success':
            return 'success';
        case 'partial':
            return 'warning';
        case 'failed':
            return 'danger';
        default:
            return 'neutral';
    }
}

export function deliveryStatusLabel(status: ReportDelivery['status']): string {
    switch (status) {
        case 'success':
            return 'Sent';
        case 'partial':
            return 'Partly sent';
        case 'failed':
            return 'Failed';
        case 'skipped':
            return 'Nothing to send';
        default:
            return status;
    }
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** When a schedule sends, in a sentence. "Every Monday at 7am" beats a table of
 *  four columns nobody reads across. */
export function cadenceSentence(schedule: {
    cadence: string;
    dayOfWeek: number | null;
    dayOfMonth: number | null;
    hour: number;
    timezone: string;
}): string {
    const time = `${schedule.hour === 0 ? 12 : schedule.hour > 12 ? schedule.hour - 12 : schedule.hour}${schedule.hour < 12 ? 'am' : 'pm'
        }`;
    const zone = schedule.timezone === 'UTC' ? '' : ` (${schedule.timezone})`;
    switch (schedule.cadence) {
        case 'daily':
            return `Every day at ${time}${zone}`;
        case 'weekly':
            return `Every ${WEEKDAYS[schedule.dayOfWeek ?? 1] ?? 'Monday'} at ${time}${zone}`;
        case 'monthly': {
            const day = schedule.dayOfMonth ?? 1;
            const suffix = day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th';
            return `On the ${day}${suffix} of each month at ${time}${zone}`;
        }
        default:
            return schedule.cadence;
    }
}
