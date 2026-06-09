import type { FastifyPluginAsync } from 'fastify';
import dropshipSupplierRoutes from './suppliers.js';
import dropshipOrderRoutes from './orders.js';

const dropshipRoutes: FastifyPluginAsync = async (app) => {
  await app.register(dropshipSupplierRoutes);
  await app.register(dropshipOrderRoutes);
};

export default dropshipRoutes;
