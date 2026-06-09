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
export { CsvAdapter, createAdapter } from './adapters/csv.js';
export type { CsvCredentials, CsvColumnMapping } from './adapters/csv.js';
