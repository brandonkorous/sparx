import type { FastifyPluginAsync } from 'fastify';
import inventorySourceRoutes from './sources.js';
import inventoryLocationRoutes from './locations.js';
import inventoryStockRoutes from './stock.js';
import inventoryLotRoutes from './lots.js';
import inventoryLinkRoutes from './links.js';
import inventoryReportRoutes from './reports.js';
import inventorySupplierRoutes from './suppliers.js';
import inventoryPurchaseOrderRoutes from './purchase-orders.js';

const inventoryRoutes: FastifyPluginAsync = async (app) => {
  await app.register(inventorySourceRoutes);
  await app.register(inventoryLocationRoutes);
  await app.register(inventoryStockRoutes);
  await app.register(inventoryLotRoutes);
  await app.register(inventoryLinkRoutes);
  await app.register(inventoryReportRoutes);
  await app.register(inventorySupplierRoutes);
  await app.register(inventoryPurchaseOrderRoutes);
};

export default inventoryRoutes;
