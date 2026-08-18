import type { FastifyPluginAsync } from 'fastify';
import dropshipSupplierRoutes from './suppliers.js';
import dropshipProductsRoutes from './products.js';
import dropshipProductLinkRoutes from './product-links.js';
import dropshipOrderRoutes from './orders.js';
import dropshipAnalyticsRoutes from './analytics.js';
import dropshipReportRoutes from './reports.js';

const dropshipRoutes: FastifyPluginAsync = async (app) => {
  await app.register(dropshipSupplierRoutes);
  await app.register(dropshipProductsRoutes);
  await app.register(dropshipProductLinkRoutes);
  await app.register(dropshipOrderRoutes);
  await app.register(dropshipAnalyticsRoutes);
  await app.register(dropshipReportRoutes);
};

export default dropshipRoutes;
