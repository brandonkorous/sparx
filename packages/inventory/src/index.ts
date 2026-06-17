// @sparx/inventory — the supply-domain service layer (warehouses, stock levels +
// movement ledger, reservations, lots/serials, low-stock). The single source of
// truth for stock; Commerce/B2B/Dropship are consumers. Extracted from
// @sparx/commerce per docs/100.

export { inventoryService } from './services';

export {
  InventoryNotFoundError,
  InventoryValidationError,
  InventoryConflictError,
  InventoryOutOfStockError,
} from './errors';
export type {
  ServiceContext,
  NotFoundError,
  ValidationError,
  ConflictError,
  OutOfStockError,
} from './errors';

export { publishInventoryEvent, indexInventoryEntity } from './events';
export type { InventoryTopic, InventoryEventInput } from './events';

export { computeAvailability } from './services/availability';
export type { AvailabilityLevel, VariantAvailability } from './services/availability';

export type {
  WarehouseRow,
  InventoryLevelRow,
  ReservationResult,
  LotBatchRow,
  LowStockRow,
  SellLine,
  CommittedSale,
  SupplierRow,
  SupplierVariantRow,
  PurchaseOrderRow,
  PurchaseOrderLineRow,
  PurchaseOrderDetail,
  PurchaseOrderDocumentBrand,
  GoodsReceiptRow,
  GoodsReceiptLineRow,
  GoodsReceiptDetail,
} from './services/inventory-service';
