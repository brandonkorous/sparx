import type { FastifyPluginAsync } from 'fastify';
import inventoryApiRoutes from './api.js';
import inventorySourceRoutes from './sources.js';
import inventoryLocationRoutes from './locations.js';
import inventoryStockRoutes from './stock.js';
import inventoryLotRoutes from './lots.js';
import inventoryLinkRoutes from './links.js';
import inventoryReportRoutes from './reports.js';
import inventoryAnalyticsReportRoutes from './analytics-reports.js';
import inventorySupplierRoutes from './suppliers.js';
import inventoryPurchaseOrderRoutes from './purchase-orders.js';
import inventoryReceiptRoutes from './receipts.js';
import inventoryReorderRoutes from './reorder.js';
import inventoryCountRoutes from './counts.js';
import inventoryTransferRoutes from './transfers.js';
import inventoryMovementRoutes from './movements.js';
import inventorySyncRoutes from './sync.js';
import inventoryAgentRoutes from './agent.js';
import inventoryIntegrityRoutes from './integrity.js';
import inventoryBinRoutes from './bins.js';
import inventoryBarcodeRoutes from './barcodes.js';
import inventoryScanningRoutes from './scanning.js';
import inventoryPickingRoutes from './picking.js';
import inventoryCostingRoutes from './costing.js';
import inventoryUomRoutes from './uom.js';
import inventoryAssemblyRoutes from './assemblies.js';
import inventoryPlanningRoutes from './planning.js';
import inventoryClassificationRoutes from './classifications.js';
import inventoryScheduleRoutes from './schedules.js';
// Supplier performance + procurement discipline (docs/146 Phase 8)
import supplierPerformanceRoutes from './supplier-performance.js';
import poApprovalRoutes from './po-approvals.js';
import advanceShipNoticeRoutes from './advance-ship-notices.js';
import supplierReturnRoutes from './supplier-returns.js';
import supplierBillRoutes from './supplier-bills.js';

const inventoryRoutes: FastifyPluginAsync = async (app) => {
  // The documented public API (docs/06 §7) — registered first so its canonical
  // shapes are the contract surface.
  await app.register(inventoryApiRoutes);
  await app.register(inventorySourceRoutes);
  await app.register(inventoryLocationRoutes);
  await app.register(inventoryStockRoutes);
  await app.register(inventoryLotRoutes);
  await app.register(inventoryLinkRoutes);
  await app.register(inventoryReportRoutes);
  await app.register(inventoryAnalyticsReportRoutes);
  await app.register(inventorySupplierRoutes);
  await app.register(inventoryPurchaseOrderRoutes);
  await app.register(inventoryReceiptRoutes);
  await app.register(inventoryReorderRoutes);
  await app.register(inventoryCountRoutes);
  await app.register(inventoryTransferRoutes);
  await app.register(inventoryMovementRoutes);
  await app.register(inventorySyncRoutes);
  await app.register(inventoryAgentRoutes);
  await app.register(inventoryIntegrityRoutes);
  await app.register(inventoryBinRoutes);
  await app.register(inventoryBarcodeRoutes);
  await app.register(inventoryScanningRoutes);
  await app.register(inventoryPickingRoutes);
  await app.register(inventoryCostingRoutes);
  await app.register(inventoryUomRoutes);
  await app.register(inventoryAssemblyRoutes);
  await app.register(inventoryPlanningRoutes);
  await app.register(inventoryClassificationRoutes);
  await app.register(inventoryScheduleRoutes);

  // Phase 8. Registered AFTER the purchase-order routes: Fastify matches static
  // path segments ahead of parameterised ones, so `/purchase-orders/late` and
  // `/purchase-orders/approvals` resolve correctly either way — but keeping the
  // order explicit means a future `/purchase-orders/:id` change cannot silently
  // swallow them.
  await app.register(supplierPerformanceRoutes);
  await app.register(poApprovalRoutes);
  await app.register(advanceShipNoticeRoutes);
  await app.register(supplierReturnRoutes);
  await app.register(supplierBillRoutes);
};

export default inventoryRoutes;
