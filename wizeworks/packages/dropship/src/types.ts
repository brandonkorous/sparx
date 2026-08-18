// @wizeworks/dropship — core types for the dropship connector framework.
// (docs/14, docs/64 Dropship Ph1)
//
// The SupplierAdapter interface defines the contract every adapter must
// implement. Concrete adapters live in `src/adapters/` — CSV first, then
// DSers and Spocket (Ph4). The adapter never touches the database directly;
// the dropship-worker owns DB writes after calling adapter methods.

// ── Credentials ──────────────────────────────────────────────────────────────

/** Opaque credentials bag stored (encrypted) in `dropship_suppliers.credentials`. */
export type Credentials = Record<string, string>;

// ── Normalized product ────────────────────────────────────────────────────────

export interface NormalizedProductVariant {
  supplierSku: string;
  title: string;
  options: Record<string, string>; // { color: "Red", size: "M" }
  costPriceCents: number;
  msrpCents: number | null;
  inventoryQuantity: number | null;
  /**
   * Whether the supplier can currently FULFILL this exact variant. POD providers
   * flip individual color/size combos out when a blank is temporarily out of
   * stock — distinct from `inventoryQuantity` (POD never tracks a count) and from
   * the variant simply not existing. `false` = the merchant offers it but it
   * can't be produced right now; absent/`true` = orderable. The import maps
   * `false` → a `deny` inventory policy so the storefront greys the combo out.
   */
  available?: boolean;
  weight: number | null; // grams
  imageUrls: string[];
}

export interface NormalizedProduct {
  supplierProductId: string;
  title: string;
  description: string | null;
  category: string | null;
  tags: string[];
  imageUrls: string[];
  variants: NormalizedProductVariant[];
  /** Supplier-specific raw payload retained for debugging / re-parsing. */
  raw: Record<string, unknown>;
}

// A product the supplier has LOCKED pending our publish callback. Custom-
// integration channels (Printify, Printful) lock a product in a "publishing"
// state when the merchant hits Publish and wait for the integration to confirm
// it landed; until then the product is stuck. `product` is the full normalized
// payload so the caller can import it before confirming.
export interface PendingPublish {
  supplierProductId: string;
  product: NormalizedProduct;
}

// Where a published product now lives in our system — sent back to the supplier
// so its UI can deep-link to the live listing and unlock the product.
export interface PublishExternalRef {
  id: string;
  handle: string;
}

// ── Order submission ──────────────────────────────────────────────────────────

export interface OrderLineItem {
  supplierSku: string;
  quantity: number;
  unitPriceCents: number;
}

export interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode: string;
  countryCode: string;
  phone?: string;
}

export interface Order {
  sparxOrderId: string;
  sparxOrderNumber: string;
  lineItems: OrderLineItem[];
  shippingAddress: ShippingAddress;
  shippingMethod?: string;
  customerNote?: string;
}

export interface SupplierOrderResult {
  supplierOrderId: string;
  status: 'pending' | 'submitted' | 'failed';
  errorMessage?: string;
  estimatedShipDate?: string;
}

// ── Tracking ─────────────────────────────────────────────────────────────────

export interface TrackingEvent {
  timestamp: string; // ISO
  description: string;
  location?: string;
}

export interface TrackingInfo {
  supplierOrderId: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  carrier: string | null;
  status: 'pending' | 'shipped' | 'in_transit' | 'delivered' | 'exception';
  estimatedDeliveryDate?: string;
  events: TrackingEvent[];
}

// ── Inventory check ───────────────────────────────────────────────────────────

/** Keys are supplier SKUs; values are available quantity (null = unknown). */
export type InventoryMap = Record<string, number | null>;

// ── Pricing rules engine ──────────────────────────────────────────────────────

export type PricingRuleType =
  | 'percentage_markup' // retail = cost * (1 + margin/100)
  | 'multiplier' // retail = cost * multiplier
  | 'flat_markup' // retail = cost + fixed_cents
  | 'fixed_margin'; // retail = cost / (1 - margin/100)

export interface PricingRule {
  type: PricingRuleType;
  value: number;
  roundTo?: 'cent' | 'dollar' | 'five_dollar'; // default: cent
  /** When set, caps retail price at this MSRP (never exceeds supplier's compare-at). */
  maxMsrp?: 'use_supplier_msrp';
}

/**
 * Apply a pricing rule to a cost in cents, returning the computed retail price
 * in cents.
 */
export function applyPricingRule(costCents: number, rule: PricingRule): number {
  let retail: number;

  switch (rule.type) {
    case 'percentage_markup':
      retail = costCents * (1 + rule.value / 100);
      break;
    case 'multiplier':
      retail = costCents * rule.value;
      break;
    case 'flat_markup':
      retail = costCents + rule.value;
      break;
    case 'fixed_margin':
      if (rule.value >= 100) throw new RangeError('Fixed margin must be < 100%');
      retail = costCents / (1 - rule.value / 100);
      break;
  }

  switch (rule.roundTo ?? 'cent') {
    case 'cent':
      return Math.round(retail);
    case 'dollar':
      return Math.round(retail / 100) * 100;
    case 'five_dollar':
      return Math.round(retail / 500) * 500;
  }
}

// ── SupplierAdapter interface ─────────────────────────────────────────────────

export interface SupplierAdapter {
  /** Validate credentials and return true if the connection is healthy. */
  authenticate(credentials: Credentials): Promise<boolean>;

  /**
   * Yield normalized products from the supplier's catalog.
   * `since` limits the sync to products modified after that date (delta sync).
   * Omitting `since` performs a full catalog sync.
   */
  syncCatalog(since?: Date): AsyncGenerator<NormalizedProduct>;

  /** Submit a sparx order to the supplier and return the result. */
  submitOrder(order: Order): Promise<SupplierOrderResult>;

  /** Poll or parse tracking status for a supplier order. */
  getTrackingUpdate(supplierOrderId: string): Promise<TrackingInfo>;

  /** Check real-time inventory levels for a list of supplier SKUs. */
  checkInventory(skus: string[]): Promise<InventoryMap>;

  // ── Publish handshake (custom-integration channels only) ──────────────────
  // Printify/Printful lock a product in "publishing" when the merchant clicks
  // Publish and wait for the integration to call back. Adapters without this
  // handshake (csv/dsers/spocket) omit these — callers feature-detect.

  /** Products the supplier is waiting on us to confirm a publish for. */
  listPendingPublish?(): Promise<PendingPublish[]>;

  /** Confirm a publish succeeded (unlocks the product on the supplier side),
   *  reporting where it now lives in our system. */
  confirmPublish?(supplierProductId: string, external: PublishExternalRef): Promise<void>;

  /** Report a publish FAILED (also unlocks the product), with a reason. */
  failPublish?(supplierProductId: string, reason: string): Promise<void>;
}

// ── Supplier type discriminant ────────────────────────────────────────────────

// Only suppliers with a real, self-serve integration. Suppliers without a
// usable public API (Tapstitch, PODPartner, Zendrop, AutoDS, Faire) are
// deliberately excluded — see the vendor-API verdict matrix in docs/14 §3.
export type SupplierType = 'csv' | 'dsers' | 'spocket' | 'printify' | 'printful';

// ── dropship_supplier row view (after DB fetch) ───────────────────────────────

export interface DropshipSupplierView {
  id: string;
  tenantId: string;
  name: string;
  type: SupplierType;
  status: 'connecting' | 'active' | 'error' | 'disconnected';
  lastSyncAt: string | null;
  pricingRule: PricingRule | null;
  createdAt: string;
}

// ── dropship_product row view ─────────────────────────────────────────────────

export interface DropshipProductView {
  id: string;
  tenantId: string;
  supplierId: string;
  supplierProductId: string;
  title: string;
  description: string | null;
  images: string[];
  variants: NormalizedProductVariant[];
  costPriceCents: number;
  msrpCents: number | null;
  importedAt: string;
}
