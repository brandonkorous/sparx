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
export { createAdapter, CsvAdapter, DsersAdapter, SpocketAdapter } from './adapters/index.js';
export type {
  CsvCredentials,
  CsvColumnMapping,
  DsersCredentials,
  SpocketCredentials,
} from './adapters/index.js';
