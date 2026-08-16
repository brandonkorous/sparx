'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE PLANNING DATA LAYER
//
// How much to keep, when to buy it again, and what keeping it costs. Four reads
// and four writes over `/v1/inventory/planning/*`, `/classifications` and
// `/count-schedules`.
//
// ── Nothing is computed here ───────────────────────────────────────────────
//
// Not the reorder point, not the days of cover, not the money at risk, not the
// sentence explaining any of it. Every figure arrives from the server, which
// computed it with the same pure functions the nightly pass and the MCP tools
// use. A browser that re-derived "days of cover" from a rate and a quantity
// would produce a number that disagrees with the one in the reorder list by a
// rounding step, and then there are two truths on two screens.
//
// What DOES live here is wording: turning `forecastBasis: '30d'` into "measured
// over the last 30 days", a confidence into a color, a class letter into
// something a person can act on. That is presentation, and it belongs in the
// browser.
//
// ── Null means not measured, and it has to stay visible ────────────────────
//
// A planning figure that has never been measured is null all the way to the
// screen — never zero, never a dash the reader has to interpret. The difference
// between "we measured it and nothing sells" and "nobody has measured this" is
// the difference between leaving it alone and going to look, so every helper
// below keeps the two apart.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { api } from '../../lib/api/client';
import type { Tone } from './data';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

export type ServiceLevel = 'p50' | 'p80' | 'p90' | 'p95' | 'p99';
export type AbcClass = 'A' | 'B' | 'C';
export type XyzClass = 'X' | 'Y' | 'Z';
export type InputConfidence = 'measured' | 'thin' | 'assumed' | 'missing';
export type CountCadence = 'weekly' | 'monthly' | 'quarterly' | 'annually' | 'custom';

export interface PlanningPolicy {
    serviceLevel: ServiceLevel;
    holdingCostRatePct: number;
    abcAThresholdPct: number;
    abcBThresholdPct: number;
    xyzXMaxCv: number;
    xyzYMaxCv: number;
    overstockCoverDays: number;
    deadStockDays: number;
    autoApplyReorderPoints: boolean;
    minSeasonalityHistoryDays: number;
    /** Null means the nightly pass has never run — every figure is honestly absent. */
    lastSweepAt: string | null;
    /** False until someone has chosen, so the screen can say "standard settings". */
    configured: boolean;
    updatedAt: string | null;
}

export interface StockoutRiskRow {
    variantId: string;
    warehouseId: string;
    sku: string | null;
    title: string | null;
    warehouseCode: string | null;
    warehouseName: string | null;
    onHand: number;
    available: number;
    onOrder: number;
    reorderPoint: number | null;
    dynamicReorderPoint: number | null;
    /** Null = never measured. 0 = measured, nothing sells. */
    velocityPerDay: number | null;
    forecastBasis: string | null;
    daysOfCover: number | null;
    daysOfCoverWithInbound: number | null;
    projectedStockoutAt: string | null;
    leadTimeDays: number;
    leadTimeSource: string;
    unitsAtRisk: number;
    revenueAtRiskCents: number;
    abcClass: string | null;
    xyzClass: string | null;
    supplierId: string | null;
    supplierName: string | null;
    suggestedQuantity: number;
    reasoning: string;
    measuredAt: string | null;
}

export interface StockoutRiskReport {
    rows: StockoutRiskRow[];
    totalRevenueAtRiskCents: number;
    unmeasuredLevels: number;
    lastSweepAt: string | null;
}

export interface ClassificationRow {
    variantId: string;
    warehouseId: string;
    sku: string | null;
    title: string | null;
    warehouseCode: string | null;
    warehouseName: string | null;
    measuredAbcClass: AbcClass;
    /** Null until there are enough selling days to judge steadiness at all. */
    measuredXyzClass: XyzClass | null;
    abcOverride: AbcClass | null;
    xyzOverride: XyzClass | null;
    abcClass: AbcClass;
    xyzClass: XyzClass | null;
    annualUsageUnits: number;
    annualUsageValueCents: number;
    valueSharePct: number;
    cumulativeSharePct: number;
    demandCv: number | null;
    advice: string;
    overrideReason: string | null;
    overrideAt: string | null;
    classifiedAt: string;
}

export type SlowMoverKind = 'dead' | 'overstock' | 'slow';

export interface SlowMoverRow {
    variantId: string;
    warehouseId: string;
    sku: string | null;
    title: string | null;
    warehouseCode: string | null;
    warehouseName: string | null;
    kind: SlowMoverKind;
    onHand: number;
    excessUnits: number;
    unitCostCents: number;
    /** False = no cost price recorded, so every money figure here is zero by
        absence. The row must say so rather than print a confident $0.00. */
    costKnown: boolean;
    valueCents: number;
    excessValueCents: number;
    annualHoldingCostCents: number;
    velocityPerDay: number | null;
    daysOfCover: number | null;
    lastSaleAt: string | null;
    daysSinceLastSale: number | null;
    abcClass: string | null;
    suggestedAction: string;
}

export interface SlowMoverReport {
    overstockCoverDays: number;
    deadStockDays: number;
    holdingCostRatePct: number;
    rows: SlowMoverRow[];
    totals: {
        items: number;
        excessValueCents: number;
        annualHoldingCostCents: number;
        deadItems: number;
        deadValueCents: number;
        /** Rows with no cost price — the amount by which the money totals understate. */
        itemsWithoutCost: number;
    };
}

export interface HoldingCostReport {
    annualRatePct: number;
    usingDefaultRate: boolean;
    totalValueCents: number;
    annualHoldingCostCents: number;
    monthlyHoldingCostCents: number;
    byClass: { abcClass: string; valueCents: number; annualHoldingCostCents: number }[];
    topItems: {
        variantId: string;
        warehouseId: string;
        sku: string | null;
        title: string | null;
        warehouseName: string | null;
        onHand: number;
        valueCents: number;
        /** False = no cost price recorded; the zero is an absence, not a measurement. */
        costKnown: boolean;
        annualHoldingCostCents: number;
        daysOfCover: number | null;
    }[];
    /** Levels with no cost price — how much every money figure here understates by. */
    itemsWithoutCost: number;
}

export interface PlanningInput {
    key: string;
    label: string;
    value: string;
    source: string;
    confidence: InputConfidence;
    caveat?: string;
}

export interface DemandVelocity {
    units7: number;
    units30: number;
    units90: number;
    perDay7: number;
    perDay30: number;
    perDay90: number;
    forecastPerDay: number;
    forecastBasis: string;
    demandStdDev: number;
    demandCv: number | null;
    daysWithDemand: number;
    seasonalityIndex: number | null;
    historyDays: number;
    firstMovementAt: string | null;
    lastSaleAt: string | null;
    computedAt: string;
}

export interface PlanningProvenance {
    variantId: string;
    warehouseId: string;
    sku: string | null;
    title: string | null;
    warehouseName: string | null;
    currentReorderPoint: number | null;
    computedReorderPoint: number | null;
    isAutoManaged: boolean;
    differs: boolean;
    safetyStockUnits: number | null;
    serviceLevel: ServiceLevel;
    serviceLevelLabel: string;
    inputs: PlanningInput[];
    workings: { safetyStock: string; reorderPoint: string };
    confidence: InputConfidence;
    improve: string[];
    velocity: DemandVelocity | null;
    leadTime: {
        days: number;
        stdDevDays: number;
        source: string;
        sampleCount: number;
        supplierName: string | null;
        promisedDays: number | null;
    } | null;
    computedAt: string | null;
    lastSweepAt: string | null;
}

export interface LeadTimeRow {
    supplierId: string;
    supplierName: string | null;
    variantId: string | null;
    variantSku: string | null;
    sampleCount: number;
    meanDays: number;
    stdDevDays: number;
    minDays: number;
    maxDays: number;
    promisedDays: number | null;
    onTimeRate: number | null;
    varianceDays: number | null;
    isReliable: boolean;
    lastReceiptAt: string | null;
    measuredAt: string;
}

export interface CountSchedule {
    id: string;
    warehouseId: string;
    warehouseName: string | null;
    warehouseCode: string | null;
    name: string;
    abcClass: AbcClass | null;
    zoneName: string | null;
    cadence: CountCadence;
    intervalDays: number;
    maxItemsPerRun: number;
    isBlind: boolean;
    assignedTo: string | null;
    isActive: boolean;
    lastRunAt: string | null;
    lastCountId: string | null;
    lastCountNumber: string | null;
    lastCountOpen: boolean;
    nextRunAt: string;
    isDue: boolean;
    coveredLevels: number;
    createdAt: string;
    updatedAt: string;
}

export interface PlanningSweepStage {
    stage: string;
    ok: boolean;
    summary: string;
    detail: Record<string, unknown>;
    error?: string;
    durationMs: number;
}

export interface PlanningSweepResult {
    stages: PlanningSweepStage[];
    ok: boolean;
    levelsPlanned: number;
    countsGenerated: number;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
}

export interface ScheduleGenerationResult {
    schedulesConsidered: number;
    countsCreated: number;
    skippedOpen: number;
    skippedEmpty: number;
    counts: { scheduleId: string; countId: string; number: string; lineCount: number }[];
}

/* ── Query keys ─────────────────────────────────────────────────────────── */

export const planningKeys = {
    all: ['inventory', 'planning'] as const,
    policy: () => [...planningKeys.all, 'policy'] as const,
    risk: (warehouseId: string) => [...planningKeys.all, 'risk', warehouseId] as const,
    slowMovers: (warehouseId: string) => [...planningKeys.all, 'slow-movers', warehouseId] as const,
    holdingCost: (warehouseId: string) => [...planningKeys.all, 'holding', warehouseId] as const,
    leadTimes: () => [...planningKeys.all, 'lead-times'] as const,
    explain: (variantId: string, warehouseId: string) =>
        [...planningKeys.all, 'explain', variantId, warehouseId] as const,
    classifications: (query: ClassificationQuery) =>
        [...planningKeys.all, 'classifications', query] as const,
    schedules: (warehouseId: string) => [...planningKeys.all, 'schedules', warehouseId] as const,
    schedule: (id: string) => [...planningKeys.all, 'schedule', id] as const,
};

export interface ClassificationQuery {
    warehouseId?: string;
    abcClass?: AbcClass;
    /** `unknown` picks out the rows with too little history to judge. */
    xyzClass?: XyzClass | 'unknown';
    q?: string;
    take: number;
    skip: number;
}

/* ── Reads ──────────────────────────────────────────────────────────────── */

export function usePlanningPolicy() {
    return useQuery({
        queryKey: planningKeys.policy(),
        queryFn: () => api.get<PlanningPolicy>('/v1/inventory/planning/policy'),
        staleTime: 60_000,
    });
}

export function useStockoutRisk(warehouseId: string) {
    return useQuery({
        queryKey: planningKeys.risk(warehouseId),
        queryFn: () =>
            api.get<StockoutRiskReport>('/v1/inventory/planning/stockout-risk', {
                ...(warehouseId ? { warehouse_id: warehouseId } : {}),
                take: 100,
            }),
        placeholderData: (previous) => previous,
    });
}

export function useSlowMovers(warehouseId: string) {
    return useQuery({
        queryKey: planningKeys.slowMovers(warehouseId),
        queryFn: () =>
            api.get<SlowMoverReport>('/v1/inventory/planning/slow-movers', {
                ...(warehouseId ? { warehouse_id: warehouseId } : {}),
                take: 100,
            }),
        placeholderData: (previous) => previous,
    });
}

export function useHoldingCost(warehouseId: string) {
    return useQuery({
        queryKey: planningKeys.holdingCost(warehouseId),
        queryFn: () =>
            api.get<HoldingCostReport>('/v1/inventory/planning/holding-cost', {
                ...(warehouseId ? { warehouse_id: warehouseId } : {}),
                take: 25,
            }),
        placeholderData: (previous) => previous,
    });
}

export function useLeadTimes() {
    return useQuery({
        queryKey: planningKeys.leadTimes(),
        queryFn: () => api.list<LeadTimeRow>('/v1/inventory/planning/lead-times', { take: 100 }),
        staleTime: 5 * 60_000,
    });
}

export function useClassifications(query: ClassificationQuery) {
    return useQuery({
        queryKey: planningKeys.classifications(query),
        queryFn: () =>
            api.list<ClassificationRow>('/v1/inventory/classifications', {
                ...(query.warehouseId ? { warehouse_id: query.warehouseId } : {}),
                ...(query.abcClass ? { abc_class: query.abcClass } : {}),
                ...(query.xyzClass ? { xyz_class: query.xyzClass } : {}),
                ...(query.q ? { q: query.q } : {}),
                take: query.take,
                skip: query.skip,
            }),
        placeholderData: (previous) => previous,
    });
}

export function usePlanningExplanation(variantId: string, warehouseId: string) {
    return useQuery({
        queryKey: planningKeys.explain(variantId, warehouseId),
        queryFn: () =>
            api.get<PlanningProvenance>(`/v1/inventory/planning/explain/${variantId}/${warehouseId}`),
        enabled: Boolean(variantId && warehouseId),
    });
}

export function useCountSchedules(warehouseId: string) {
    return useQuery({
        queryKey: planningKeys.schedules(warehouseId),
        queryFn: () =>
            api.list<CountSchedule>('/v1/inventory/count-schedules', {
                ...(warehouseId ? { warehouse_id: warehouseId } : {}),
                include_inactive: true,
            }),
    });
}

export function useCountSchedule(id: string) {
    return useQuery({
        queryKey: planningKeys.schedule(id),
        queryFn: () => api.get<CountSchedule>(`/v1/inventory/count-schedules/${id}`),
        enabled: Boolean(id) && id !== 'new',
    });
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

export function useUpdatePlanningPolicy() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (patch: Partial<PlanningPolicy>) =>
            api.put<PlanningPolicy>('/v1/inventory/planning/policy', patch),
        onSuccess: () => {
            // A threshold change re-decides everything downstream on the next run, so
            // every planning read is stale the moment this lands — even though the
            // stored figures do not change until tonight.
            void queryClient.invalidateQueries({ queryKey: planningKeys.all });
        },
    });
}

/** Re-measure everything now. Deliberately does not generate counts. */
export function useRecomputePlanning() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: { warehouseId?: string }) =>
            api.post<PlanningSweepResult>('/v1/inventory/planning/recompute', {
                ...(input.warehouseId ? { warehouse_id: input.warehouseId } : {}),
            }),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: planningKeys.all });
            // Reorder points may have moved, which changes what the buying worklist
            // shows and what the stock list flags as low.
            void queryClient.invalidateQueries({ queryKey: ['inventory', 'reorder'] });
            void queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
        },
    });
}

export function useApplyReorderPoint() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: { variantId: string; warehouseId: string }) =>
            api.post<unknown>('/v1/inventory/planning/reorder-plan/apply', input),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: planningKeys.all });
            void queryClient.invalidateQueries({ queryKey: ['inventory', 'reorder'] });
            void queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] });
        },
    });
}

export function useSetClassification() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: {
            variantId: string;
            warehouseId: string;
            abcClass: AbcClass | null;
            xyzClass: XyzClass | null;
            reason?: string;
        }) => api.put<ClassificationRow>('/v1/inventory/classifications', input),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: planningKeys.all });
        },
    });
}

export function useSaveCountSchedule(id: string) {
    const queryClient = useQueryClient();
    const isNew = id === 'new';
    return useMutation({
        mutationFn: (body: Record<string, unknown>) =>
            isNew
                ? api.post<CountSchedule>('/v1/inventory/count-schedules', body)
                : api.patch<CountSchedule>(`/v1/inventory/count-schedules/${id}`, body),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: planningKeys.all });
        },
    });
}

export function useDeleteCountSchedule() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => api.delete<unknown>(`/v1/inventory/count-schedules/${id}`),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: planningKeys.all });
        },
    });
}

export function useRunCountSchedule() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) =>
            api.post<ScheduleGenerationResult>(`/v1/inventory/count-schedules/${id}/run`, {}),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: planningKeys.all });
            // The generated count belongs to the counts list too.
            void queryClient.invalidateQueries({ queryKey: ['inventory', 'counts'] });
        },
    });
}

/* ── Saying what a number means ─────────────────────────────────────────── */

/** How strongly a planning figure can be leaned on, as a color. `assumed` is a
 *  warning rather than a danger: the number is usable, it just rests on
 *  something nobody measured. */
export function confidenceTone(confidence: InputConfidence): Tone {
    switch (confidence) {
        case 'measured':
            return 'success';
        case 'thin':
            return 'info';
        case 'assumed':
            return 'warning';
        default:
            return 'danger';
    }
}

export function confidenceLabel(confidence: InputConfidence): string {
    switch (confidence) {
        case 'measured':
            return 'Measured';
        case 'thin':
            return 'Not much to go on';
        case 'assumed':
            return 'Assumed';
        default:
            return 'Not measured';
    }
}

/** ABC is about where the money is, so A wears the strongest color on screen. */
export function abcTone(abc: string | null): Tone {
    if (abc === 'A') return 'danger';
    if (abc === 'B') return 'warning';
    if (abc === 'C') return 'info';
    return 'neutral';
}

/** XYZ is about predictability: X is good news, Z is the one to watch. */
export function xyzTone(xyz: string | null): Tone {
    if (xyz === 'X') return 'success';
    if (xyz === 'Y') return 'warning';
    if (xyz === 'Z') return 'danger';
    return 'neutral';
}

export function abcLabel(abc: string | null): string {
    if (abc === 'A') return 'Top value';
    if (abc === 'B') return 'Mid value';
    if (abc === 'C') return 'Long tail';
    return 'Not ranked';
}

export function xyzLabel(xyz: string | null): string {
    if (xyz === 'X') return 'Steady';
    if (xyz === 'Y') return 'Uneven';
    if (xyz === 'Z') return 'Erratic';
    // Not "Not ranked" and emphatically not "Erratic": the item has not sold on
    // enough separate days for its spread to describe anything. Saying so is the
    // honest reading and the one an owner can act on — wait, or watch it yourself.
    return 'Not enough history';
}

/** The three flavours of stock that is not paying its rent, and how loudly to
 *  say each one. Dead stock is money that is not coming back on its own. */
export function slowMoverTone(kind: SlowMoverKind): Tone {
    if (kind === 'dead') return 'danger';
    if (kind === 'overstock') return 'warning';
    return 'info';
}

export function slowMoverLabel(kind: SlowMoverKind): string {
    if (kind === 'dead') return 'Not selling';
    if (kind === 'overstock') return 'Too much';
    return 'Slowing down';
}

/**
 * How urgent a risk row is, colored by when it bites rather than by size.
 *
 * Money at risk decides the ORDER of the list; this decides the color of one
 * row, and they are different questions — a large figure six weeks out is not an
 * emergency, and a small one on Friday is.
 */
export function riskTone(row: Pick<StockoutRiskRow, 'daysOfCoverWithInbound' | 'available'>): Tone {
    if (row.available <= 0) return 'danger';
    const cover = row.daysOfCoverWithInbound;
    if (cover === null) return 'neutral';
    if (cover <= 3) return 'danger';
    if (cover <= 14) return 'warning';
    return 'success';
}

/** When it runs out, in words. Null cover means no deadline, which is its own
 *  answer and not a blank. */
export function coverPhrase(
    row: Pick<StockoutRiskRow, 'daysOfCoverWithInbound' | 'available' | 'velocityPerDay'>
): string {
    if (row.available <= 0) return 'Out of stock';
    if (row.velocityPerDay === null) return 'Not measured yet';
    if (row.velocityPerDay <= 0 || row.daysOfCoverWithInbound === null) return 'Not selling';
    const days = row.daysOfCoverWithInbound;
    if (days < 1) return 'Out within a day';
    if (days < 2) return 'Out in about a day';
    if (days < 60) return `${Math.round(days)} days left`;
    return 'Months of cover';
}

/** Where a lead time came from, said plainly — the difference between a measured
 *  figure and a supplier's claim is most of what makes a reorder point good. */
export function leadTimeSourceLabel(source: string | null): string {
    switch (source) {
        case 'measured':
            return 'Measured from real deliveries';
        case 'supplier':
            return 'The supplier’s stated time';
        case 'level':
            return 'Set on this stock line';
        case 'default':
            return 'Assumed — nothing is known';
        default:
            return 'Unknown';
    }
}

/** Which trailing window the sales rate came from. */
export function forecastBasisLabel(basis: string | null): string {
    switch (basis) {
        case '7d':
            return 'last 7 days';
        case '30d':
            return 'last 30 days';
        case '90d':
            return 'last 90 days';
        case 'none':
            return 'nothing sold';
        default:
            return 'not measured';
    }
}

export function cadenceLabel(cadence: CountCadence, intervalDays: number): string {
    switch (cadence) {
        case 'weekly':
            return 'Every week';
        case 'monthly':
            return 'Every month';
        case 'quarterly':
            return 'Every quarter';
        case 'annually':
            return 'Once a year';
        default:
            return `Every ${String(intervalDays)} days`;
    }
}

/** A schedule's state: overdue, blocked behind an unfinished count, paused, or
 *  simply waiting for its date. Four different problems, four different answers. */
export function scheduleState(schedule: CountSchedule): { label: string; tone: Tone } {
    if (!schedule.isActive) return { label: 'Paused', tone: 'neutral' };
    if (schedule.lastCountOpen) return { label: 'Waiting on the last count', tone: 'warning' };
    if (schedule.isDue) return { label: 'Due now', tone: 'danger' };
    return { label: 'Scheduled', tone: 'success' };
}

/** A short, readable date — the way a person would say it. */
export function shortDate(iso: string | null): string {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
