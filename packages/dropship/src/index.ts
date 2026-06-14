export type {
  Credentials,
  NormalizedProduct,
  NormalizedProductVariant,
  OrderLineItem,
  ShippingAddress,
  Order,
  SupplierOrderResult,
  TrackingInfo,
  TrackingEvent,
  InventoryMap,
  PricingRule,
  PricingRuleType,
  SupplierAdapter,
  SupplierType,
  DropshipSupplierView,
  DropshipProductView,
} from './types.js';

export { applyPricingRule } from './types.js';
export {
  createAdapter,
  CsvAdapter,
  DsersAdapter,
  SpocketAdapter,
  PrintifyAdapter,
  PrintfulAdapter,
} from './adapters/index.js';
export type {
  CsvCredentials,
  CsvColumnMapping,
  DsersCredentials,
  SpocketCredentials,
  PrintifyCredentials,
  PrintfulCredentials,
} from './adapters/index.js';

// Vendor catalog — also available via the server-safe `@sparx/dropship/vendors`
// subpath for client components that must not bundle adapter code.
export {
  VENDOR_CATALOG,
  SUPPORTED_VENDOR_SLUGS,
  getVendor,
  type DropshipVendor,
  type VendorCredentialField,
  type VendorCapabilities,
} from './vendors.js';
