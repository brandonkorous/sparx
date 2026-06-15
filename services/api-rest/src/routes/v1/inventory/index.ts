import type { FastifyPluginAsync } from 'fastify';
import inventorySourceRoutes from './sources.js';
import inventoryLocationRoutes from './locations.js';
import inventoryLinkRoutes from './links.js';
import inventoryReportRoutes from './reports.js';

const inventoryRoutes: FastifyPluginAsync = async (app) => {
  await app.register(inventorySourceRoutes);
  await app.register(inventoryLocationRoutes);
  await app.register(inventoryLinkRoutes);
  await app.register(inventoryReportRoutes);
};

export default inventoryRoutes;
