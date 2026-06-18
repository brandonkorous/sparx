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
};

export default inventoryRoutes;
