// Mounts every /v1/platform/* route group.

import type { FastifyPluginAsync } from 'fastify';
import catalogRoutes from './catalog.js';
import savedViewsRoutes from './saved-views.js';

const platformRoutes: FastifyPluginAsync = async (app) => {
  await app.register(catalogRoutes);
  await app.register(savedViewsRoutes);
};

export default platformRoutes;
