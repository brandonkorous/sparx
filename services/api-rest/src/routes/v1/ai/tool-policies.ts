// MCP tool-policy routes (docs/07 §9). The tenant's per-tool allow/deny overlay on
// the code-defined MCP tool catalog. Reads are viewer; writes are ADMIN — toggling
// a tool's exposure is a security control (it governs what every AI connection can
// do), so it sits at the same bar as API-key issuance.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';

import { requireAiModule, toAiContext } from '../../../lib/ai-context.js';
import {
  listToolPolicies,
  resetAllToolPolicies,
  resetToolPolicy,
  setToolPolicy,
} from '../../../lib/ai/tool-policy.js';
import { ToolPolicySetSchema } from '../../../lib/ai/types.js';

const ToolParam = z.object({ tool: z.string().min(1).max(80) });

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync demands async; route registration is sync.
const aiToolPolicyRoutes: FastifyPluginAsync = async (app) => {
  // The full tool catalog with each tool's effective exposure for this tenant.
  app.get('/v1/ai/tool-policies', async (request) => {
    requireRole(request, 'viewer');
    await requireAiModule(request);
    return ok(await listToolPolicies(toAiContext(request)));
  });

  // Enable/disable one tool for this tenant's MCP connections.
  app.put('/v1/ai/tool-policies/:tool', async (request) => {
    requireRole(request, 'admin');
    await requireAiModule(request);
    const { tool } = ToolParam.parse(request.params);
    const { enabled } = ToolPolicySetSchema.parse(request.body);
    return ok(await setToolPolicy(toAiContext(request), tool, enabled));
  });

  // Drop one tool's override (back to default-on).
  app.delete('/v1/ai/tool-policies/:tool', async (request) => {
    requireRole(request, 'admin');
    await requireAiModule(request);
    const { tool } = ToolParam.parse(request.params);
    await resetToolPolicy(toAiContext(request), tool);
    return ok({ reset: true });
  });

  // Clear every override — all tools back to default-on.
  app.post('/v1/ai/tool-policies/reset', async (request) => {
    requireRole(request, 'admin');
    await requireAiModule(request);
    const cleared = await resetAllToolPolicies(toAiContext(request));
    return ok({ cleared });
  });
};

export default aiToolPolicyRoutes;
