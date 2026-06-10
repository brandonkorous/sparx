// DTOs for bulk price adjustment + revert (docs/69 B-3). Mirrors the
// @sparx/commerce bulk-price-service output shapes — kept as a decoupled copy
// because the dashboard never imports the service package (it goes through
// api.sparx.works).

export type PriceAdjustment =
  | { mode: 'percent'; percent: number } // signed: +10 raises 10 %, -10 lowers 10 %
  | { mode: 'fixed'; amountCents: number } // signed: +500 adds $5.00
  | { mode: 'set'; priceCents: number };

export interface PricePreviewRow {
  productId: string;
  title: string;
  variantCount: number;
  currentMinCents: number | null;
  currentMaxCents: number | null;
  newMinCents: number | null;
  newMaxCents: number | null;
}

export interface BulkPricePreview {
  label: string;
  productCount: number;
  variantCount: number;
  changedVariantCount: number;
  products: PricePreviewRow[];
}

export interface BulkPriceApplyResult {
  operationId: string;
  label: string;
  productCount: number;
  variantCount: number;
  appliedAt: string;
  expiresAt: string;
}

export interface ReversibleOp {
  operationId: string;
  operationType: string;
  label: string;
  appliedAt: string;
  expiresAt: string;
  productCount: number;
  variantCount: number;
}
