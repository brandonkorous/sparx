// Tenant MCP OAuth connection routes (docs/07 §5). The tenant-facing view of
// "which AI assistants have connected themselves to sparx" — the connections a
// third-party client (Claude, ChatGPT, Copilot) creates through the OAuth
// consent flow, as opposed to the manually-issued `sk_live_*` keys.
//
//   GET    /v1/ai/mcp-connections              → the live connected assistants (admin)
//   DELETE /v1/ai/mcp-connections/:clientId    → cut one off immediately (admin)
//
// Deliberately NOT gated on the `ai` module — a connection is account-wide
// access, and the surface must be able to load it (and its kill switch) whatever
// the module state. Listing is ADMIN because it exposes who can reach the
// tenant's data; revoking is ADMIN — the same bar as revoking an API key.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { listMcpConnections, revokeMcpConnection } from '@wizeworks/auth';

const ClientParam = z.object({ clientId: z.string().min(1).max(255) });

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync demands async; route registration is sync.
const aiMcpConnectionRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/ai/mcp-connections', async (request) => {
    const auth = requireRole(request, 'admin');
    return ok(await listMcpConnections(auth.tenantId));
  });

  app.delete('/v1/ai/mcp-connections/:clientId', async (request) => {
    const auth = requireRole(request, 'admin');
    const { clientId } = ClientParam.parse(request.params);
    // Deletes every token this client holds for THIS tenant's users, cutting the
    // assistant off at once; the client registration itself is left intact so a
    // fresh authorization must pass consent again.
    const revoked = await revokeMcpConnection(auth.tenantId, clientId);
    return ok({ revoked });
  });
};

export default aiMcpConnectionRoutes;
