// Mounts every /v1/analytics/* route group behind one registration.

import type { FastifyPluginAsync } from 'fastify';

import queryRoutes from './query.js';
import dashboardRoutes from './dashboards.js';

const analyticsRoutes: FastifyPluginAsync = async (app) => {
  await app.register(queryRoutes);
  await app.register(dashboardRoutes);
};

export default analyticsRoutes;
