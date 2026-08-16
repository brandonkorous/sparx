'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE INTEGRITY DATA LAYER — can you trust the numbers?
//
// Every other inventory surface answers "what have I got". This one answers the
// question underneath it, which is the one that actually decides whether any of
// the others are worth reading. It is the read side of four things:
//
//   • Reconciliation — a nightly job re-adds every change ever recorded for an
//     item and checks the total against the number on the shelf record. They
//     should always agree; a run that says so is a RESULT, not silence.
//   • Drifts — the ones that didn't agree. Never fixed automatically: writing
//     the recalculated number over the stored one would erase the evidence, and
//     if the history is the broken side it would spread the damage.
//   • Oversells — every time something was refused for lack of stock, or sold
//     when there wasn't enough. Each row remembers what the system BELIEVED it
//     had at that moment, which is what makes it answerable weeks later.
//   • Feed freshness — a connected system whose last update SUCCEEDED four days
//     ago looks perfectly healthy on every other screen, and its numbers are
//     worthless. This is what notices.
//
// All four are server reads. Every count, every sum, every age is worked out
// there — an integrity screen that computed its own figures in the browser
// would be marking its own homework.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { api } from '../../lib/api/client';
import type { Tone } from './data';

/* ── Shapes (mirror the integrity route responses exactly) ───────────────── */

/** One pass of the checking job. */
export interface ReconciliationRun {
    id: string;
    /** running | ok | drift | error */
    status: string;
    /** full | sample | variant */
    scope: string;
    levelsChecked: number;
    driftCount: number;
    driftUnits: number;
    driftValueCents: number;
    startedAt: string;
    finishedAt: string | null;
    durationMs: number | null;
    error: string | null;
}

/** One item whose recorded number disagrees with its own history. */
export interface ReconciliationDrift {
    id: string;
    runId: string;
    variantId: string;
    variantSku: string | null;
    productTitle: string | null;
    warehouseId: string;
    warehouseName: string | null;
    warehouseCode: string | null;
    recordedOnHand: number;
    derivedOnHand: number;
    /** recorded − recalculated. Positive means the record claims MORE than the
     *  history can account for, which is the direction that oversells. */
    delta: number;
    valueCents: number;
    resolvedAt: string | null;
    createdAt: string;
}

/** One sale refused, or one taken that couldn't be covered. */
export interface OversellIncident {
    id: string;
    variantId: string;
    variantSku: string | null;
    productTitle: string | null;
    warehouseId: string;
    warehouseName: string | null;
    warehouseCode: string | null;
    /** blocked | allowed | negative_on_hand */
    kind: string;
    requestedQuantity: number;
    availableQuantity: number;
    shortfall: number;
    onHandAtDecision: number;
    allocatedAtDecision: number;
    bufferAtDecision: number;
    policy: string;
    channel: string | null;
    holderType: string | null;
    holderId: string | null;
    actorType: string;
    actorId: string | null;
    sourceId: string | null;
    /** How old the stock number was when the decision was made. The diagnosis. */
    stockAgeSeconds: number | null;
    occurredAt: string;
}

export interface OversellSummary {
    windowDays: number;
    blocked: number;
    allowed: number;
    negativeOnHand: number;
    unitsShort: number;
    variantsAffected: number;
    topVariants: {
        variantId: string;
        variantSku: string | null;
        productTitle: string | null;
        incidents: number;
        unitsShort: number;
    }[];
}

/** A connected system, and whether its numbers are still recent enough to use. */
export interface SourceFreshness {
    sourceId: string;
    name: string;
    type: string;
    status: string;
    lastSyncAt: string | null;
    ageSeconds: number | null;
    expectedIntervalSec: number;
    /** warn | buffer_up | pause_channel */
    stalenessPolicy: string;
    stalenessBuffer: number;
    isStale: boolean;
    staleSince: string | null;
    overdueSeconds: number;
    linkedLevels: number;
}

/* ── Query keys ─────────────────────────────────────────────────────────── */

export const integrityKeys = {
    all: ['inventory', 'integrity'] as const,
    runs: () => [...integrityKeys.all, 'runs'] as const,
    drifts: (includeResolved: boolean) =>
        [...integrityKeys.all, 'drifts', { includeResolved }] as const,
    oversell: (query: OversellQuery) => [...integrityKeys.all, 'oversell', query] as const,
    oversellSummary: (windowDays: number) =>
        [...integrityKeys.all, 'oversell-summary', windowDays] as const,
    freshness: () => [...integrityKeys.all, 'freshness'] as const,
};

export interface OversellQuery {
    kind?: string;
    variantId?: string;
    take: number;
    skip: number;
}

/* ── Reads ──────────────────────────────────────────────────────────────── */

/** The check history, newest first. Only a handful are ever interesting — what
 *  matters is the latest result and whether the ones before it were clean. */
export function useReconciliationRuns() {
    return useQuery({
        queryKey: integrityKeys.runs(),
        queryFn: () =>
            api.list<ReconciliationRun>('/v1/inventory/integrity/reconciliation', { take: 14 }),
    });
}

/** Open disagreements by default. Resolved ones are history, and including them
 *  is what turns an alarm list into a wall nobody reads. */
export function useDrifts(includeResolved = false) {
    return useQuery({
        queryKey: integrityKeys.drifts(includeResolved),
        queryFn: () =>
            api.list<ReconciliationDrift>('/v1/inventory/integrity/drifts', {
                take: 100,
                ...(includeResolved ? { include_resolved: true } : {}),
            }),
    });
}

export function useOversellIncidents(query: OversellQuery) {
    return useQuery({
        queryKey: integrityKeys.oversell(query),
        queryFn: () =>
            api.list<OversellIncident>('/v1/inventory/integrity/oversell', {
                ...(query.kind ? { kind: query.kind } : {}),
                ...(query.variantId ? { variant_id: query.variantId } : {}),
                take: query.take,
                skip: query.skip,
            }),
    });
}

export function useOversellSummary(windowDays: number) {
    return useQuery({
        queryKey: integrityKeys.oversellSummary(windowDays),
        queryFn: () =>
            api.get<OversellSummary>('/v1/inventory/integrity/oversell/summary', {
                window_days: windowDays,
            }),
    });
}

export function useSourceFreshness() {
    return useQuery({
        queryKey: integrityKeys.freshness(),
        queryFn: () => api.get<SourceFreshness[]>('/v1/inventory/sources/freshness'),
    });
}

/* ── The one write ──────────────────────────────────────────────────────── */

/**
 * Run the check now.
 *
 * The only mutation on this surface, and it changes no stock — it records what
 * it found. Offered because "the nightly job says it was fine at 4am" is not an
 * answer to "is it fine now", which is what someone staring at a number they
 * distrust is actually asking.
 */
export function useRunReconciliation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: { scope?: 'full' | 'sample' | 'variant'; variantId?: string }) =>
            api.post<ReconciliationRun>('/v1/inventory/integrity/reconciliation', {
                ...(input.scope ? { scope: input.scope } : {}),
                ...(input.variantId ? { variant_id: input.variantId } : {}),
            }),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: integrityKeys.all });
        },
    });
}

/* ── Plain words ────────────────────────────────────────────────────────── */

/** What a check result MEANS, said the way someone would say it out loud. */
export function runVerdict(run: ReconciliationRun): { label: string; tone: Tone } {
    if (run.status === 'running') return { label: 'Checking now', tone: 'info' };
    if (run.status === 'error') return { label: 'The check could not finish', tone: 'warning' };
    if (run.status === 'drift') {
        return {
            label: `${run.driftCount} ${run.driftCount === 1 ? 'item does' : 'items do'} not add up`,
            tone: 'danger',
        };
    }
    return { label: 'Everything adds up', tone: 'success' };
}

/** What KIND of oversell this was, in one phrase plus its consequence. Three
 *  genuinely different events that all read as "out of stock" in a complaint. */
export function oversellKind(kind: string): { label: string; meaning: string; tone: Tone } {
    switch (kind) {
        case 'blocked':
            return {
                label: 'Sale refused',
                meaning: 'A customer was told they could not have it. Revenue you did not take.',
                tone: 'warning',
            };
        case 'allowed':
            return {
                label: 'Promised anyway',
                meaning:
                    'You took the order without the stock to cover it, because that item is set to keep selling.',
                tone: 'info',
            };
        case 'negative_on_hand':
            return {
                label: 'Sold below zero',
                meaning: 'Goods left that the system did not believe were there. Worth looking at.',
                tone: 'danger',
            };
        default:
            return { label: kind, meaning: '', tone: 'neutral' };
    }
}

/** Why an item is set up to oversell — the merchant's own setting, in their words. */
export function policyLabel(policy: string): string {
    if (policy === 'deny') return 'Stop selling at zero';
    if (policy === 'continue') return 'Keep selling past zero';
    if (policy === 'preorder') return 'Take pre-orders';
    return policy;
}

/** How stale a feed is, and whether that is a problem yet. Returns null when the
 *  source never declared a promise to be held to — an exempt source with a
 *  reassuring green tick would be a lie. */
export function freshnessVerdict(
    source: SourceFreshness
): { label: string; tone: Tone; detail: string } | null {
    if (source.expectedIntervalSec === 0) return null;
    if (source.lastSyncAt === null) {
        return {
            label: 'Never updated',
            tone: 'neutral',
            detail: 'This connection has not sent anything yet.',
        };
    }
    if (source.isStale) {
        return {
            label: `Late by ${humanDuration(source.overdueSeconds)}`,
            tone: 'danger',
            detail: policyConsequence(source),
        };
    }
    return {
        label: `Updated ${humanDuration(source.ageSeconds ?? 0)} ago`,
        tone: 'success',
        detail: `Expected at least every ${humanDuration(source.expectedIntervalSec)}.`,
    };
}

/** What the tenant told us to DO when this feed goes quiet — stated on screen so
 *  nobody has to guess whether selling has already been affected. */
function policyConsequence(source: SourceFreshness): string {
    if (source.stalenessPolicy === 'pause_channel') {
        return 'Selling this stock on your connected channels is paused until it updates.';
    }
    if (source.stalenessPolicy === 'buffer_up') {
        return `Holding back ${source.stalenessBuffer} extra ${source.stalenessBuffer === 1 ? 'unit' : 'units'
            } per line while it is late, so the gap does not cost you an order.`;
    }
    return 'Selling continues as normal — this is a warning only.';
}

/** Durations the way a person says them: "3 days", "4 hours", "20 minutes". */
export function humanDuration(seconds: number): string {
    if (seconds < 60) return `${Math.max(0, Math.round(seconds))} seconds`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    const days = Math.round(hours / 24);
    return `${days} ${days === 1 ? 'day' : 'days'}`;
}

/**
 * How fresh a stock number is, as a badge tone.
 *
 * Deliberately generous thresholds. This is a hint beside a quantity, not an
 * alarm — an hour-old number is completely normal for a shop that sells a few
 * things a day, and painting it amber would train everyone to ignore the color
 * before it ever meant anything.
 */
export function stockAgeTone(ageSeconds: number | null | undefined): Tone {
    if (ageSeconds === null || ageSeconds === undefined) return 'neutral';
    if (ageSeconds < 60 * 60 * 24) return 'success';
    if (ageSeconds < 60 * 60 * 24 * 7) return 'warning';
    return 'danger';
}
