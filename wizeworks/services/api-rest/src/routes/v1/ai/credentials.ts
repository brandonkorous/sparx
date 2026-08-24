// Tenant BYOK AI credential routes (docs/07). The one place a tenant connects
// their OWN AI account (Anthropic / OpenAI) — the credential every AI feature
// runs on. sparx never holds a platform-level key.
//
//   GET    /v1/ai/credentials        → the connected account (or null) + MCP endpoint
//   PUT    /v1/ai/credentials        → connect/replace the account (verifies the key first)
//   DELETE /v1/ai/credentials        → disconnect the account
//   POST   /v1/ai/credentials/test   → re-check the stored key against the provider
//
// Deliberately NOT gated on the `ai` module: this is account-wide setup, not an
// AI feature — a tenant may connect their key before turning AI on, and the
// surface must be able to load to explain that relationship. Reads are viewer;
// every write is ADMIN — pasting a provider credential sits at the same bar as
// API-key issuance and tool-policy changes.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { badRequest } from '@wizeworks/api-core/errors';

import { tenantPlatformBrand } from '../../../lib/tenant-brand.js';

import { AI_PROVIDERS } from '../../../lib/chat/types.js';
import {
  AiCredentialError,
  clearAiCredential,
  getAiCredentialPublic,
  mcpEndpoint,
  setAiCredential,
  testAiCredential,
} from '../../../lib/ai/credentials.js';

const ConnectBody = z.object({
  provider: z.enum(AI_PROVIDERS),
  // The raw provider key, pasted by the tenant. Encrypted server-side before it
  // ever reaches storage — never send or store ciphertext from the client.
  apiKey: z.string().min(1).max(500),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync demands async; route registration is sync.
const aiCredentialRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/ai/credentials', async (request) => {
    const auth = requireRole(request, 'viewer');
    const [credential, brand] = await Promise.all([
      getAiCredentialPublic(auth.tenantId),
      tenantPlatformBrand(auth.tenantId),
    ]);
    return ok({ credential, mcpEndpoint: mcpEndpoint(brand) });
  });

  app.put('/v1/ai/credentials', async (request) => {
    const auth = requireRole(request, 'admin');
    const body = ConnectBody.parse(request.body);
    try {
      const credential = await setAiCredential(auth.tenantId, body.provider, body.apiKey.trim());
      return ok({ credential, mcpEndpoint: mcpEndpoint(await tenantPlatformBrand(auth.tenantId)) });
    } catch (err) {
      // A rejected key is a user error, not a server fault — surface the
      // provider's own sentence ("that key was rejected …") as a 400.
      if (err instanceof AiCredentialError) throw badRequest(err.message);
      throw err;
    }
  });

  app.delete('/v1/ai/credentials', async (request) => {
    const auth = requireRole(request, 'admin');
    await clearAiCredential(auth.tenantId);
    return ok({ removed: true });
  });

  app.post('/v1/ai/credentials/test', async (request) => {
    const auth = requireRole(request, 'admin');
    const result = await testAiCredential(auth.tenantId);
    if (result === null) throw badRequest('There is no AI account connected to check.');
    return ok(result);
  });
};

export default aiCredentialRoutes;
