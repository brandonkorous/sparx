import type { FastifyPluginAsync } from 'fastify';
import dropshipSupplierRoutes from './suppliers.js';
import dropshipOrderRoutes from './orders.js';
import dropshipAnalyticsRoutes from './analytics.js';

const dropshipRoutes: FastifyPluginAsync = async (app) => {
  await app.register(dropshipSupplierRoutes);
  await app.register(dropshipOrderRoutes);
  await app.register(dropshipAnalyticsRoutes);
};

export default dropshipRoutes;
