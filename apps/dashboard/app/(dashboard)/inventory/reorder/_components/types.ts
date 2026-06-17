// Shared client types for the reorder surface (docs/100 P3d). Plain TS — safe to
// import from both the server page and the client board. Shapes mirror the
// @sparx/inventory reorder serializers exposed by /v1/inventory/reorder/suggestions.

export { formatMoney, formatDate } from '../../purchase-orders/_components/types';

export interface ReorderSuggestionLine {
  variantId: string;
  warehouseId: string;
  sku: string | null;
  title: string | null;
  productId: string;
  onHand: number;
  available: number;
  reorderPoint: number;
  reorderQuantity: number | null;
  suggestedQuantity: number;
  onOrder: number;
  unitCostCents: number | null;
  estimatedCostCents: number | null;
  supplierSku: string | null;
}

export interface ReorderGroup {
  supplierId: string;
  supplierName: string;
  supplierCode: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  currency: string;
  leadTimeDays: number | null;
  expectedArrivalAt: string | null;
  lines: ReorderSuggestionLine[];
  estimatedTotalCents: number;
}

export interface UnsuppliedSuggestion {
  variantId: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string | null;
  sku: string | null;
  title: string | null;
  productId: string;
  onHand: number;
  available: number;
  reorderPoint: number;
  reorderQuantity: number | null;
  suggestedQuantity: number;
  onOrder: number;
}

export interface ReorderSuggestions {
  groups: ReorderGroup[];
  unsupplied: UnsuppliedSuggestion[];
  counts: { groups: number; lines: number; unsupplied: number };
}

// The draft action's reply.
export interface DraftedPurchaseOrder {
  id: string;
  number: string;
  supplierId: string;
  supplierName: string | null;
  warehouseId: string;
  warehouseName: string | null;
  lineCount: number;
  totalCents: number;
  currency: string;
}

export interface DraftReorderResult {
  purchaseOrders: DraftedPurchaseOrder[];
  count: number;
}

// A draft line the board submits per group.
export interface DraftReorderLine {
  variantId: string;
  warehouseId: string;
  supplierId: string;
  quantity: number;
}
