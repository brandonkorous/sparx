// Mounts every /v1/platform/* route group.

import type { FastifyPluginAsync } from 'fastify';
import catalogRoutes from './catalog.js';

const platformRoutes: FastifyPluginAsync = async (app) => {
  await app.register(catalogRoutes);
};

export default platformRoutes;
