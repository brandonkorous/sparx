import type { FastifyPluginAsync } from 'fastify';
import dropshipSupplierRoutes from './suppliers.js';

const dropshipRoutes: FastifyPluginAsync = async (app) => {
  await app.register(dropshipSupplierRoutes);
};

export default dropshipRoutes;
