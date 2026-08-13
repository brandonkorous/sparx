'use client';

// ══════════════════════════════════════════════════════════════════════════
// WHAT HAS BEEN PROMISED, WHAT IS NOT OURS, AND WHAT IS RUNNING OUT OF TIME
// (docs/146 Phase 9)
//
// Four screens' worth of data in one module because they share one shape of
// truth, and it is a shape this codebase has had to learn twice: A NUMBER
// NOBODY MEASURED MUST NOT RENDER AS ONE.
//
// Here it is dates. `promisedAt` is null until a real purchase order or a
// measured lead time produced it, `availableAt` is null until the factory
// committed, `expiresAt` is null when nobody keyed it. Every one of those nulls
// has its own sentence on screen — "no date yet", "to be confirmed", "no date
// recorded" — because a blank cell reads as a bug and an invented date reads as
// a promise.
//
// The counts that travel WITH each list exist for the same reason. A backorder
// screen showing "0 overdue" while forty rows have no date at all is telling a
// comfortable lie; `undatedCount` is what makes the screen honest.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { api } from '../../lib/api/client';
import type { Tone } from './data';
import { stockKeys } from './data';

/* ── Backorders ─────────────────────────────────────────────────────────── */

export interface Backorder {
  id: string;
  variantId: string;
  variantSku: string | null;
  variantName: string | null;
  warehouseId: string;
  warehouseName: string | null;
  quantity: number;
  allocatedQuantity: number;
  outstanding: number;
  status: string;
  holderType: string;
  holderId: string;
  orderNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  priority: number;
  /** Place in the queue, 1-based. Null once the row has left the queue. */
  position: number | null;
  /** Null means NOBODY HAS PROMISED ANYTHING. Rendered as "no date yet". */
  promisedAt: string | null;
  /** `purchase_order` | `lead_time` | `manual` — how much the date is worth. */
  promiseSource: string | null;
  expectedPurchaseOrderId: string | null;
  expectedPurchaseOrderNumber: string | null;
  /** Only ever true when there IS a date and it has gone by. An undated row is
   *  never overdue — you cannot be late for a date nobody set. */
  isOverdue: boolean;
  notifiedAt: string | null;
  createdAt: string;
}

export interface BackorderAllocation {
  id: string;
  quantity: number;
  sourceType: string;
  sourceId: string | null;
  movementId: string | null;
  allocatedAt: string;
}

export interface BackorderDetail extends Backorder {
  note: string | null;
  allocations: BackorderAllocation[];
}

export interface BackorderList {
  items: Backorder[];
  total: number;
  /** The buyer's work list: commitments nobody can put a date on. */
  undatedCount: number;
  overdueCount: number;
  unitsOutstanding: number;
  skip: number;
  take: number;
}

export const backorderKeys = {
  all: ['inventory', 'backorders'] as const,
  list: (filter: string) => [...backorderKeys.all, 'list', filter] as const,
  detail: (id: string) => [...backorderKeys.all, 'detail', id] as const,
};

export interface BackorderQuery {
  status?: 'open' | 'partial' | 'allocated' | 'fulfilled' | 'cancelled';
  undatedOnly?: boolean;
  overdueOnly?: boolean;
  variantId?: string;
  warehouseId?: string;
  customerId?: string;
}

export function useBackorders(query: BackorderQuery = {}) {
  const key = [
    query.status ?? 'any',
    query.undatedOnly ? 'undated' : '',
    query.overdueOnly ? 'overdue' : '',
    query.variantId ?? '',
    query.warehouseId ?? '',
    query.customerId ?? '',
  ].join(':');
  return useQuery({
    queryKey: backorderKeys.list(key),
    queryFn: () =>
      api.get<BackorderList>('/v1/inventory/backorders', {
        ...(query.status ? { status: query.status } : {}),
        ...(query.undatedOnly ? { undated_only: true } : {}),
        ...(query.overdueOnly ? { overdue_only: true } : {}),
        ...(query.variantId ? { variant_id: query.variantId } : {}),
        ...(query.warehouseId ? { warehouse_id: query.warehouseId } : {}),
        ...(query.customerId ? { customer_id: query.customerId } : {}),
        take: 200,
      }),
    placeholderData: (previous) => previous,
  });
}

export function useBackorder(id: string) {
  return useQuery({
    queryKey: backorderKeys.detail(id),
    queryFn: () => api.get<BackorderDetail>(`/v1/inventory/backorders/${id}`),
    enabled: id !== '',
  });
}

function useInvalidateBackorders() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: backorderKeys.all });
  };
}

export interface BackorderPatch {
  priority?: number;
  /** Explicit null CLEARS the promise, which is a real thing to want when a date
   *  turns out to be wrong. Leaving a date everyone knows is dead on the screen
   *  is worse than showing none. */
  promisedAt?: string | null;
  expectedPurchaseOrderId?: string | null;
  note?: string | null;
}

export function useUpdateBackorder(id: string) {
  const invalidate = useInvalidateBackorders();
  return useMutation({
    mutationFn: (input: BackorderPatch) =>
      api.patch<BackorderDetail>(`/v1/inventory/backorders/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useCancelBackorder(id: string) {
  const invalidate = useInvalidateBackorders();
  return useMutation({
    mutationFn: (reason: string) =>
      api.post<BackorderDetail>(`/v1/inventory/backorders/${id}/cancel`, { reason }),
    onSuccess: invalidate,
  });
}

export function useMarkBackorderNotified(id: string) {
  const invalidate = useInvalidateBackorders();
  return useMutation({
    mutationFn: () => api.post<BackorderDetail>(`/v1/inventory/backorders/${id}/notified`, {}),
    onSuccess: invalidate,
  });
}

export interface BackorderSweepResult {
  considered: number;
  newlyDated: number;
  redated: number;
  worthTelling: number;
  stillUndated: number;
}

/** Re-resolve every open commitment against today's purchase orders. The nightly
 *  pass does this too; the button exists because the useful moment is right
 *  after raising an order. */
export function useRefreshPromises() {
  const invalidate = useInvalidateBackorders();
  return useMutation({
    mutationFn: () =>
      api.post<BackorderSweepResult>('/v1/inventory/backorders/refresh-promises', {}),
    onSuccess: invalidate,
  });
}

/** How much a promised date is worth, in the words a person would use. */
export function promiseSourceLabel(source: string | null): string {
  switch (source) {
    case 'purchase_order':
      return 'From a placed order';
    case 'lead_time':
      return 'Estimated from past deliveries';
    case 'manual':
      return 'Entered by hand';
    default:
      return 'No date yet';
  }
}

/** The confidence a date carries. `neutral` for "none", which is honest: no date
 *  is not a warning, it is an absence — the WARNING is an overdue one. */
export function promiseTone(source: string | null): Tone {
  switch (source) {
    case 'purchase_order':
      return 'success';
    case 'lead_time':
      return 'info';
    case 'manual':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function backorderStatusTone(status: string): Tone {
  switch (status) {
    case 'allocated':
      return 'success';
    case 'partial':
      return 'info';
    case 'open':
      return 'warning';
    case 'fulfilled':
      return 'success';
    case 'cancelled':
      return 'neutral';
    default:
      return 'neutral';
  }
}

/* ── Preorder windows ───────────────────────────────────────────────────── */

export interface PreorderWindow {
  id: string;
  variantId: string;
  variantSku: string | null;
  variantName: string | null;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  /** Null means TO BE CONFIRMED. Never render it as blank. */
  availableAt: string | null;
  availabilityNote: string | null;
  isCapped: boolean;
  maxQuantity: number;
  soldQuantity: number;
  /** Null when uncapped — render nothing, never a number. */
  remaining: number | null;
  isTakingOrders: boolean;
  effectiveStatus: string;
  blockedBy: string | null;
  chargeUpFront: boolean;
  note: string | null;
  createdAt: string;
}

export const preorderKeys = {
  all: ['inventory', 'preorders'] as const,
  list: (filter: string) => [...preorderKeys.all, 'list', filter] as const,
  detail: (id: string) => [...preorderKeys.all, 'detail', id] as const,
};

export function usePreorderWindows(query: { status?: string; variantId?: string } = {}) {
  const key = `${query.status ?? 'any'}:${query.variantId ?? ''}`;
  return useQuery({
    queryKey: preorderKeys.list(key),
    queryFn: () =>
      api.list<PreorderWindow>('/v1/inventory/preorders', {
        ...(query.status ? { status: query.status } : {}),
        ...(query.variantId ? { variant_id: query.variantId } : {}),
        take: 200,
      }),
    placeholderData: (previous) => previous,
  });
}

export function usePreorderWindow(id: string) {
  return useQuery({
    queryKey: preorderKeys.detail(id),
    queryFn: () => api.get<PreorderWindow>(`/v1/inventory/preorders/${id}`),
    enabled: id !== '' && id !== 'new',
  });
}

export interface PreorderWindowInput {
  startsAt?: string | null;
  endsAt?: string | null;
  availableAt?: string | null;
  availabilityNote?: string | null;
  isCapped?: boolean;
  maxQuantity?: number;
  chargeUpFront?: boolean;
  note?: string | null;
}

function useInvalidatePreorders() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: preorderKeys.all });
  };
}

export function useOpenPreorder(variantId: string) {
  const invalidate = useInvalidatePreorders();
  return useMutation({
    mutationFn: (input: PreorderWindowInput) =>
      api.post<PreorderWindow>(`/v1/inventory/variants/${variantId}/preorder`, input),
    onSuccess: invalidate,
  });
}

export function useUpdatePreorder(id: string) {
  const invalidate = useInvalidatePreorders();
  return useMutation({
    mutationFn: (input: PreorderWindowInput) =>
      api.patch<PreorderWindow>(`/v1/inventory/preorders/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useClosePreorder(id: string) {
  const invalidate = useInvalidatePreorders();
  return useMutation({
    mutationFn: (status: 'closed' | 'cancelled') =>
      api.post<PreorderWindow>(`/v1/inventory/preorders/${id}/close`, { status }),
    onSuccess: invalidate,
  });
}

export function preorderTone(window: PreorderWindow): Tone {
  if (window.effectiveStatus === 'cancelled') return 'neutral';
  if (window.blockedBy === 'sold_out') return 'danger';
  if (window.blockedBy === 'not_started') return 'info';
  if (!window.isTakingOrders) return 'neutral';
  return 'success';
}

export function preorderStateLabel(window: PreorderWindow): string {
  if (window.isTakingOrders) return 'Taking orders';
  switch (window.blockedBy) {
    case 'not_started':
      return 'Opens later';
    case 'sold_out':
      return 'Sold out';
    case 'ended':
      return 'Ended';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Closed';
  }
}

/* ── Stock ownership ────────────────────────────────────────────────────── */

export interface OwnedStock {
  variantId: string;
  variantSku: string | null;
  variantName: string | null;
  warehouseId: string;
  warehouseName: string | null;
  ownership: string;
  ownerSupplierId: string | null;
  ownerSupplierName: string | null;
  ownerCustomerId: string | null;
  ownerCustomerName: string | null;
  onHand: number;
  /** Null when nothing has ever costed the item — NOT zero. */
  valueCents: number | null;
  countsTowardValuation: boolean;
}

export interface OwnedStockList {
  items: OwnedStock[];
  total: number;
  totalValueCents: number;
  skip: number;
  take: number;
}

export const ownershipKeys = {
  all: ['inventory', 'ownership'] as const,
  list: (filter: string) => [...ownershipKeys.all, 'list', filter] as const,
};

export function useNonOwnedStock(query: { ownership?: string; warehouseId?: string } = {}) {
  const key = `${query.ownership ?? 'not-owned'}:${query.warehouseId ?? ''}`;
  return useQuery({
    queryKey: ownershipKeys.list(key),
    queryFn: () =>
      api.get<OwnedStockList>('/v1/inventory/ownership', {
        ...(query.ownership ? { ownership: query.ownership } : {}),
        ...(query.warehouseId ? { warehouse_id: query.warehouseId } : {}),
        take: 200,
      }),
    placeholderData: (previous) => previous,
  });
}

export interface SetOwnershipInput {
  variantId: string;
  warehouseId: string;
  ownership: 'owned' | 'consignment' | 'customer_owned' | '3pl_owned';
  ownerSupplierId?: string | null;
  ownerCustomerId?: string | null;
}

export function useSetOwnership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SetOwnershipInput) =>
      api.post<{ updated: boolean }>('/v1/inventory/ownership', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ownershipKeys.all });
      // Ownership decides what counts toward valuation, so every money screen
      // over stock is stale the moment it changes.
      void queryClient.invalidateQueries({ queryKey: stockKeys.all });
    },
  });
}

export function ownershipLabel(ownership: string): string {
  switch (ownership) {
    case 'owned':
      return 'Yours';
    case 'consignment':
      return 'On consignment';
    case 'customer_owned':
      return "A customer's";
    case '3pl_owned':
      return 'Your warehouse partner’s';
    default:
      return ownership;
  }
}

export function ownershipTone(ownership: string): Tone {
  switch (ownership) {
    case 'owned':
      return 'success';
    case 'consignment':
      return 'module-inventory';
    case 'customer_owned':
      return 'module-crm';
    case '3pl_owned':
      return 'info';
    default:
      return 'neutral';
  }
}

/* ── Consignment settlement ─────────────────────────────────────────────── */

export interface ConsignmentSettlement {
  id: string;
  number: string;
  ownerType: string;
  supplierId: string | null;
  supplierName: string | null;
  customerId: string | null;
  customerName: string | null;
  periodStart: string;
  periodEnd: string;
  status: string;
  currency: string;
  totalCents: number;
  unitsSold: number;
  supplierBillId: string | null;
  note: string | null;
  closedAt: string | null;
  invoicedAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface ConsignmentSettlementLine {
  id: string;
  variantId: string;
  variantSku: string | null;
  variantName: string | null;
  warehouseId: string;
  warehouseName: string | null;
  unitsSold: number;
  unitCostCents: number;
  amountCents: number;
  movementIds: string[];
}

export interface ConsignmentSettlementDetail extends ConsignmentSettlement {
  lines: ConsignmentSettlementLine[];
  /** Units that sold from consigned stock with no cost recorded. NOT valued at
   *  zero — a settlement line reading nothing means "they gave it to us", which
   *  is the most expensive possible way to be wrong about money owed. */
  unpricedUnits: number;
}

export interface ConsignmentSettlementList {
  items: ConsignmentSettlement[];
  total: number;
  /** Closed and invoiced but unpaid — what is actually owed right now. */
  owedCents: number;
  skip: number;
  take: number;
}

export interface UnsettledConsignment {
  ownerType: string;
  ownerId: string;
  ownerName: string | null;
  unitsSold: number;
  amountCents: number;
  unpricedUnits: number;
  /** Null when nothing has ever been settled with this owner — a new
   *  arrangement, and worth saying out loud. */
  settledThrough: string | null;
  earliestUnsettledSaleAt: string | null;
}

export const consignmentKeys = {
  all: ['inventory', 'consignment'] as const,
  list: (filter: string) => [...consignmentKeys.all, 'list', filter] as const,
  detail: (id: string) => [...consignmentKeys.all, 'detail', id] as const,
  unsettled: () => [...consignmentKeys.all, 'unsettled'] as const,
};

export function useConsignmentSettlements(query: { status?: string } = {}) {
  return useQuery({
    queryKey: consignmentKeys.list(query.status ?? 'any'),
    queryFn: () =>
      api.get<ConsignmentSettlementList>('/v1/inventory/consignment/settlements', {
        ...(query.status ? { status: query.status } : {}),
        take: 200,
      }),
    placeholderData: (previous) => previous,
  });
}

export function useUnsettledConsignment() {
  return useQuery({
    queryKey: consignmentKeys.unsettled(),
    queryFn: () => api.list<UnsettledConsignment>('/v1/inventory/consignment/unsettled'),
  });
}

export function useConsignmentSettlement(id: string) {
  return useQuery({
    queryKey: consignmentKeys.detail(id),
    queryFn: () =>
      api.get<ConsignmentSettlementDetail>(`/v1/inventory/consignment/settlements/${id}`),
    enabled: id !== '' && id !== 'new',
  });
}

function useInvalidateConsignment() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: consignmentKeys.all });
  };
}

export interface CreateSettlementInput {
  ownerType: 'supplier' | 'customer';
  supplierId?: string;
  customerId?: string;
  periodStart: string;
  periodEnd: string;
  note?: string;
}

export function useCreateSettlement() {
  const invalidate = useInvalidateConsignment();
  return useMutation({
    mutationFn: (input: CreateSettlementInput) =>
      api.post<ConsignmentSettlementDetail>('/v1/inventory/consignment/settlements', input),
    onSuccess: invalidate,
  });
}

function settlementAction(id: string, action: string) {
  return () =>
    api.post<ConsignmentSettlementDetail>(
      `/v1/inventory/consignment/settlements/${id}/${action}`,
      {}
    );
}

export function useRefreshSettlement(id: string) {
  const invalidate = useInvalidateConsignment();
  return useMutation({ mutationFn: settlementAction(id, 'refresh'), onSuccess: invalidate });
}

export function useCloseSettlement(id: string) {
  const invalidate = useInvalidateConsignment();
  return useMutation({ mutationFn: settlementAction(id, 'close'), onSuccess: invalidate });
}

export function useMarkSettlementPaid(id: string) {
  const invalidate = useInvalidateConsignment();
  return useMutation({ mutationFn: settlementAction(id, 'paid'), onSuccess: invalidate });
}

export function useCancelSettlement(id: string) {
  const invalidate = useInvalidateConsignment();
  return useMutation({ mutationFn: settlementAction(id, 'cancel'), onSuccess: invalidate });
}

export function settlementTone(status: string): Tone {
  switch (status) {
    case 'paid':
      return 'success';
    case 'invoiced':
      return 'info';
    case 'closed':
      return 'warning';
    case 'draft':
      return 'neutral';
    case 'cancelled':
      return 'neutral';
    default:
      return 'neutral';
  }
}

/* ── Expiring stock ─────────────────────────────────────────────────────── */

export type ExpiryBucket = 'expired' | 'd30' | 'd60' | 'd90' | 'beyond' | 'undated';

export interface ExpiringLot {
  lotId: string;
  lotNumber: string;
  variantId: string;
  variantSku: string | null;
  variantName: string | null;
  warehouseId: string;
  warehouseName: string | null;
  quantity: number;
  /** Null when the batch carries no date. */
  expiresAt: string | null;
  daysRemaining: number | null;
  bucket: ExpiryBucket;
  /** Null when nothing has ever costed the item. A zero here would rank a real
   *  exposure last on a screen sorted by money. */
  valueCents: number | null;
  recallStatus: string | null;
  alertedAt: string | null;
}

export interface ExpiryBucketSummary {
  bucket: ExpiryBucket;
  lots: number;
  units: number;
  /** Null when NONE of the bucket's lots could be costed. */
  valueCents: number | null;
  uncostedLots: number;
}

export interface ExpiringStockReport {
  items: ExpiringLot[];
  buckets: ExpiryBucketSummary[];
  undatedLots: number;
}

export const expiryKeys = {
  all: ['inventory', 'expiring'] as const,
  report: (filter: string) => [...expiryKeys.all, 'report', filter] as const,
};

export function useExpiringStock(query: { withinDays?: number; warehouseId?: string } = {}) {
  const key = `${query.withinDays ?? 90}:${query.warehouseId ?? ''}`;
  return useQuery({
    queryKey: expiryKeys.report(key),
    queryFn: () =>
      api.get<ExpiringStockReport>('/v1/inventory/expiring', {
        ...(query.withinDays ? { within_days: query.withinDays } : {}),
        ...(query.warehouseId ? { warehouse_id: query.warehouseId } : {}),
      }),
    placeholderData: (previous) => previous,
  });
}

function useInvalidateExpiry() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: expiryKeys.all });
    void queryClient.invalidateQueries({ queryKey: stockKeys.all });
  };
}

export function useMarkdownLot() {
  const invalidate = useInvalidateExpiry();
  return useMutation({
    mutationFn: (input: { lotId: string; discountPercent: number; note?: string }) =>
      api.post<{ variantId: string; priceCentsBefore: number; priceCentsAfter: number }>(
        '/v1/inventory/expiring/markdown',
        input
      ),
    onSuccess: invalidate,
  });
}

export function useWriteOffLot() {
  const invalidate = useInvalidateExpiry();
  return useMutation({
    mutationFn: (input: { lotId: string; quantity?: number; reason: string }) =>
      api.post<{ unitsWrittenOff: number; valueCents: number | null }>(
        '/v1/inventory/expiring/write-off',
        input
      ),
    onSuccess: invalidate,
  });
}

export function bucketLabel(bucket: ExpiryBucket): string {
  switch (bucket) {
    case 'expired':
      return 'Already expired';
    case 'd30':
      return 'Within 30 days';
    case 'd60':
      return '30–60 days';
    case 'd90':
      return '60–90 days';
    case 'beyond':
      return 'More than 90 days';
    // Its own bucket on purpose. A batch with no date is not one that expires
    // late — it is one nobody recorded, which is a different problem and needs a
    // different colour.
    case 'undated':
      return 'No date recorded';
  }
}

export function bucketTone(bucket: ExpiryBucket): Tone {
  switch (bucket) {
    case 'expired':
      return 'danger';
    case 'd30':
      return 'warning';
    case 'd60':
      return 'module-inventory';
    case 'd90':
      return 'info';
    case 'beyond':
      return 'success';
    case 'undated':
      return 'neutral';
  }
}
