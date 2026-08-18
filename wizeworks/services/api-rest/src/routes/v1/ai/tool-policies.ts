// MCP tool-policy routes (docs/07 §9). The tenant's per-tool allow/deny overlay on
// the code-defined MCP tool catalog. Reads are viewer; writes are ADMIN — toggling
// a tool's exposure is a security control (it governs what every AI connection can
// do), so it sits at the same bar as API-key issuance.

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import type { AuthContext } from '@wizeworks/api-core/auth';

import { requireAiModule, toAiContext } from '../../../lib/ai-context.js';
import { resolvePropertyId } from '../../../lib/property.js';
import {
  listToolPolicies,
  resetAllToolPolicies,
  resetToolPolicy,
  setToolPolicy,
} from '../../../lib/ai/tool-policy.js';
import { ToolPolicySetSchema } from '../../../lib/ai/types.js';

const ToolParam = z.object({ tool: z.string().min(1).max(80) });

/** The site this policy screen is operating on — the switcher's, bounded by what
 *  this member may reach. */
function siteOf(request: FastifyRequest, auth: AuthContext): Promise<string> {
  return resolvePropertyId(auth, request.headers['x-sparx-property-id'] as string | undefined);
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync demands async; route registration is sync.
const aiToolPolicyRoutes: FastifyPluginAsync = async (app) => {
  // The full tool catalog with each tool's effective exposure for THIS SITE
  // (docs/131 §3.5) — the site's own rows resolved over the tenant-wide ones.
  app.get('/v1/ai/tool-policies', async (request) => {
    const auth = requireRole(request, 'viewer');
    await requireAiModule(request);
    const propertyId = await siteOf(request, auth);
    return ok(await listToolPolicies(toAiContext(request), propertyId));
  });

  // Enable/disable one tool for THIS SITE's MCP connections. A policy row is a
  // safety decision about one business; before this it silently applied to every
  // business the tenant runs.
  app.put('/v1/ai/tool-policies/:tool', async (request) => {
    const auth = requireRole(request, 'admin');
    await requireAiModule(request);
    const { tool } = ToolParam.parse(request.params);
    const { enabled } = ToolPolicySetSchema.parse(request.body);
    const propertyId = await siteOf(request, auth);
    return ok(await setToolPolicy(toAiContext(request), propertyId, tool, enabled));
  });

  // Drop this SITE's override (falling back to the tenant-wide row, else
  // default-on). Deliberately not tenant-wide: undoing a change here must not
  // clear a sibling business's deliberate restriction.
  app.delete('/v1/ai/tool-policies/:tool', async (request) => {
    const auth = requireRole(request, 'admin');
    await requireAiModule(request);
    const { tool } = ToolParam.parse(request.params);
    const propertyId = await siteOf(request, auth);
    await resetToolPolicy(toAiContext(request), propertyId, tool);
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
