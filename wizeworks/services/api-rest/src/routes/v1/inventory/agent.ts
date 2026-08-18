// Tier A bridge agent enrollment + heartbeat (docs/100 P5d, docs/28 §3).
//
//   POST /v1/inventory/sources/:id/enroll        ← admin: pair / rotate the bridge key
//   POST /v1/inventory/sources/:id/revoke-agent  ← admin: unpair (revoke the key)
//   POST /v1/inventory/sources/:id/heartbeat     ← the agent's API key: liveness ping
//
// An `agent` source is fed by an outbound-HTTPS bridge the tenant installs on their
// network. Pairing mints a tenant-scoped API key (@wizeworks/auth) the agent
// authenticates with; we store a reference (id + visible prefix) on the source. The
// full secret is returned ONCE from /enroll and never again. Liveness (push +
// heartbeat) drives the online/offline indicator in sync-health.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant } from '@wizeworks/db';
import { inventoryService } from '@wizeworks/inventory';
import { issueApiKey, revokeApiKey } from '@wizeworks/auth';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { notFound, conflict } from '@wizeworks/api-core/errors';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';

// The bridge key only needs to push stock; scope it narrowly.
const BRIDGE_SCOPES = ['inventory:push'];

const HeartbeatBody = z.object({
  agentVersion: z.string().max(50).optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventoryAgentRoutes: FastifyPluginAsync = async (app) => {
  // ── Enroll / rotate ────────────────────────────────────────────────────────────
  //
  // Mints a fresh bridge key and records it on the source. Re-enrolling rotates: the
  // new key is recorded first, then the previous key is revoked, so the agent is
  // never keyless mid-swap. The plaintext is returned ONCE.

  app.post('/v1/inventory/sources/:id/enroll', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const ctx = toInventoryContext(request);
    const { tenantId, userId } = ctx;
    const { id } = request.params as { id: string };

    const source = await withTenant({ tenantId }, (tx) =>
      tx.inventorySource.findFirst({
        where: { id, tenantId, deletedAt: null },
        select: { id: true, name: true, type: true },
      })
    );
    if (!source) throw notFound('Inventory source not found');
    if (source.type !== 'agent') {
      throw conflict('Only on-prem agent sources can pair a bridge.');
    }

    const issued = await issueApiKey({
      tenantId,
      name: `Bridge: ${source.name}`,
      scopes: BRIDGE_SCOPES,
      createdByUserId: userId ?? null,
    });
    const { previousApiKeyId } = await inventoryService.recordAgentEnrollment(ctx, id, {
      apiKeyId: issued.id,
      apiKeyPrefix: issued.prefix,
    });
    if (previousApiKeyId) await revokeApiKey(tenantId, previousApiKeyId);

    return reply.status(201).send(
      ok({
        sourceId: id,
        // Show ONCE — the dashboard surfaces it in a copy-then-dismiss modal.
        apiKey: issued.plaintext,
        prefix: issued.prefix,
        rotated: previousApiKeyId !== null,
      })
    );
  });

  // ── Revoke / unpair ──────────────────────────────────────────────────────────────

  app.post('/v1/inventory/sources/:id/revoke-agent', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const ctx = toInventoryContext(request);
    const { tenantId } = ctx;
    const { id } = request.params as { id: string };

    const { previousApiKeyId } = await inventoryService.clearAgentEnrollment(ctx, id);
    if (previousApiKeyId) await revokeApiKey(tenantId, previousApiKeyId);

    return reply.send(ok({ sourceId: id, unpaired: true }));
  });

  // ── Heartbeat (authenticated by the agent's own bridge key) ──────────────────────
  //
  // The agent pings this on a short interval — independent of stock changes — so the
  // online/offline indicator stays fresh between snapshots. Bumps `agentLastSeenAt`
  // and records the reported agent version.

  app.post('/v1/inventory/sources/:id/heartbeat', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const ctx = toInventoryContext(request);
    const { id } = request.params as { id: string };
    const body = HeartbeatBody.parse(request.body ?? {});

    await inventoryService.touchAgent(ctx, id, { agentVersion: body.agentVersion ?? null });

    return reply.send(ok({ sourceId: id, ok: true, serverTime: new Date().toISOString() }));
  });
};

export default inventoryAgentRoutes;
