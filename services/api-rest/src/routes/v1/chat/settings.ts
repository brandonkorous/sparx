// Live Chat — widget configuration routes (docs/56, docs/69 A-1).
//
//   GET   /v1/chat/settings  → current widget config (defaults-filled)
//   PATCH /v1/chat/settings  → partial-update the config blob
//
// Config lives on tenant.settings.chat (the module flag is separate). Gated by
// requireModule('chat'); editing requires admin (owner/admin) per Settings.

import type { FastifyPluginAsync } from 'fastify';
import { ok } from '@sparx/api-core/envelope';
import { requireAuth, requireRole } from '@sparx/api-core/auth';

import { requireChatModule } from '../../../lib/chat-context.js';
import { getChatConfig, updateChatConfig, ChatConfigPatchSchema } from '../../../lib/chat/index.js';

const chatSettingsRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/chat/settings', async (request) => {
    requireRole(request, 'viewer');
    await requireChatModule(request);
    const auth = requireAuth(request);
    const config = await getChatConfig(auth.tenantId);
    return ok(config);
  });

  app.patch('/v1/chat/settings', async (request) => {
    requireRole(request, 'admin');
    await requireChatModule(request);
    const auth = requireAuth(request);
    const patch = ChatConfigPatchSchema.parse(request.body);
    const config = await updateChatConfig(auth.tenantId, patch);
    return ok(config);
  });

  return Promise.resolve();
};

export default chatSettingsRoutes;
