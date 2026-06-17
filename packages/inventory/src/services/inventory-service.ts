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
  listLowStock,
} from './levels';
export type { InventoryLevelRow, LowStockRow } from './levels';

// ─── Stock mutations (manual adjust + transfer) ───────────────────────
export { adjust, transfer } from './movements';

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

// ─── Lot batches + serial units + recalls ─────────────────────────────
export {
  createLotBatch,
  listLotsExpiringBefore,
  listLotsForVariant,
  createSerialUnit,
  initiateRecall,
} from './lots';
export type { LotBatchRow } from './lots';

// ─── Movement ledger primitive ────────────────────────────────────────
// Exposed for callers composing a movement inside their OWN tenant transaction
// (e.g. an order service decrementing stock atomically with the order insert).
// Most callers use reserve/commit/adjust above rather than this directly.
export { applyMovement, emitStockEvents } from './ledger';
export type { MovementInput, MovementResult, ActorType } from './ledger';
