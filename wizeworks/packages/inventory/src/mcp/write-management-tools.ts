// Inventory management MCP tools — the full operator write surface behind
// stock: suppliers + their catalog, warehouses/locations, purchase-order and
// transfer lifecycles (incl. line editing), cycle counts, lots + serials +
// recalls, B2B fleet holds, and reorder policy. Thin wrappers over the service
// layer (one service, many transports). The supply-loop essentials
// (create_purchase_order / receive_stock / update_inventory) + reads live in
// ./tools.ts; this file is everything else.
//
// Deliberately NOT here (agent/integration provisioning, like commerce's
// providers): data-source enrollment/heartbeat/sync/push/revoke, source links,
// unmapped-SKU mapping, and raw feed ingest.

import { z } from 'zod';

import {
  AddCountLineInput,
  AddTransferLineInput,
  BulkAdjustmentInput,
  CreateFleetHoldInput,
  CreateInventoryCountInput,
  CreateInventoryTransferInput,
  CreateLotBatchInput,
  CreateSerialUnitInput,
  CreateSupplierInput,
  CreateWarehouseInput,
  EnterCountsInput,
  InitiateRecallInput,
  PurchaseOrderLineInput,
  ReceiveTransferInput,
  SetReorderPolicyInput,
  SetSafetyBufferInput,
  SubmitPurchaseOrderInput,
  UpdatePurchaseOrderInput,
  UpdatePurchaseOrderLineInput,
  UpdateSerialStatusInput,
  UpdateSupplierInput,
  UpdateTransferLineInput,
  UpdateWarehouseInput,
  UpsertSupplierVariantInput,
} from '@wizeworks/commerce-schemas';

import { inventoryService } from '../services';
import type { AnyMcpTool, McpToolDefinition } from './registry';

const uuid = () => z.string().uuid();
type Rec = Record<string, unknown>;

// ─── Suppliers ─────────────────────────────────────────────────────────────

const createSupplier: McpToolDefinition = {
  name: 'create_supplier',
  description:
    'Create a supplier (vendor) you purchase stock from — name, contact, terms, lead time.',
  scope: 'write:inventory',
  confirmation: true,
  input: CreateSupplierInput,
  run: (ctx, input) => inventoryService.createSupplier(ctx, input),
};

const updateSupplier: McpToolDefinition = {
  name: 'update_supplier',
  description:
    'Change a supplier record — name, contact, lead time, currency, payment terms. Send only the fields that change; anything omitted is left alone rather than blanked. Does not touch prices or existing orders.',
  scope: 'write:inventory',
  confirmation: true,
  input: UpdateSupplierInput.extend({ supplierId: uuid() }),
  run: (ctx, input) => {
    const { supplierId, ...patch } = input as { supplierId: string } & Rec;
    return inventoryService.updateSupplier(ctx, supplierId, patch);
  },
};

const archiveSupplier: McpToolDefinition = {
  name: 'archive_supplier',
  description: 'Archive a supplier so it stops appearing in pickers. Its history is preserved.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({ supplierId: uuid() }),
  run: (ctx, input) =>
    inventoryService.archiveSupplier(ctx, (input as { supplierId: string }).supplierId),
};

const upsertSupplierVariant: McpToolDefinition = {
  name: 'upsert_supplier_variant',
  description:
    'Link a variant to a supplier with its supplier SKU, cost, pack size and lead time (or update the link). This is what reorder suggestions and PO line defaults draw from.',
  scope: 'write:inventory',
  confirmation: true,
  input: UpsertSupplierVariantInput.extend({ supplierId: uuid() }),
  run: (ctx, input) => {
    const { supplierId, ...body } = input as { supplierId: string } & Rec;
    return inventoryService.upsertSupplierVariant(ctx, supplierId, body);
  },
};

const removeSupplierVariant: McpToolDefinition = {
  name: 'remove_supplier_variant',
  description:
    'Stop treating this supplier as a source for this item. Removes the link and its quantity price breaks; it does NOT delete the item, the supplier, or any purchase order already raised against them. Use it when you stop buying a part from someone.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({ supplierId: uuid(), variantId: uuid() }),
  run: (ctx, input) => {
    const { supplierId, variantId } = input as { supplierId: string; variantId: string };
    return inventoryService.removeSupplierVariant(ctx, supplierId, variantId);
  },
};

// ─── Warehouses / locations ────────────────────────────────────────────────

const createWarehouse: McpToolDefinition = {
  name: 'create_warehouse',
  description: 'Create a warehouse / stock location (a place inventory is held).',
  scope: 'write:inventory',
  confirmation: true,
  input: CreateWarehouseInput,
  run: (ctx, input) => inventoryService.createWarehouse(ctx, input),
};

const updateWarehouse: McpToolDefinition = {
  name: 'update_warehouse',
  description: 'Edit a warehouse / location. Send only the fields to change.',
  scope: 'write:inventory',
  confirmation: true,
  input: UpdateWarehouseInput.extend({ warehouseId: uuid() }),
  run: (ctx, input) => {
    const { warehouseId, ...patch } = input as { warehouseId: string } & Rec;
    return inventoryService.updateWarehouse(ctx, warehouseId, patch);
  },
};

const archiveWarehouse: McpToolDefinition = {
  name: 'archive_warehouse',
  description: 'Archive a warehouse / location. Its stock history is preserved.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({ warehouseId: uuid() }),
  run: (ctx, input) =>
    inventoryService.archiveWarehouse(ctx, (input as { warehouseId: string }).warehouseId),
};

// ─── Purchase orders (lifecycle + lines) ──────────────────────────────────
// create_purchase_order + receive_stock live in ./tools.ts.

const updatePurchaseOrder: McpToolDefinition = {
  name: 'update_purchase_order',
  description:
    'Edit a draft purchase order’s header (supplier, warehouse, expected date, notes). Send only the fields to change.',
  scope: 'write:inventory',
  confirmation: true,
  input: UpdatePurchaseOrderInput.extend({ purchaseOrderId: uuid() }),
  run: (ctx, input) => {
    const { purchaseOrderId, ...patch } = input as { purchaseOrderId: string } & Rec;
    return inventoryService.updatePurchaseOrder(ctx, purchaseOrderId, patch);
  },
};

const submitPurchaseOrder: McpToolDefinition = {
  name: 'submit_purchase_order',
  description:
    'Submit a draft PO to place the order with the supplier (advances it out of draft). Receive against it later with receive_stock.',
  scope: 'write:inventory',
  confirmation: true,
  input: SubmitPurchaseOrderInput.extend({ purchaseOrderId: uuid() }),
  run: (ctx, input) => {
    const { purchaseOrderId, ...body } = input as { purchaseOrderId: string } & Rec;
    return inventoryService.submitPurchaseOrder(ctx, purchaseOrderId, body);
  },
};

const cancelPurchaseOrder: McpToolDefinition = {
  name: 'cancel_purchase_order',
  description:
    'Cancel an order that has already been sent to a supplier. The order stays on the record as cancelled, so the history of what was ordered survives, and anything already received against it is untouched. This is the one to use for a real order; use delete_purchase_order only for a draft nobody ever sent.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({ purchaseOrderId: uuid() }),
  run: (ctx, input) =>
    inventoryService.cancelPurchaseOrder(
      ctx,
      (input as { purchaseOrderId: string }).purchaseOrderId
    ),
};

const closePurchaseOrder: McpToolDefinition = {
  name: 'close_purchase_order',
  description: 'Close a purchase order (e.g. after partial receipt, accept it as complete).',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({ purchaseOrderId: uuid() }),
  run: (ctx, input) =>
    inventoryService.closePurchaseOrder(
      ctx,
      (input as { purchaseOrderId: string }).purchaseOrderId
    ),
};

const deletePurchaseOrder: McpToolDefinition = {
  name: 'delete_purchase_order',
  description:
    'Delete a purchase order that was never sent, removing it entirely. Refuses anything beyond draft, because an order a supplier has seen must leave a trace — cancel that one instead. This cannot be undone.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({ purchaseOrderId: uuid() }),
  run: (ctx, input) =>
    inventoryService.deletePurchaseOrder(
      ctx,
      (input as { purchaseOrderId: string }).purchaseOrderId
    ),
};

const addPurchaseOrderLine: McpToolDefinition = {
  name: 'add_purchase_order_line',
  description: 'Add a line item (variant + quantity + unit cost) to a draft purchase order.',
  scope: 'write:inventory',
  confirmation: true,
  input: PurchaseOrderLineInput.extend({ purchaseOrderId: uuid() }),
  run: (ctx, input) => {
    const { purchaseOrderId, ...body } = input as { purchaseOrderId: string } & Rec;
    return inventoryService.addPurchaseOrderLine(ctx, purchaseOrderId, body);
  },
};

const updatePurchaseOrderLine: McpToolDefinition = {
  name: 'update_purchase_order_line',
  description: 'Edit a purchase-order line (quantity, unit cost). Send only the fields to change.',
  scope: 'write:inventory',
  confirmation: true,
  input: UpdatePurchaseOrderLineInput.extend({ purchaseOrderId: uuid(), lineId: uuid() }),
  run: (ctx, input) => {
    const { purchaseOrderId, lineId, ...patch } = input as {
      purchaseOrderId: string;
      lineId: string;
    } & Rec;
    return inventoryService.updatePurchaseOrderLine(ctx, purchaseOrderId, lineId, patch);
  },
};

const removePurchaseOrderLine: McpToolDefinition = {
  name: 'remove_purchase_order_line',
  description:
    'Take one item off a purchase order that has not been sent yet. Draft only: once a supplier has the order, changing what was asked for has to be a revision they can see, not a silent edit.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({ purchaseOrderId: uuid(), lineId: uuid() }),
  run: (ctx, input) => {
    const { purchaseOrderId, lineId } = input as { purchaseOrderId: string; lineId: string };
    return inventoryService.removePurchaseOrderLine(ctx, purchaseOrderId, lineId);
  },
};

// ─── Transfers (between warehouses) ───────────────────────────────────────

const createInventoryTransfer: McpToolDefinition = {
  name: 'create_inventory_transfer',
  description:
    'Create a stock transfer between two warehouses. Add lines, then ship and receive it.',
  scope: 'write:inventory',
  confirmation: true,
  input: CreateInventoryTransferInput,
  run: (ctx, input) => inventoryService.createInventoryTransfer(ctx, input),
};

const addTransferLine: McpToolDefinition = {
  name: 'add_transfer_line',
  description: 'Add a line (variant + quantity) to a draft inventory transfer.',
  scope: 'write:inventory',
  confirmation: true,
  input: AddTransferLineInput.extend({ transferId: uuid() }),
  run: (ctx, input) => {
    const { transferId, ...body } = input as { transferId: string } & Rec;
    return inventoryService.addTransferLine(ctx, transferId, body);
  },
};

const updateTransferLine: McpToolDefinition = {
  name: 'update_transfer_line',
  description: 'Edit a transfer line (quantity). Send only the fields to change.',
  scope: 'write:inventory',
  confirmation: true,
  input: UpdateTransferLineInput.extend({ transferId: uuid(), lineId: uuid() }),
  run: (ctx, input) => {
    const { transferId, lineId, ...patch } = input as {
      transferId: string;
      lineId: string;
    } & Rec;
    return inventoryService.updateTransferLine(ctx, transferId, lineId, patch);
  },
};

const removeTransferLine: McpToolDefinition = {
  name: 'remove_transfer_line',
  description:
    'Take one item off a transfer between your own locations that has not shipped yet. Draft only — once stock is in transit the line is a record of what physically left, and removing it would lose track of goods on a van.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({ transferId: uuid(), lineId: uuid() }),
  run: (ctx, input) => {
    const { transferId, lineId } = input as { transferId: string; lineId: string };
    return inventoryService.removeTransferLine(ctx, transferId, lineId);
  },
};

const shipInventoryTransfer: McpToolDefinition = {
  name: 'ship_inventory_transfer',
  description: 'Ship a transfer: deduct stock from the source warehouse into in-transit.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({ transferId: uuid() }),
  run: (ctx, input) =>
    inventoryService.shipInventoryTransfer(ctx, (input as { transferId: string }).transferId),
};

const receiveInventoryTransfer: McpToolDefinition = {
  name: 'receive_inventory_transfer',
  description:
    'Receive a shipped transfer at the destination warehouse, raising its on-hand. Provide the received lines.',
  scope: 'write:inventory',
  confirmation: true,
  input: ReceiveTransferInput.extend({ transferId: uuid() }),
  run: (ctx, input) => {
    const { transferId, ...body } = input as { transferId: string } & Rec;
    return inventoryService.receiveInventoryTransfer(ctx, transferId, body);
  },
};

const cancelInventoryTransfer: McpToolDefinition = {
  name: 'cancel_inventory_transfer',
  description:
    'Call off a movement of stock between your own locations. Anything already sent is returned to the sending location rather than vanishing, so the totals still add up. The transfer stays on the record as cancelled.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({ transferId: uuid() }),
  run: (ctx, input) =>
    inventoryService.cancelInventoryTransfer(ctx, (input as { transferId: string }).transferId),
};

const deleteInventoryTransfer: McpToolDefinition = {
  name: 'delete_inventory_transfer',
  description:
    'Delete a transfer that was never shipped, removing it entirely. Refuses anything that has left a location — stock that physically moved must leave a trace, so cancel that one instead. This cannot be undone.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({ transferId: uuid() }),
  run: (ctx, input) =>
    inventoryService.deleteInventoryTransfer(ctx, (input as { transferId: string }).transferId),
};

// ─── Cycle counts ─────────────────────────────────────────────────────────

const createInventoryCount: McpToolDefinition = {
  name: 'create_inventory_count',
  description:
    'Start a cycle count for a warehouse (optionally scoped). Add counted quantities, then submit → approve → post to reconcile on-hand.',
  scope: 'write:inventory',
  confirmation: true,
  input: CreateInventoryCountInput,
  run: (ctx, input) => inventoryService.createInventoryCount(ctx, input),
};

const addCountLine: McpToolDefinition = {
  name: 'add_count_line',
  description:
    'Put another item on a stock count that is still open, so somebody can record what is actually on the shelf for it. Adding a line does not change any stock figure — a count only affects stock when it is posted.',
  scope: 'write:inventory',
  confirmation: true,
  input: AddCountLineInput.extend({ countId: uuid() }),
  run: (ctx, input) => {
    const { countId, ...body } = input as { countId: string } & Rec;
    return inventoryService.addCountLine(ctx, countId, body);
  },
};

const enterCounts: McpToolDefinition = {
  name: 'enter_counts',
  description: 'Enter counted quantities for lines on an inventory count in one call.',
  scope: 'write:inventory',
  confirmation: true,
  input: EnterCountsInput.extend({ countId: uuid() }),
  run: (ctx, input) => {
    const { countId, ...body } = input as { countId: string } & Rec;
    return inventoryService.enterCounts(ctx, countId, body);
  },
};

const removeCountLine: McpToolDefinition = {
  name: 'remove_count_line',
  description:
    'Take an item off a count that is still open — the case where a line was added by mistake and nobody is going to walk to that shelf. Removing it is not the same as counting zero: a removed line makes no claim about that item at all.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({ countId: uuid(), lineId: uuid() }),
  run: (ctx, input) => {
    const { countId, lineId } = input as { countId: string; lineId: string };
    return inventoryService.removeCountLine(ctx, countId, lineId);
  },
};

const submitInventoryCount: McpToolDefinition = {
  name: 'submit_inventory_count',
  description:
    'Hand a finished count on for review. Stock does not move yet — this closes the count to further edits and puts it in front of whoever approves it. The figures still only reach the ledger when the count is posted.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({ countId: uuid() }),
  run: (ctx, input) =>
    inventoryService.submitInventoryCount(ctx, (input as { countId: string }).countId),
};

const approveInventoryCount: McpToolDefinition = {
  name: 'approve_inventory_count',
  description:
    'Sign off a submitted count as correct. Still does not move any stock: approval and posting are separate on purpose, so the person who checks the numbers and the moment the ledger changes are two different events.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({ countId: uuid() }),
  run: (ctx, input) =>
    inventoryService.approveInventoryCount(ctx, (input as { countId: string }).countId),
};

const postInventoryCount: McpToolDefinition = {
  name: 'post_inventory_count',
  description:
    'Post an approved count — write the counted quantities to on-hand as reconciling ledger movements.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({ countId: uuid() }),
  run: (ctx, input) =>
    inventoryService.postInventoryCount(ctx, (input as { countId: string }).countId),
};

const cancelInventoryCount: McpToolDefinition = {
  name: 'cancel_inventory_count',
  description:
    'Abandon a count without applying it. Every figure anybody recorded is discarded and no stock changes — use this when a count was started against the wrong location or interrupted halfway. A posted count cannot be cancelled; correct it with another count.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({ countId: uuid() }),
  run: (ctx, input) =>
    inventoryService.cancelInventoryCount(ctx, (input as { countId: string }).countId),
};

// ─── Bulk adjust ──────────────────────────────────────────────────────────

const bulkAdjustInventory: McpToolDefinition = {
  name: 'bulk_adjust_inventory',
  description:
    'Adjust on-hand for many variant/warehouse pairs in one call (signed deltas with a shared reason). For a single variant use update_inventory.',
  scope: 'write:inventory',
  confirmation: true,
  input: BulkAdjustmentInput,
  run: (ctx, input) => inventoryService.bulkAdjust(ctx, input),
};

// ─── Lots + serials + recalls ─────────────────────────────────────────────

const createLotBatch: McpToolDefinition = {
  name: 'create_lot_batch',
  description: 'Create a lot / batch record (lot number, expiry) for lot-tracked stock.',
  scope: 'write:inventory',
  confirmation: true,
  input: CreateLotBatchInput,
  run: (ctx, input) => inventoryService.createLotBatch(ctx, input),
};

const clearRecall: McpToolDefinition = {
  name: 'clear_lot_recall',
  description: 'Clear an active recall flag on a lot (return it to sellable).',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({ lotId: uuid() }),
  run: (ctx, input) => inventoryService.clearRecall(ctx, (input as { lotId: string }).lotId),
};

const createSerialUnit: McpToolDefinition = {
  name: 'create_serial_unit',
  description: 'Register a serialized unit (a specific serial number) for serial-tracked stock.',
  scope: 'write:inventory',
  confirmation: true,
  input: CreateSerialUnitInput,
  run: (ctx, input) => inventoryService.createSerialUnit(ctx, input),
};

const updateSerialStatus: McpToolDefinition = {
  name: 'update_serial_status',
  description: 'Change a serialized unit’s status (e.g. available, reserved, sold, defective).',
  scope: 'write:inventory',
  confirmation: true,
  input: UpdateSerialStatusInput.extend({ serialId: uuid() }),
  run: (ctx, input) => {
    const { serialId, ...body } = input as { serialId: string } & Rec;
    return inventoryService.updateSerialStatus(ctx, serialId, body);
  },
};

const initiateRecall: McpToolDefinition = {
  name: 'initiate_recall',
  description:
    'Initiate a recall on affected lots — flags the stock as non-sellable pending resolution.',
  scope: 'write:inventory',
  confirmation: true,
  input: InitiateRecallInput,
  run: (ctx, input) => inventoryService.initiateRecall(ctx, input),
};

// ─── B2B fleet holds ──────────────────────────────────────────────────────

const createFleetHold: McpToolDefinition = {
  name: 'create_fleet_hold',
  description:
    'Place a fleet hold — reserve stock for a B2B account’s fleet ahead of a formal order.',
  scope: 'write:inventory',
  confirmation: true,
  input: CreateFleetHoldInput,
  run: (ctx, input) => inventoryService.createFleetHold(ctx, input),
};

const releaseFleetHold: McpToolDefinition = {
  name: 'release_fleet_hold',
  description: 'Release a fleet hold, returning the reserved stock to available.',
  scope: 'write:inventory',
  confirmation: true,
  input: z.object({ holdId: uuid() }),
  run: (ctx, input) => inventoryService.releaseFleetHold(ctx, (input as { holdId: string }).holdId),
};

// ─── Reorder policy ───────────────────────────────────────────────────────

const setReorderPolicy: McpToolDefinition = {
  name: 'set_reorder_policy',
  description:
    'Set a variant’s reorder policy at a warehouse — reorder point and target/max quantity that drive reorder suggestions.',
  scope: 'write:inventory',
  confirmation: true,
  input: SetReorderPolicyInput,
  run: (ctx, input) => inventoryService.setReorderPolicy(ctx, input),
};

const setSafetyBuffer: McpToolDefinition = {
  name: 'set_safety_buffer',
  description:
    'Set a variant’s safety-stock buffer at a warehouse (units held back from sale as a cushion).',
  scope: 'write:inventory',
  confirmation: true,
  input: SetSafetyBufferInput,
  run: (ctx, input) => inventoryService.setSafetyBuffer(ctx, input),
};

export const managementWriteTools: AnyMcpTool[] = [
  createSupplier,
  updateSupplier,
  archiveSupplier,
  upsertSupplierVariant,
  removeSupplierVariant,
  createWarehouse,
  updateWarehouse,
  archiveWarehouse,
  updatePurchaseOrder,
  submitPurchaseOrder,
  cancelPurchaseOrder,
  closePurchaseOrder,
  deletePurchaseOrder,
  addPurchaseOrderLine,
  updatePurchaseOrderLine,
  removePurchaseOrderLine,
  createInventoryTransfer,
  addTransferLine,
  updateTransferLine,
  removeTransferLine,
  shipInventoryTransfer,
  receiveInventoryTransfer,
  cancelInventoryTransfer,
  deleteInventoryTransfer,
  createInventoryCount,
  addCountLine,
  enterCounts,
  removeCountLine,
  submitInventoryCount,
  approveInventoryCount,
  postInventoryCount,
  cancelInventoryCount,
  bulkAdjustInventory,
  createLotBatch,
  clearRecall,
  createSerialUnit,
  updateSerialStatus,
  initiateRecall,
  createFleetHold,
  releaseFleetHold,
  setReorderPolicy,
  setSafetyBuffer,
];
