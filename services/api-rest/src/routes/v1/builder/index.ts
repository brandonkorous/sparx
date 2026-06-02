// Mounts every /v1/builder/* admin route group behind one registration.

import type { FastifyPluginAsync } from 'fastify';

import pageRoutes from './pages.js';

const builderRoutes: FastifyPluginAsync = async (app) => {
  await app.register(pageRoutes);
};

export default builderRoutes;
