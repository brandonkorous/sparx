// Shared types + formatters for the inventory reports surface (docs/100 P6b).
// Mirror the @sparx/inventory analytics service response shapes.

export interface TurnoverReport {
  range: { from: string; to: string };
  periodDays: number;
  cogsCents: number;
  unitsSold: number;
  avgInventoryValueCents: number;
  turnover: number;
  turnoverAnnualized: number;
  daysInventoryOutstanding: number | null;
}

export interface AgingBucket {
  bucket: '0-30' | '31-60' | '61-90' | '90+' | 'never';
  levels: number;
  units: number;
  costCents: number;
}
export interface DeadStockItem {
  variantId: string;
  warehouseId: string;
  sku: string | null;
  title: string | null;
  warehouseCode: string;
  onHand: number;
  costCents: number;
  lastSaleAt: string | null;
  daysSinceLastSale: number | null;
}
export interface AgingReport {
  deadStockDays: number;
  buckets: AgingBucket[];
  deadStock: DeadStockItem[];
}

export interface ReorderAnalysisRow {
  variantId: string;
  warehouseId: string;
  sku: string | null;
  title: string | null;
  warehouseCode: string;
  onHand: number;
  available: number;
  reorderPoint: number;
  reorderQuantity: number | null;
  velocityPerDay: number;
  daysOfCover: number | null;
  projectedStockoutAt: string | null;
  suggestedQuantity: number;
  supplierName: string | null;
  unitCostCents: number | null;
}
export interface ReorderAnalysisReport {
  velocityDays: number;
  rows: ReorderAnalysisRow[];
}

export type ReportKind = 'turnover' | 'aging' | 'reorder-analysis';

export const BUCKET_LABEL: Record<AgingBucket['bucket'], string> = {
  '0-30': 'Sold ≤ 30 days',
  '31-60': '31–60 days',
  '61-90': '61–90 days',
  '90+': '90+ days',
  never: 'Never sold',
};

export function formatMoney(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}
