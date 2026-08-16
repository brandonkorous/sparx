'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE SHELVES DATA LAYER
//
// A location answers "which building". Once you have more than a few hundred
// things, the question people actually ask is "which shelf" — and without an
// answer, finding anything means walking the room and counting means walking it
// twice.
//
// Shelves are OPT-IN per location. With them off, none of this renders and every
// stock movement lands in an invisible fallback shelf without anyone being asked.
// That is deliberate: a shop with one stockroom gains nothing from naming a shelf
// before it can book a delivery, and making them is how a warehouse feature makes
// the product worse for everyone smaller.
//
// Every count, sum and suggestion is worked out on the SERVER. A shelf list that
// tallied its own units in the browser would tally the page, not the shelf.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { api } from '../../lib/api/client';
import type { Tone } from './data';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

export interface Bin {
    id: string;
    warehouseId: string;
    warehouseName: string | null;
    code: string;
    name: string | null;
    zone: string | null;
    aisle: string | null;
    rack: string | null;
    shelf: string | null;
    /** pick | bulk | receiving | staging | quarantine | damaged */
    type: string;
    /** Whether stock here counts toward what a customer can buy. */
    isSellable: boolean;
    /** Walk order. Null sorts last. */
    pickSequence: number | null;
    capacityUnits: number | null;
    isDefault: boolean;
    /** Provisioned by sparx — the fallback, quarantine and damaged shelves. */
    isSystem: boolean;
    isActive: boolean;
    notes: string | null;
    itemCount: number;
    unitCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface BinContent {
    variantId: string;
    sku: string | null;
    productId: string | null;
    productTitle: string | null;
    onHand: number;
    lastCountedAt: string | null;
    asOf: string;
}

/** Where one item sits across a location. */
export interface VariantBin {
    binId: string;
    binCode: string;
    binName: string | null;
    zone: string | null;
    type: string;
    isSellable: boolean;
    pickSequence: number | null;
    onHand: number;
    lastCountedAt: string | null;
}

export interface PutAwaySuggestion {
    binId: string;
    binCode: string;
    binName: string | null;
    zone: string | null;
    reason: 'home_shelf' | 'already_here' | 'has_room' | 'default';
    /** Why this shelf, in words. Shown, not just sorted on. */
    explanation: string;
    onHand: number;
    capacityUnits: number | null;
    headroom: number | null;
}

export interface BinQuery {
    warehouseId?: string;
    zone?: string;
    type?: string;
    q?: string;
    includeSystem?: boolean;
    nonEmptyOnly?: boolean;
    take: number;
    skip: number;
}

/* ── Query keys ─────────────────────────────────────────────────────────── */

export const binKeys = {
    all: ['inventory', 'bins'] as const,
    list: (query: BinQuery) => [...binKeys.all, 'list', query] as const,
    one: (id: string) => [...binKeys.all, 'one', id] as const,
    contents: (id: string) => [...binKeys.all, 'contents', id] as const,
    forVariant: (variantId: string, warehouseId?: string) =>
        [...binKeys.all, 'variant', variantId, warehouseId ?? null] as const,
    suggest: (variantId: string, warehouseId: string) =>
        [...binKeys.all, 'suggest', variantId, warehouseId] as const,
};

/* ── Reads ──────────────────────────────────────────────────────────────── */

export function useBins(query: BinQuery) {
    return useQuery({
        queryKey: binKeys.list(query),
        queryFn: () =>
            api.list<Bin>('/v1/inventory/bins', {
                ...(query.warehouseId ? { warehouse_id: query.warehouseId } : {}),
                ...(query.zone ? { zone: query.zone } : {}),
                ...(query.type ? { type: query.type } : {}),
                ...(query.q ? { q: query.q } : {}),
                ...(query.includeSystem ? { include_system: true } : {}),
                ...(query.nonEmptyOnly ? { non_empty_only: true } : {}),
                take: query.take,
                skip: query.skip,
            }),
        placeholderData: (previous) => previous,
    });
}

export function useBin(id: string | undefined) {
    return useQuery({
        queryKey: binKeys.one(id ?? ''),
        enabled: Boolean(id) && id !== 'new',
        queryFn: () => api.get<Bin>(`/v1/inventory/bins/${id ?? ''}`),
    });
}

export function useBinContents(id: string | undefined) {
    return useQuery({
        queryKey: binKeys.contents(id ?? ''),
        enabled: Boolean(id) && id !== 'new',
        queryFn: () => api.get<BinContent[]>(`/v1/inventory/bins/${id ?? ''}/contents`),
    });
}

/** Where one item sits. The picker's read, and the one behind "go and get me one". */
export function useVariantBins(variantId: string | undefined, warehouseId?: string) {
    return useQuery({
        queryKey: binKeys.forVariant(variantId ?? '', warehouseId),
        enabled: Boolean(variantId),
        queryFn: () =>
            api.get<VariantBin[]>(`/v1/inventory/bins/variant/${variantId ?? ''}`, {
                ...(warehouseId ? { warehouse_id: warehouseId } : {}),
            }),
    });
}

export function usePutAwaySuggestions(
    variantId: string | undefined,
    warehouseId: string | undefined,
    quantity?: number
) {
    return useQuery({
        queryKey: binKeys.suggest(variantId ?? '', warehouseId ?? ''),
        enabled: Boolean(variantId && warehouseId),
        queryFn: () =>
            api.get<PutAwaySuggestion[]>('/v1/inventory/bins/suggest', {
                variant_id: variantId ?? '',
                warehouse_id: warehouseId ?? '',
                ...(quantity !== undefined ? { quantity } : {}),
            }),
    });
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

function useInvalidateBins() {
    const queryClient = useQueryClient();
    return () => {
        void queryClient.invalidateQueries({ queryKey: binKeys.all });
        // Shelf changes move stock, so the stock views are stale too.
        void queryClient.invalidateQueries({ queryKey: ['inventory', 'levels'] });
    };
}

export interface BinDraft {
    warehouseId: string;
    code: string;
    name?: string;
    zone?: string;
    aisle?: string;
    rack?: string;
    shelf?: string;
    type: string;
    isSellable?: boolean;
    pickSequence?: number;
    capacityUnits?: number;
    notes?: string;
}

export function useCreateBin() {
    const invalidate = useInvalidateBins();
    return useMutation({
        mutationFn: (draft: BinDraft) => api.post<Bin>('/v1/inventory/bins', draft),
        onSuccess: invalidate,
    });
}

export function useUpdateBin() {
    const invalidate = useInvalidateBins();
    return useMutation({
        mutationFn: ({ id, ...patch }: Partial<BinDraft> & { id: string; isActive?: boolean }) =>
            api.patch<Bin>(`/v1/inventory/bins/${id}`, patch),
        onSuccess: invalidate,
    });
}

export function useArchiveBin() {
    const invalidate = useInvalidateBins();
    return useMutation({
        mutationFn: (id: string) => api.delete<void>(`/v1/inventory/bins/${id}`),
        onSuccess: invalidate,
    });
}

export function useMoveBetweenBins() {
    const invalidate = useInvalidateBins();
    return useMutation({
        mutationFn: (input: {
            variantId: string;
            fromBinId: string;
            toBinId: string;
            quantity: number;
            note?: string;
        }) => api.post<{ moved: number }>('/v1/inventory/bins/move', input),
        onSuccess: invalidate,
    });
}

export function useSetHomeBin() {
    const invalidate = useInvalidateBins();
    return useMutation({
        mutationFn: ({ variantId, binId }: { variantId: string; binId: string | null }) =>
            api.put<{ variantId: string }>(`/v1/inventory/bins/home/${variantId}`, { binId }),
        onSuccess: invalidate,
    });
}

export function useEnableBins() {
    const invalidate = useInvalidateBins();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (warehouseId: string) =>
            api.post<{ binsCreated: number; levelsSeated: number }>(
                `/v1/inventory/warehouses/${warehouseId}/bins/enable`
            ),
        onSuccess: () => {
            invalidate();
            void queryClient.invalidateQueries({ queryKey: ['inventory', 'locations'] });
        },
    });
}

export function useDisableBins() {
    const invalidate = useInvalidateBins();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (warehouseId: string) =>
            api.post<{ warehouseId: string }>(`/v1/inventory/warehouses/${warehouseId}/bins/disable`),
        onSuccess: () => {
            invalidate();
            void queryClient.invalidateQueries({ queryKey: ['inventory', 'locations'] });
        },
    });
}

/* ── Plain words ────────────────────────────────────────────────────────── */

/** What a KIND of shelf is for, said the way a person would say it. Six words
 *  that decide whether stock on it can be sold, so they have to be unambiguous. */
export const BIN_TYPES: { value: string; label: string; hint: string }[] = [
    { value: 'pick', label: 'Picking', hint: 'A normal shelf people take stock from.' },
    { value: 'bulk', label: 'Overstock', hint: 'Backup stock that tops up the picking shelves.' },
    { value: 'receiving', label: 'Goods in', hint: 'Where deliveries land before being put away.' },
    { value: 'staging', label: 'Ready to go', hint: 'Picked orders waiting to be packed.' },
    {
        value: 'quarantine',
        label: 'On hold',
        hint: 'Arrived or came back, not checked yet. Cannot be sold.',
    },
    { value: 'damaged', label: 'Damaged', hint: 'Written off but still here. Cannot be sold.' },
];

export function binTypeLabel(type: string): string {
    return BIN_TYPES.find((t) => t.value === type)?.label ?? type;
}

/** Kinds of shelf get their own color, because the distinction that matters is
 *  "can this be sold" and a row of grey chips hides it completely. */
export function binTypeTone(type: string): Tone {
    switch (type) {
        case 'pick':
            return 'success';
        case 'bulk':
            return 'info';
        case 'receiving':
        case 'staging':
            return 'warning';
        case 'quarantine':
        case 'damaged':
            return 'danger';
        default:
            return 'neutral';
    }
}

/** Why put-away suggested a shelf, in a phrase short enough for a chip. */
export function suggestionLabel(reason: PutAwaySuggestion['reason']): string {
    switch (reason) {
        case 'home_shelf':
            return 'Its usual shelf';
        case 'already_here':
            return 'Already here';
        case 'has_room':
            return 'Has room';
        case 'default':
            return 'Fallback';
    }
}

/** A shelf's full address — "A · A-01-03" — skipping the parts nobody filled in.
 *  Every warehouse names its geography differently, so this only prints what
 *  exists rather than a row of empty separators. */
export function binAddress(bin: Pick<Bin, 'code' | 'zone' | 'aisle' | 'rack' | 'shelf'>): string {
    const parts = [bin.zone, bin.aisle, bin.rack, bin.shelf].filter(
        (p): p is string => typeof p === 'string' && p.trim() !== ''
    );
    return parts.length > 0 ? `${parts.join(' · ')} · ${bin.code}` : bin.code;
}

/** How full a shelf is, when a capacity was set. Null when it was not — most
 *  shelves have no meaningful capacity and inventing one would be a fake number. */
export function binFullness(bin: Pick<Bin, 'capacityUnits' | 'unitCount'>): number | null {
    if (bin.capacityUnits === null || bin.capacityUnits <= 0) return null;
    return Math.min(1, bin.unitCount / bin.capacityUnits);
}
