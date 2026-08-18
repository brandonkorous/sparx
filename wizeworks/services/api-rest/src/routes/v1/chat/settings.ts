// Live Chat — widget configuration routes (docs/56, docs/69 A-1).
//
//   GET   /v1/chat/settings  → current widget config (defaults-filled)
//   PATCH /v1/chat/settings  → partial-update the config blob
//
// Config lives on tenant.settings.chat (the module flag is separate). Gated by
// requireModule('chat'); editing requires admin (owner/admin) per Settings.

import type { FastifyPluginAsync } from 'fastify';
import { ok } from '@wizeworks/api-core/envelope';
import { requireAuth, requireRole } from '@wizeworks/api-core/auth';
import { badRequest } from '@wizeworks/api-core/errors';

import { requireChatModule } from '../../../lib/chat-context.js';
import {
  getChatConfig,
  updateChatConfig,
  toPublicChatConfig,
  ChatConfigPatchSchema,
} from '../../../lib/chat/index.js';
import { verifyAiProviderKey } from '../../../lib/ai/llm-router.js';

const chatSettingsRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/chat/settings', async (request) => {
    requireRole(request, 'viewer');
    await requireChatModule(request);
    const auth = requireAuth(request);
    const config = await getChatConfig(auth.tenantId);
    return ok(toPublicChatConfig(config));
  });

  app.patch('/v1/chat/settings', async (request) => {
    requireRole(request, 'admin');
    await requireChatModule(request);
    const auth = requireAuth(request);
    const patch = ChatConfigPatchSchema.parse(request.body);

    // A newly-pasted key is verified with a real call BEFORE it's encrypted
    // and stored — a bad key must never silently brick the AI first-responder.
    if (patch.aiApiKey) {
      const current = await getChatConfig(auth.tenantId);
      const provider = patch.aiProvider ?? current.aiProvider;
      if (!provider) {
        throw badRequest('Choose an AI provider before adding a key.');
      }
      const result = await verifyAiProviderKey(provider, patch.aiApiKey);
      if (!result.ok) throw badRequest(result.error);
    }

    const config = await updateChatConfig(auth.tenantId, patch);
    return ok(toPublicChatConfig(config));
  });

  return Promise.resolve();
};

export default chatSettingsRoutes;
