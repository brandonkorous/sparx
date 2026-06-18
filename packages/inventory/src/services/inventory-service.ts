// Service-layer barrel. The inventory service was split by concern
// (warehouses · levels · movement ledger · reservations · lots/serials); this
// file re-exports the public API under one surface so `inventoryService.*` keeps
// the exact shape it had pre-split and the package index can re-export the row
// types from here. The single onHand writer is `applyMovement` in ./ledger —
// every mutation path below routes through it.

// ─── Warehouses ───────────────────────────────────────────────────────
export {
  listWarehouses,
  getWarehouse,
  createWarehouse,
  updateWarehouse,
  archiveWarehouse,
} from './warehouses';
export type { WarehouseRow } from './warehouses';

// ─── Inventory levels + reorder policy + low-stock ────────────────────
export {
  getLevel,
  levelsForVariant,
  levelsForWarehouse,
  setReorderPolicy,
  setSafetyBuffer,
  listLowStock,
} from './levels';
export type { InventoryLevelRow, LowStockRow } from './levels';

// ─── Stock mutations (manual adjust + transfer) ───────────────────────
export { adjust, transfer } from './movements';

// ─── Movement / audit-log read path (P4 corrections) ──────────────────
// A filterable, paginated view over the append-only `inventory_movements`
// ledger — the compliance surface answering who moved stock, when, why, how much.
export { listMovements } from './movement-log';
export type { MovementRow, ListMovementsFilter } from './movement-log';

// ─── Reservations (cart soft / order hard) ────────────────────────────
// The tx-aware cores (`reserveOnTx` / `releaseOnTx`) let the commerce cart seam
// hold/release stock atomically with the cart-line write; `pickWarehouseFor` is
// the stock-aware single-source allocator.
export {
  reserve,
  reserveOnTx,
  release,
  releaseOnTx,
  commit,
  expireDueReservations,
  pickWarehouseFor,
} from './reservations';
export type { ReservationResult } from './reservations';

// ─── Sell path (checkout commit · cancel restock · default warehouse) ──
export {
  commitSaleOnTx,
  emitSaleEvents,
  reverseOrderSale,
  resolveDefaultWarehouseId,
} from './sell-path';
export type { SellLine, CommittedSale } from './sell-path';

// ─── External-feed reconcile (sync sources) ───────────────────────────
export { reconcileStockLevel } from './sync';
export type { ReconcileStockLevelInput } from './sync';

// ─── Feed ingest funnel + sync-health (P5 Tier C) ─────────────────────
// `ingestFeed` is the one path both the CSV worker and the `/sources/:id/push`
// endpoint call: match feed rows to links, reconcile matches through the ledger,
// queue unmatched SKUs for review, and record the run. The read side
// (runs / health / unmapped queue + map/ignore) backs the connection detail page.
export { ingestFeed } from './feed-ingest';
export type { FeedRow, IngestFeedInput, IngestFeedResult } from './feed-ingest';
export {
  listSyncRuns,
  getSyncHealth,
  listUnmappedSkus,
  createSourceLink,
  mapUnmappedSku,
  ignoreUnmappedSku,
} from './sync-runs';
export type {
  SyncRunRow,
  UnmappedSkuRow,
  SyncHealth,
  ListSyncRunsFilter,
  ListUnmappedFilter,
} from './sync-runs';

// ─── Lot batches + serial units + recalls ─────────────────────────────
export {
  createLotBatch,
  listLotsExpiringBefore,
  listLotsForVariant,
  createSerialUnit,
  initiateRecall,
} from './lots';
export type { LotBatchRow } from './lots';

// ─── Lot/serial management surface (P4d) ──────────────────────────────
// The dashboard management reads + status mutations on top of the create
// primitives above: a filterable lot list, a lot detail with its serial roster,
// per-serial status changes, and clearing a recall.
export {
  listLots,
  getLotBatch,
  listSerials,
  updateSerialStatus,
  clearRecall,
} from './lot-management';
export type {
  LotRow,
  LotDetail,
  SerialRow,
  ListLotsFilter,
  ListSerialsFilter,
} from './lot-management';

// ─── Suppliers + per-variant purchasing detail (P3a supply path) ──────
export {
  listSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  archiveSupplier,
} from './suppliers';
export type { SupplierRow } from './suppliers';
export {
  listSupplierVariants,
  suppliersForVariant,
  upsertSupplierVariant,
  removeSupplierVariant,
  lookupVariantBySku,
} from './supplier-variants';
export type { SupplierVariantRow, VariantLookupRow } from './supplier-variants';

// ─── Purchase orders (P3b supply path) ────────────────────────────────
export {
  listPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
} from './purchase-orders';
export type { ListPurchaseOrderFilter } from './purchase-orders';
export {
  addPurchaseOrderLine,
  updatePurchaseOrderLine,
  removePurchaseOrderLine,
} from './purchase-order-lines';
export {
  submitPurchaseOrder,
  cancelPurchaseOrder,
  closePurchaseOrder,
} from './purchase-order-lifecycle';
export { buildPurchaseOrderDocumentHtml, renderPurchaseOrderHtml } from './purchase-order-document';
export type {
  PurchaseOrderDocumentData,
  PurchaseOrderDocumentBrand,
} from './purchase-order-document';
export type {
  PurchaseOrderRow,
  PurchaseOrderLineRow,
  PurchaseOrderDetail,
} from './purchase-order-shared';

// ─── Goods receipts (P3c supply path) ─────────────────────────────────
export { listGoodsReceipts, getGoodsReceipt, createGoodsReceipt } from './goods-receipts';
export type { GoodsReceiptRow, GoodsReceiptLineRow, GoodsReceiptDetail } from './goods-receipts';

// ─── Reorder engine (P3d supply path) ─────────────────────────────────
// Low stock → reorder suggestions → draft PO to the preferred supplier. Manual
// (buyer-selected) + auto (the inventory.low automation action calls
// `autoDraftReorder` on the engine's transaction).
export {
  listReorderSuggestions,
  draftReorderPurchaseOrders,
  autoDraftReorder,
  suggestedReorderQty,
} from './reorder';
export type {
  ReorderFilter,
  ReorderSuggestions,
  ReorderGroup,
  ReorderSuggestionLine,
  UnsuppliedSuggestion,
  DraftReorderResult,
  DraftedPurchaseOrder,
  AutoDraftResult,
  AutoDraftOutcome,
} from './reorder';

// ─── Inventory counts (P4 corrections) ────────────────────────────────
// A counting session reconciles recorded stock against a physical count; on post
// each line writes a `recount` movement (absolute setOnHand). Variance value over
// the per-count threshold gates the post behind an admin approval.
export {
  listInventoryCounts,
  getInventoryCount,
  createInventoryCount,
  addCountLine,
  removeCountLine,
  enterCounts,
} from './inventory-counts';
export {
  submitInventoryCount,
  approveInventoryCount,
  postInventoryCount,
  cancelInventoryCount,
} from './inventory-count-lifecycle';
export type {
  InventoryCountRow,
  InventoryCountLineRow,
  InventoryCountDetail,
} from './inventory-count-shared';

// ─── Inventory transfers (P4 corrections) ─────────────────────────────
// Move stock between warehouses through a system in-transit holding location so
// total stock is conserved while in motion. Draft (compose lines) → ship
// (source → in-transit) → receive (in-transit → destination); cancel returns an
// in-transit transfer's goods to source. Every leg routes through the ledger.
export {
  listInventoryTransfers,
  getInventoryTransfer,
  createInventoryTransfer,
  addTransferLine,
  updateTransferLine,
  removeTransferLine,
  deleteInventoryTransfer,
} from './inventory-transfers';
export {
  shipInventoryTransfer,
  receiveInventoryTransfer,
  cancelInventoryTransfer,
} from './inventory-transfer-lifecycle';
export type {
  InventoryTransferRow,
  InventoryTransferLineRow,
  InventoryTransferDetail,
} from './inventory-transfer-shared';

// ─── Movement ledger primitive ────────────────────────────────────────
// Exposed for callers composing a movement inside their OWN tenant transaction
// (e.g. an order service decrementing stock atomically with the order insert).
// Most callers use reserve/commit/adjust above rather than this directly.
export { applyMovement, emitStockEvents } from './ledger';
export type { MovementInput, MovementResult, ActorType } from './ledger';
