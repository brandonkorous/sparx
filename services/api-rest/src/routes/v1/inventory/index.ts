import type { FastifyPluginAsync } from 'fastify';
import inventorySourceRoutes from './sources.js';
import inventoryLocationRoutes from './locations.js';
import inventoryLinkRoutes from './links.js';

const inventoryRoutes: FastifyPluginAsync = async (app) => {
  await app.register(inventorySourceRoutes);
  await app.register(inventoryLocationRoutes);
  await app.register(inventoryLinkRoutes);
};

export default inventoryRoutes;
