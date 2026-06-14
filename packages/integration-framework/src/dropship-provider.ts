// DEPRECATED — not the built dropship path. The live dropship surface uses the
// bespoke `@sparx/dropship` `SupplierAdapter` (packages/dropship) + the
// `dropship_suppliers` table + the `/v1/dropship/*` routes, NOT this provider/
// marketplace abstraction. This interface predates that decision and is unused;
// it is kept only so `ProviderBundle.dropship` still type-checks. See docs/14
// §2 (Architecture) for the reconciliation. Do not build new dropship work
// against this interface — extend `@sparx/dropship` instead.
//
// DropshipProvider — supplier integrations. Implements catalog browse + import,
// order submission, inventory feed, and tracking sync, in the same plugin shape
// as payment/tax/shipping.

import type { Currency, MoneyCents } from '@sparx/commerce-schemas';

import type { ProviderRunContext } from './context';
import type { ProviderMetadataDescriptor } from './metadata';

export interface SupplierProduct {
  supplierProductRef: string;
  title: string;
  description: string;
  imageUrls: string[];
  variants: {
    supplierVariantRef: string;
    sku: string;
    options: Record<string, string>;
    costCents: MoneyCents;
    suggestedRetailCents?: MoneyCents;
    weightGrams?: number;
    inventoryAvailable?: number;
  }[];
  vendor?: string;
  category?: string;
  tags?: string[];
}

export interface SupplierCatalogQuery {
  q?: string;
  category?: string;
  cursor?: string;
  limit?: number;
}

export interface DropshipSubmitInput {
  orderId: string;
  shipTo: {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    region?: string;
    postalCode?: string;
    country: string;
    phone?: string;
  };
  lines: {
    supplierVariantRef: string;
    quantity: number;
    unitPriceCents: MoneyCents;
  }[];
  currency: Currency;
  shippingService?: string;
}

export interface DropshipSubmitResult {
  supplierOrderRef: string;
  status: 'accepted' | 'pending_payment' | 'rejected';
  estimatedShipAt?: string;
}

export interface DropshipProvider {
  readonly metadata: ProviderMetadataDescriptor;

  searchCatalog(
    ctx: ProviderRunContext,
    query: SupplierCatalogQuery
  ): Promise<{ items: SupplierProduct[]; nextCursor?: string }>;

  importProduct(ctx: ProviderRunContext, supplierProductRef: string): Promise<SupplierProduct>;

  submitOrder(ctx: ProviderRunContext, input: DropshipSubmitInput): Promise<DropshipSubmitResult>;

  cancelOrder(
    ctx: ProviderRunContext,
    input: { supplierOrderRef: string; reason: string }
  ): Promise<void>;

  /** Bulk inventory sync. Returns updated levels per variant. The
   *  inventory-reconciler-worker calls this on the supplier's cadence
   *  (every 4h Tier 1, 12h Tier 2). */
  syncInventory(
    ctx: ProviderRunContext,
    input: { since?: string }
  ): Promise<
    {
      supplierVariantRef: string;
      onHand: number;
      asOf: string;
    }[]
  >;

  /** Poll supplier for shipping status of an in-flight order. */
  fetchOrderStatus(
    ctx: ProviderRunContext,
    input: { supplierOrderRef: string }
  ): Promise<{
    status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
    trackingNumber?: string;
    carrier?: string;
    trackingUrl?: string;
    updatedAt: string;
  }>;
}
