// Mounts every /v1/builder/* admin route group behind one registration.

import type { FastifyPluginAsync } from 'fastify';

import pageRoutes from './pages.js';
import siteRoutes from './site.js';
import assignmentRoutes from './assignments.js';
import layoutRoutes from './layout.js';
import themeRoutes from './themes.js';
import emailRoutes from './emails.js';
import componentRoutes from './components.js';
import bindingSchemaRoutes from './binding-schema.js';
import surfaceRoutes from './surface.js';
import previewRoutes from './preview.js';
import governanceRoutes from './governance.js';
import archetypeRoutes from './archetypes.js';
import analyticsRoutes from './analytics.js';
import historyRoutes from './history.js';

const builderRoutes: FastifyPluginAsync = async (app) => {
  await app.register(pageRoutes);
  await app.register(siteRoutes);
  await app.register(assignmentRoutes);
  await app.register(layoutRoutes);
  await app.register(themeRoutes);
  await app.register(emailRoutes);
  await app.register(componentRoutes);
  await app.register(bindingSchemaRoutes);
  await app.register(surfaceRoutes);
  await app.register(previewRoutes);
  await app.register(governanceRoutes);
  await app.register(archetypeRoutes);
  await app.register(analyticsRoutes);
  await app.register(historyRoutes);
};

export default builderRoutes;
