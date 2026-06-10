// Live Chat — staff route group registration (docs/56, docs/69 A-1).

import type { FastifyPluginAsync } from 'fastify';

import conversationRoutes from './conversations.js';
import quickReplyRoutes from './quick-replies.js';
import chatSettingsRoutes from './settings.js';

const chatRoutes: FastifyPluginAsync = async (app) => {
  await app.register(conversationRoutes);
  await app.register(quickReplyRoutes);
  await app.register(chatSettingsRoutes);
};

export default chatRoutes;
