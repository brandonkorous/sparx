// Mounts every /v1/builder/* admin route group behind one registration.

import type { FastifyPluginAsync } from 'fastify';

import pageRoutes from './pages.js';
import layoutRoutes from './layout.js';
import bindingSchemaRoutes from './binding-schema.js';
import surfaceRoutes from './surface.js';
import previewRoutes from './preview.js';

const builderRoutes: FastifyPluginAsync = async (app) => {
  await app.register(pageRoutes);
  await app.register(layoutRoutes);
  await app.register(bindingSchemaRoutes);
  await app.register(surfaceRoutes);
  await app.register(previewRoutes);
};

export default builderRoutes;
