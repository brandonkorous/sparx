// Shared client types for the receiving surface (docs/100 P3c). Plain TS, safe
// to import from server pages + client components. Shapes mirror the
// @sparx/inventory goods-receipt serializers (/v1/inventory/receipts). Money/date
// formatters are reused from the purchase-order types.

export { formatMoney, formatDate } from '../../purchase-orders/_components/types';

export interface GoodsReceiptLineRow {
  id: string;
  purchaseOrderLineId: string;
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  quantityReceived: number;
  unitCostCents: number;
  lotNumber: string | null;
  movementId: string | null;
}

export interface GoodsReceiptRow {
  id: string;
  number: string;
  purchaseOrderId: string;
  purchaseOrderNumber: string | null;
  warehouseId: string;
  warehouseName: string | null;
  warehouseCode: string | null;
  reference: string | null;
  note: string | null;
  receivedAt: string;
  createdAt: string;
  lineCount: number;
  quantityReceived: number;
}

export interface GoodsReceiptDetail extends GoodsReceiptRow {
  lines: GoodsReceiptLineRow[];
}
