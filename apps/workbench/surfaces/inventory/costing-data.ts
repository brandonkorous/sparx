'use client';

// ══════════════════════════════════════════════════════════════════════════
// TRUE COST — WHAT IT REALLY COST YOU
//
// A supplier's invoice is not what stock costs. The freight, the duty, the
// customs broker and the insurance are real money spent to get the pallet here,
// and on imported goods they routinely add 15–30%. A business pricing off the
// invoice line is quietly selling its thinnest lines at a loss and cannot see it.
//
// This module is the data layer for the four screens that fix that:
//
//   the delivery breakdown   goods → charges → what a unit really cost
//   charges on an order      the freight you were quoted, spread over deliveries
//   how you value stock      moving average / FIFO / standard, and the currency
//   cost vs plan             what you budgeted against what you actually paid
//
// Every figure comes from the server. Landed cost is an allocation across ALL
// the lines on a delivery, valuation-as-of walks two append-only ledgers, and
// cost-versus-plan is a group-by over every delivery in a period — none of them
// is a sum over the rows that happened to load.
//
//   GET/PATCH /v1/inventory/costing/policy
//   GET/POST  /v1/inventory/purchase-orders/:id/charges
//   GET/POST  /v1/inventory/receipts/:id/charges
//   GET       /v1/inventory/receipts/:id/landed-cost
//   GET       /v1/inventory/costing/layers
//   GET       /v1/inventory/reports/valuation-as-of | price-variance | cogs
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { api } from '../../lib/api/client';
import { stockKeys, type Tone } from './data';
import { purchaseOrderKeys } from './purchase-orders-data';
import { receiptKeys } from './receiving-data';

/* ── Vocabulary ─────────────────────────────────────────────────────────── */

export type ChargeKind = 'freight' | 'duty' | 'insurance' | 'broker' | 'handling' | 'other';
export type AllocationBasis = 'value' | 'quantity' | 'weight' | 'manual';
export type CostingMethod = 'moving_average' | 'fifo' | 'standard';

/** What the money was spent on, in the words a business would use. */
export const CHARGE_KINDS: { value: ChargeKind; label: string; hint: string }[] = [
  { value: 'freight', label: 'Shipping', hint: 'What it cost to get the goods to you' },
  { value: 'duty', label: 'Import duty', hint: 'Paid at the border, usually on value' },
  { value: 'insurance', label: 'Insurance', hint: 'Cover on the shipment itself' },
  { value: 'broker', label: 'Customs broker', hint: 'The fee for clearing it through customs' },
  { value: 'handling', label: 'Handling', hint: 'Unloading, palletising, storage on the way' },
  { value: 'other', label: 'Something else', hint: 'Anything the list above does not cover' },
];

export function chargeKindLabel(kind: string): string {
  return CHARGE_KINDS.find((k) => k.value === kind)?.label ?? 'Other cost';
}

/**
 * How a cost is spread over the things it arrived with, said plainly.
 *
 * The choice matters more than it looks: a per-pallet handling fee spread by
 * value puts most of itself on the expensive small thing, and shipping spread by
 * value undercharges the heavy cheap thing that actually filled the lorry.
 */
export const ALLOCATION_BASES: { value: AllocationBasis; label: string; hint: string }[] = [
  {
    value: 'value',
    label: 'By what each item is worth',
    hint: 'The usual choice, and the right one for duty and insurance — both go up with value.',
  },
  {
    value: 'quantity',
    label: 'By how many of each',
    hint: 'Right for a per-box or per-unit fee, where the price of the item is beside the point.',
  },
  {
    value: 'weight',
    label: 'By weight',
    hint: 'What a carrier actually charges on. Best when a delivery mixes heavy and light goods.',
  },
  {
    value: 'manual',
    label: 'I will say how much goes where',
    hint: 'For the cost that exists because of one item — a crate built for a single machine.',
  },
];

export function basisLabel(basis: string): string {
  return ALLOCATION_BASES.find((b) => b.value === basis)?.label ?? 'By what each item is worth';
}

/** The three ways to value stock, each described by what it is FOR. */
export const COSTING_METHODS: { value: CostingMethod; label: string; hint: string }[] = [
  {
    value: 'moving_average',
    label: 'Average cost',
    hint: 'Every unit is worth the running average of everything you have bought. Nothing to explain to anyone, and price swings even out. Right for most businesses.',
  },
  {
    value: 'fifo',
    label: 'Oldest stock first',
    hint: 'The units you sell are costed at what the oldest ones on the shelf cost. What an accountant means by FIFO, and what you want if prices have moved a lot or your stock has a shelf life.',
  },
  {
    value: 'standard',
    label: 'A planned cost',
    hint: 'Every unit costs the figure you planned, and the difference from what you actually paid is reported as a variance instead of disappearing into the average. For anyone doing real cost control.',
  },
];

export function methodLabel(method: string): string {
  return COSTING_METHODS.find((m) => m.value === method)?.label ?? 'Average cost';
}

/* ── Shapes ─────────────────────────────────────────────────────────────── */

export interface CostingPolicy {
  method: CostingMethod;
  defaultAllocationBasis: AllocationBasis;
  baseCurrency: string;
  /** False until someone has actually chosen — so the screen can say "you are on
   *  the default" rather than implying a decision nobody made. */
  configured: boolean;
  updatedAt: string | null;
}

export interface Charge {
  id: string;
  kind: ChargeKind;
  description: string | null;
  amountCents: number;
  allocationBasis: AllocationBasis;
  /** Order charges only: how much of it has already landed on a delivery. */
  allocatedCents?: number;
  createdAt: string;
}

export interface LandedCostLine {
  receiptLineId: string;
  variantId: string;
  quantity: number;
  invoiceUnitCostCents: number;
  baseUnitCostCents: number;
  allocatedChargeCents: number;
  landedUnitCostCents: number;
}

export interface LandedCostCharge {
  chargeId: string;
  origin: 'order' | 'delivery';
  kind: ChargeKind;
  description: string | null;
  amountCents: number;
  basis: AllocationBasis;
  /** The chosen basis could not be used — usually weight, on goods with no
   *  weights recorded — so units were used instead. Shown, never swallowed. */
  basisFellBack: boolean;
  perLine: Record<string, number>;
}

export interface LandedCost {
  receiptId: string;
  currency: string;
  baseCurrency: string;
  fxRate: number;
  goodsValueCents: number;
  chargeTotalCents: number;
  landedTotalCents: number;
  lines: LandedCostLine[];
  charges: LandedCostCharge[];
}

export interface CostLayer {
  id: string;
  variantId: string;
  warehouseId: string;
  quantity: number;
  quantityRemaining: number;
  unitCostCents: number;
  goodsUnitCostCents: number;
  sourceType: string;
  sourceId: string | null;
  acquiredAt: string;
}

export interface CostLayers {
  units: number;
  valueCents: number;
  layers: CostLayer[];
}

export interface AsOfValuationRow {
  variantId: string;
  sku: string | null;
  title: string | null;
  warehouseId: string;
  warehouseCode: string;
  units: number;
  unitsCovered: number;
  valueCents: number;
}

export interface AsOfValuation {
  asOf: string;
  totalUnits: number;
  totalUnitsCovered: number;
  totalValueCents: number;
  /** Units on hand with no purchase history behind them. Zero is normal. */
  uncostedUnits: number;
  currency: string;
  rows: AsOfValuationRow[];
}

export interface PriceVarianceRow {
  variantId: string;
  sku: string | null;
  title: string | null;
  supplierId: string | null;
  supplierName: string | null;
  unitsReceived: number;
  standardUnitCostCents: number | null;
  actualUnitCostCents: number;
  varianceCents: number;
  variancePercent: number | null;
}

export interface PriceVariance {
  from: string;
  to: string;
  currency: string;
  totalUnits: number;
  totalStandardCents: number;
  totalActualCents: number;
  totalVarianceCents: number;
  unitsWithoutStandard: number;
  rows: PriceVarianceRow[];
}

export interface CogsByReason {
  reason: string;
  units: number;
  costCents: number;
  movements: number;
}

export interface CogsReport {
  from: string;
  to: string;
  currency: string;
  totalCostCents: number;
  saleCostCents: number;
  unattributedUnits: number;
  byReason: CogsByReason[];
}

/* ── Query keys ─────────────────────────────────────────────────────────── */

export const costingKeys = {
  all: ['inventory', 'costing'] as const,
  policy: () => [...costingKeys.all, 'policy'] as const,
  orderCharges: (id: string) => [...costingKeys.all, 'order-charges', id] as const,
  receiptCharges: (id: string) => [...costingKeys.all, 'receipt-charges', id] as const,
  landed: (id: string) => [...costingKeys.all, 'landed', id] as const,
  layers: (variantId: string, warehouseId: string) =>
    [...costingKeys.all, 'layers', variantId, warehouseId] as const,
  asOf: (asOf: string, warehouseId: string) =>
    [...costingKeys.all, 'as-of', asOf, warehouseId] as const,
  variance: (range: { from: string; to: string }, warehouseId: string) =>
    [...costingKeys.all, 'variance', range, warehouseId] as const,
  cogs: (range: { from: string; to: string }, warehouseId: string) =>
    [...costingKeys.all, 'cogs', range, warehouseId] as const,
};

/* ── Reads ──────────────────────────────────────────────────────────────── */

export function useCostingPolicy() {
  return useQuery({
    queryKey: costingKeys.policy(),
    queryFn: () => api.get<CostingPolicy>('/v1/inventory/costing/policy'),
  });
}

export function useOrderCharges(purchaseOrderId: string) {
  return useQuery({
    queryKey: costingKeys.orderCharges(purchaseOrderId),
    queryFn: () => api.get<Charge[]>(`/v1/inventory/purchase-orders/${purchaseOrderId}/charges`),
    enabled: purchaseOrderId !== '' && purchaseOrderId !== 'new',
  });
}

export function useReceiptCharges(receiptId: string) {
  return useQuery({
    queryKey: costingKeys.receiptCharges(receiptId),
    queryFn: () => api.get<Charge[]>(`/v1/inventory/receipts/${receiptId}/charges`),
    enabled: receiptId !== '' && receiptId !== 'new',
  });
}

export function useLandedCost(receiptId: string) {
  return useQuery({
    queryKey: costingKeys.landed(receiptId),
    queryFn: () => api.get<LandedCost>(`/v1/inventory/receipts/${receiptId}/landed-cost`),
    enabled: receiptId !== '' && receiptId !== 'new',
  });
}

export function useCostLayers(variantId: string, warehouseId?: string) {
  return useQuery({
    queryKey: costingKeys.layers(variantId, warehouseId ?? ''),
    queryFn: () =>
      api.get<CostLayers>('/v1/inventory/costing/layers', {
        variant_id: variantId,
        ...(warehouseId ? { warehouse_id: warehouseId } : {}),
      }),
    enabled: variantId !== '',
  });
}

export function useValuationAsOf(asOf: string, warehouseId?: string) {
  return useQuery({
    queryKey: costingKeys.asOf(asOf, warehouseId ?? ''),
    queryFn: () =>
      api.get<AsOfValuation>('/v1/inventory/reports/valuation-as-of', {
        as_of: asOf,
        ...(warehouseId ? { warehouse_id: warehouseId } : {}),
        take: 25,
      }),
    enabled: asOf !== '',
    placeholderData: (previous) => previous,
  });
}

export function usePriceVariance(range: { from: string; to: string }, warehouseId?: string) {
  return useQuery({
    queryKey: costingKeys.variance(range, warehouseId ?? ''),
    queryFn: () =>
      api.get<PriceVariance>('/v1/inventory/reports/price-variance', {
        from: range.from,
        to: range.to,
        ...(warehouseId ? { warehouse_id: warehouseId } : {}),
        take: 50,
      }),
    placeholderData: (previous) => previous,
  });
}

export function useCogsReport(range: { from: string; to: string }, warehouseId?: string) {
  return useQuery({
    queryKey: costingKeys.cogs(range, warehouseId ?? ''),
    queryFn: () =>
      api.get<CogsReport>('/v1/inventory/reports/cogs', {
        from: range.from,
        to: range.to,
        ...(warehouseId ? { warehouse_id: warehouseId } : {}),
      }),
    placeholderData: (previous) => previous,
  });
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

export interface ChargeInput {
  kind: ChargeKind;
  description?: string;
  amountCents: number;
  allocationBasis?: AllocationBasis;
}

/**
 * Every charge write invalidates the STOCK caches as well as its own.
 *
 * That is not belt and braces. Recording a freight bill changes what the units
 * still on the shelf are worth — the cost layers and the running average both
 * move — so a valuation figure left on screen beside a freshly-entered £212 of
 * shipping would be wrong in exactly the way the whole feature exists to fix.
 */
function useChargeMutation<TInput>(
  run: (input: TInput) => Promise<unknown>,
  keysToClear: () => readonly unknown[][]
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => {
      for (const key of keysToClear()) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      void queryClient.invalidateQueries({ queryKey: costingKeys.all });
      void queryClient.invalidateQueries({ queryKey: stockKeys.all });
    },
  });
}

export function useAddOrderCharge(purchaseOrderId: string) {
  return useChargeMutation<ChargeInput>(
    (input) => api.post<Charge>(`/v1/inventory/purchase-orders/${purchaseOrderId}/charges`, input),
    () => [[...purchaseOrderKeys.all], [...receiptKeys.all]]
  );
}

export function useRemoveOrderCharge() {
  return useChargeMutation<string>(
    (chargeId) => api.delete<{ id: string }>(`/v1/inventory/purchase-order-charges/${chargeId}`),
    () => [[...purchaseOrderKeys.all], [...receiptKeys.all]]
  );
}

export function useAddReceiptCharge(receiptId: string) {
  return useChargeMutation<ChargeInput>(
    (input) => api.post<Charge>(`/v1/inventory/receipts/${receiptId}/charges`, input),
    () => [[...receiptKeys.all], [...purchaseOrderKeys.all]]
  );
}

export function useRemoveReceiptCharge() {
  return useChargeMutation<string>(
    (chargeId) => api.delete<{ id: string }>(`/v1/inventory/receipt-charges/${chargeId}`),
    () => [[...receiptKeys.all], [...purchaseOrderKeys.all]]
  );
}

export interface CostingPolicyInput {
  method?: CostingMethod;
  defaultAllocationBasis?: AllocationBasis;
  baseCurrency?: string;
}

export function useSaveCostingPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CostingPolicyInput) =>
      api.patch<CostingPolicy>('/v1/inventory/costing/policy', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: costingKeys.all });
      // How stock is valued changes every money figure downstream of it.
      void queryClient.invalidateQueries({ queryKey: stockKeys.all });
    },
  });
}

/* ── Saying what the numbers mean ───────────────────────────────────────── */

/**
 * How much of a unit's cost is NOT the goods, as a percentage.
 *
 * The number that makes the case for the whole feature: a business seeing "22%
 * of what this costs me is getting it here" prices differently the same
 * afternoon.
 */
export function chargeSharePercent(line: {
  baseUnitCostCents: number;
  allocatedChargeCents: number;
  quantity: number;
}): number | null {
  const goods = line.baseUnitCostCents * line.quantity;
  const total = goods + line.allocatedChargeCents;
  if (total <= 0) return null;
  return Math.round((line.allocatedChargeCents / total) * 1000) / 10;
}

/**
 * How worrying a share of extra cost is.
 *
 * Under 5% is noise. Up to 20% is normal for anything imported and worth being
 * aware of. Above that, the shipping is a bigger lever on margin than the
 * supplier's price is, which changes what you should be negotiating.
 */
export function chargeShareTone(percent: number | null): Tone {
  if (percent === null) return 'neutral';
  if (percent < 5) return 'success';
  if (percent <= 20) return 'info';
  return 'warning';
}

/**
 * Whether paying more than planned is worth flagging.
 *
 * Symmetrical on purpose — paying LESS than planned is not automatically good
 * news, because the commonest cause is a standard cost nobody has updated in two
 * years. Both directions earn a colour; only the direction differs.
 */
export function varianceTone(percent: number | null): Tone {
  if (percent === null) return 'neutral';
  if (percent > 10) return 'danger';
  if (percent > 2) return 'warning';
  if (percent < -10) return 'info';
  if (percent < -2) return 'success';
  return 'neutral';
}

/** A variance said as a direction, not a sign. */
export function varianceLabel(varianceCents: number): string {
  if (varianceCents === 0) return 'Exactly as planned';
  return varianceCents > 0 ? 'More than planned' : 'Less than planned';
}

/** Where a layer's units came from, in shop words. */
export function layerSourceLabel(sourceType: string): string {
  switch (sourceType) {
    case 'receipt':
      return 'A delivery';
    case 'return':
      return 'Came back from a customer';
    case 'transfer_in':
      return 'Moved from another location';
    case 'count':
      return 'Found at a count';
    case 'opening':
      return 'Stock you already had';
    default:
      return 'An adjustment';
  }
}

/** Why goods left, in shop words — the cost-of-goods breakdown's row labels. */
export function cogsReasonLabel(reason: string): string {
  switch (reason) {
    case 'sale':
      return 'Sold';
    case 'loss':
      return 'Gone missing';
    case 'damage':
      return 'Damaged or broken';
    case 'recount':
      return 'Adjusted at a count';
    case 'cancel':
      return 'Came back from a cancelled order';
    case 'return':
      return 'Returned by a customer';
    case 'transfer_out':
      return 'Moved to another location';
    case 'return_to_supplier':
      return 'Sent back to the supplier';
    default:
      return reason;
  }
}
