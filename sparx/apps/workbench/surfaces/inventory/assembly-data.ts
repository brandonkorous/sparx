'use client';

// ══════════════════════════════════════════════════════════════════════════
// UNITS, RECIPES AND RUNS
//
// Two features that belong together because they are the same idea at two
// scales: a case is twelve of something, and a finished thing is a list of
// somethings.
//
// ── The rule the units half rests on ─────────────────────────────────────
//
// Every quantity the server stores is in SINGLE units. A pack unit is a way of
// entering and reading a number, never a second way of storing one. So the
// browser never multiplies: it sends what the person typed plus the unit they
// typed it in, and the server converts once, in one place. A conversion done in
// two places is a conversion that will disagree.
//
// ── And the recipes half ─────────────────────────────────────────────────
//
// Component quantities are per BATCH, not per finished unit — a run of 100
// needing three litres of glue records 3 against a batch of 100. Every screen
// says which, because "quantity" on a recipe is otherwise the most ambiguous
// number in the product.
//
//   GET/POST/PATCH/DELETE /v1/inventory/units
//   GET/PUT               /v1/inventory/variants/:id/units
//   GET/POST/PATCH/DELETE /v1/inventory/boms
//   GET                   /v1/inventory/boms/:id/buildable
//   GET/POST              /v1/inventory/assemblies (+ release/complete/cancel)
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import { stockKeys, type Tone } from './data';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

export type UomDimension = 'count' | 'weight' | 'volume' | 'length' | 'area';
export type BomStatus = 'draft' | 'active' | 'archived';
export type AssemblyKind = 'assemble' | 'disassemble';
export type AssemblyStatus = 'planned' | 'released' | 'completed' | 'cancelled';

export interface UnitOfMeasure {
  id: string;
  code: string;
  name: string;
  pluralName: string;
  dimension: UomDimension;
  isSystem: boolean;
  isActive: boolean;
  /** Items using it. The number that decides whether deleting is safe. */
  usageCount: number;
  createdAt: string;
}

export interface VariantUom {
  id: string;
  uomId: string;
  code: string;
  name: string;
  pluralName: string;
  unitsPerUom: number;
  isPurchaseDefault: boolean;
  isSalesDefault: boolean;
}

export interface VariantUomSetup {
  variantId: string;
  stockingUomId: string | null;
  stockingUomCode: string | null;
  stockingUomName: string | null;
  stockingUomPluralName: string | null;
  conversions: VariantUom[];
}

export interface BomComponent {
  id: string;
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  /** Single units the whole BATCH needs. */
  quantityPer: number;
  scrapPercent: number;
  /** quantityPer plus waste, rounded up — what a batch really pulls. */
  quantityWithScrap: number;
  position: number;
  notes: string | null;
}

export interface Bom {
  id: string;
  outputVariantId: string;
  outputSku: string | null;
  outputTitle: string | null;
  name: string;
  version: number;
  status: BomStatus;
  outputQuantity: number;
  laborCostCents: number;
  componentCount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BomDetail extends Bom {
  components: BomComponent[];
  /** At TODAY's component prices — what you price against before you have made
   *  any. What a batch actually cost is settled when a run finishes. */
  estimatedUnitCostCents: number;
  estimatedComponentCostCents: number;
}

export interface BuildableComponent {
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  requiredPerBatch: number;
  available: number;
  supports: number;
  isLimiting: boolean;
}

export interface Buildable {
  bomId: string;
  outputVariantId: string;
  outputSku: string | null;
  warehouseId: string;
  quantity: number;
  outputQuantityPerBatch: number;
  limitingVariantId: string | null;
  limitingSku: string | null;
  components: BuildableComponent[];
}

export interface AssemblyLine {
  id: string;
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  quantityPerBatch: number;
  scrapPercent: number;
  quantityRequired: number;
  quantityConsumed: number;
  costConsumedCents: number;
  movementId: string | null;
  position: number;
}

export interface AssemblyOrder {
  id: string;
  number: string;
  kind: AssemblyKind;
  status: AssemblyStatus;
  bomId: string | null;
  bomName: string | null;
  outputVariantId: string;
  outputSku: string | null;
  outputTitle: string | null;
  warehouseId: string;
  warehouseName: string | null;
  quantityPlanned: number;
  quantityCompleted: number;
  laborCostCents: number;
  outputUnitCostCents: number | null;
  totalCostCents: number | null;
  notes: string | null;
  plannedFor: string | null;
  releasedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelledReason: string | null;
  createdAt: string;
}

export interface AssemblyOrderDetail extends AssemblyOrder {
  lines: AssemblyLine[];
}

/* ── Query keys ─────────────────────────────────────────────────────────── */

export const uomKeys = {
  all: ['inventory', 'units'] as const,
  list: (includeInactive: boolean) => [...uomKeys.all, 'list', includeInactive] as const,
  forVariant: (variantId: string) => [...uomKeys.all, 'variant', variantId] as const,
};

export const bomKeys = {
  all: ['inventory', 'boms'] as const,
  list: (query: { q: string; status: string; take: number; skip: number }) =>
    [...bomKeys.all, 'list', query] as const,
  detail: (id: string) => [...bomKeys.all, 'detail', id] as const,
  buildable: (id: string, warehouseId: string) =>
    [...bomKeys.all, 'buildable', id, warehouseId] as const,
};

export const assemblyKeys = {
  all: ['inventory', 'assemblies'] as const,
  list: (query: {
    q: string;
    status: string;
    kind: string;
    warehouseId: string;
    take: number;
    skip: number;
  }) => [...assemblyKeys.all, 'list', query] as const,
  detail: (id: string) => [...assemblyKeys.all, 'detail', id] as const,
};

/* ── Units ──────────────────────────────────────────────────────────────── */

export function useUnitsOfMeasure(includeInactive = false) {
  return useQuery({
    queryKey: uomKeys.list(includeInactive),
    queryFn: () =>
      api.get<UnitOfMeasure[]>('/v1/inventory/units', {
        ...(includeInactive ? { include_inactive: true } : {}),
      }),
  });
}

export function useVariantUoms(variantId: string) {
  return useQuery({
    queryKey: uomKeys.forVariant(variantId),
    queryFn: () => api.get<VariantUomSetup>(`/v1/inventory/variants/${variantId}/units`),
    enabled: variantId !== '',
  });
}

export interface UnitInput {
  code: string;
  name: string;
  pluralName?: string;
  dimension?: UomDimension;
}

export function useCreateUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UnitInput) => api.post<UnitOfMeasure>('/v1/inventory/units', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: uomKeys.all });
    },
  });
}

export function useUpdateUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<UnitInput> & { id: string; isActive?: boolean }) =>
      api.patch<UnitOfMeasure>(`/v1/inventory/units/${id}`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: uomKeys.all });
    },
  });
}

export function useDeleteUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ id: string }>(`/v1/inventory/units/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: uomKeys.all });
    },
  });
}

export interface SetVariantUomsInput {
  stockingUomId?: string | null;
  conversions: {
    uomId: string;
    unitsPerUom: number;
    isPurchaseDefault?: boolean;
    isSalesDefault?: boolean;
  }[];
}

export function useSetVariantUoms(variantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SetVariantUomsInput) =>
      api.put<VariantUomSetup>(`/v1/inventory/variants/${variantId}/units`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: uomKeys.all });
      // Changing what a case means changes how every quantity for this item
      // reads, so the stock screens have to be re-fetched, not just this one.
      void queryClient.invalidateQueries({ queryKey: stockKeys.all });
    },
  });
}

/* ── Recipes ────────────────────────────────────────────────────────────── */

export interface BomListQuery {
  q: string;
  status: string;
  take: number;
  skip: number;
}

export function useBoms(query: BomListQuery) {
  return useQuery({
    queryKey: bomKeys.list(query),
    queryFn: () =>
      api.list<Bom>('/v1/inventory/boms', {
        ...(query.q ? { q: query.q } : {}),
        ...(query.status ? { status: query.status } : {}),
        take: query.take,
        skip: query.skip,
      }),
    placeholderData: (previous) => previous,
  });
}

export function useBom(id: string) {
  return useQuery({
    queryKey: bomKeys.detail(id),
    queryFn: () => api.get<BomDetail>(`/v1/inventory/boms/${id}`),
    enabled: id !== '' && id !== 'new',
  });
}

export function useBuildable(bomId: string, warehouseId: string) {
  return useQuery({
    queryKey: bomKeys.buildable(bomId, warehouseId),
    queryFn: () =>
      api.get<Buildable>(`/v1/inventory/boms/${bomId}/buildable`, { warehouse_id: warehouseId }),
    enabled: bomId !== '' && bomId !== 'new' && warehouseId !== '',
  });
}

export interface BomComponentInput {
  variantId: string;
  quantityPer: number;
  scrapPercent?: number;
  notes?: string;
}

export interface BomInput {
  outputVariantId: string;
  name: string;
  outputQuantity?: number;
  laborCostCents?: number;
  notes?: string;
  components: BomComponentInput[];
}

export function useSaveBom(id: string) {
  const queryClient = useQueryClient();
  const isNew = id === 'new';
  return useMutation({
    mutationFn: (input: BomInput) =>
      isNew
        ? api.post<BomDetail>('/v1/inventory/boms', input)
        : api.patch<BomDetail>(`/v1/inventory/boms/${id}`, {
            name: input.name,
            outputQuantity: input.outputQuantity,
            laborCostCents: input.laborCostCents,
            notes: input.notes ?? null,
            components: input.components,
          }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bomKeys.all });
    },
  });
}

export function useSetBomStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: BomStatus) =>
      api.post<BomDetail>(`/v1/inventory/boms/${id}/status`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bomKeys.all });
    },
  });
}

export function useDeleteBom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ id: string }>(`/v1/inventory/boms/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bomKeys.all });
    },
  });
}

/* ── Runs ───────────────────────────────────────────────────────────────── */

export interface AssemblyListQuery {
  q: string;
  status: string;
  kind: string;
  warehouseId: string;
  take: number;
  skip: number;
}

export function useAssemblyOrders(query: AssemblyListQuery) {
  return useQuery({
    queryKey: assemblyKeys.list(query),
    queryFn: () =>
      api.list<AssemblyOrder>('/v1/inventory/assemblies', {
        ...(query.q ? { q: query.q } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.warehouseId ? { warehouse_id: query.warehouseId } : {}),
        take: query.take,
        skip: query.skip,
      }),
    placeholderData: (previous) => previous,
  });
}

export function useAssemblyOrder(id: string) {
  return useQuery({
    queryKey: assemblyKeys.detail(id),
    queryFn: () => api.get<AssemblyOrderDetail>(`/v1/inventory/assemblies/${id}`),
    enabled: id !== '' && id !== 'new',
  });
}

export interface PlanRunInput {
  kind?: AssemblyKind;
  bomId?: string;
  outputVariantId?: string;
  warehouseId: string;
  quantity: number;
  plannedFor?: string;
  notes?: string;
}

export function usePlanRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PlanRunInput) =>
      api.post<AssemblyOrderDetail>('/v1/inventory/assemblies', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: assemblyKeys.all });
      void queryClient.invalidateQueries({ queryKey: bomKeys.all });
    },
  });
}

/**
 * Every run action reaches the STOCK caches too.
 *
 * Releasing holds parts (available goes down), completing moves them (on-hand
 * changes on every component and on the finished item), and cancelling gives
 * the hold back. A stock figure left on screen beside a freshly-completed build
 * is wrong in exactly the way this feature exists to prevent.
 */
function useRunAction<TInput>(run: (input: TInput) => Promise<AssemblyOrderDetail>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: assemblyKeys.all });
      void queryClient.invalidateQueries({ queryKey: bomKeys.all });
      void queryClient.invalidateQueries({ queryKey: stockKeys.all });
    },
  });
}

export function useReleaseRun(id: string) {
  return useRunAction<void>(() =>
    api.post<AssemblyOrderDetail>(`/v1/inventory/assemblies/${id}/release`, {})
  );
}

export interface CompleteRunInput {
  quantity?: number;
  laborCostCents?: number;
  note?: string;
}

export function useCompleteRun(id: string) {
  return useRunAction<CompleteRunInput>((input) =>
    api.post<AssemblyOrderDetail>(`/v1/inventory/assemblies/${id}/complete`, input)
  );
}

export function useCancelRun(id: string) {
  return useRunAction<string | undefined>((reason) =>
    api.post<AssemblyOrderDetail>(`/v1/inventory/assemblies/${id}/cancel`, {
      ...(reason ? { reason } : {}),
    })
  );
}

/* ── Saying it in shop words ────────────────────────────────────────────── */

/** Where a run has got to. Color carries the state: planned is neutral because
 *  nothing has happened yet, released is amber because stock is now spoken for,
 *  finished is green, cancelled is a dead end. */
export function runState(status: AssemblyStatus): { label: string; tone: Tone } {
  switch (status) {
    case 'planned':
      return { label: 'On paper', tone: 'neutral' };
    case 'released':
      return { label: 'Parts held', tone: 'warning' };
    case 'completed':
      return { label: 'Made', tone: 'success' };
    case 'cancelled':
      return { label: 'Called off', tone: 'danger' };
  }
}

export function bomState(status: BomStatus): { label: string; tone: Tone } {
  switch (status) {
    case 'draft':
      return { label: 'Draft', tone: 'neutral' };
    case 'active':
      return { label: 'In use', tone: 'success' };
    case 'archived':
      return { label: 'Retired', tone: 'neutral' };
  }
}

export function runKindLabel(kind: AssemblyKind): string {
  return kind === 'assemble' ? 'Making' : 'Taking apart';
}

/** How comfortable a buildable figure is against what someone wants to make. */
export function buildableTone(quantity: number, wanted: number): Tone {
  if (quantity <= 0) return 'danger';
  if (quantity < wanted) return 'warning';
  return 'success';
}

/**
 * A quantity with its pack equivalent, for a table cell.
 *
 * Deliberately a thin wrapper over the shared pure helper rather than its own
 * arithmetic: the browser must never be a second place where a pack factor is
 * applied, because two places is one disagreement away.
 */
export { describeQuantity, describeQuantityShort } from '@wizeworks/commerce-schemas';
