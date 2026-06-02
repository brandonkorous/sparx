// Mounts every /v1/builder/* admin route group behind one registration.

import type { FastifyPluginAsync } from 'fastify';

import pageRoutes from './pages.js';
import bindingSchemaRoutes from './binding-schema.js';

const builderRoutes: FastifyPluginAsync = async (app) => {
  await app.register(pageRoutes);
  await app.register(bindingSchemaRoutes);
};

export default builderRoutes;
