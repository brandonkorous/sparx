// Tier A on-prem bridge enrollment — the source-side state (docs/100 P5d, docs/28
// §3). An `agent` source is fed by an outbound-HTTPS bridge the tenant installs on
// their network; pairing mints a tenant-scoped API key (done in the api-rest route
// via @sparx/auth — key issuance stays out of this server-only domain package) and
// records a reference here so the connection can show "paired" + rotate/revoke.
//
// `touchAgent` is the liveness bump every push AND heartbeat calls — it drives the
// online/offline indicator. The key MINT/REVOKE itself lives in the route (it owns
// @sparx/auth); this module owns the source row.

import { withTenant } from '@sparx/db';

import { InventoryNotFoundError } from '../errors';
import type { ServiceContext } from '../errors';

/** A Tier-A agent counts as online if it pushed or heartbeat within this window.
 *  The bridge heartbeats every ~60s, so 5 min absorbs a few missed beats without
 *  flapping while still surfacing a genuinely-offline agent quickly. */
export const AGENT_ONLINE_GRACE_MS = 5 * 60 * 1000;

export interface AgentEnrollmentState {
  apiKeyId: string;
  apiKeyPrefix: string;
}

/** Record a freshly-minted bridge key on the source. Returns the PREVIOUS key id
 *  (if any) so the caller can revoke it — this is the rotate path (issue new →
 *  record → revoke old). On first enrollment the previous id is null. */
export async function recordAgentEnrollment(
  ctx: ServiceContext,
  sourceId: string,
  state: AgentEnrollmentState
): Promise<{ previousApiKeyId: string | null }> {
  return withTenant(ctx, async (tx) => {
    const source = await tx.inventorySource.findFirst({
      where: { id: sourceId, tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true, apiKeyId: true },
    });
    if (!source) throw new InventoryNotFoundError('InventorySource', sourceId);

    await tx.inventorySource.update({
      where: { id: sourceId },
      data: {
        apiKeyId: state.apiKeyId,
        apiKeyPrefix: state.apiKeyPrefix,
        enrolledAt: new Date(),
        // A fresh pairing resets liveness — the agent hasn't checked in on the new
        // key yet, so it reads offline until its first heartbeat.
        agentLastSeenAt: null,
        agentVersion: null,
        updatedAt: new Date(),
      },
    });
    return { previousApiKeyId: source.apiKeyId };
  });
}

/** Unpair: clear the enrollment reference + liveness. Returns the key id to revoke. */
export async function clearAgentEnrollment(
  ctx: ServiceContext,
  sourceId: string
): Promise<{ previousApiKeyId: string | null }> {
  return withTenant(ctx, async (tx) => {
    const source = await tx.inventorySource.findFirst({
      where: { id: sourceId, tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true, apiKeyId: true },
    });
    if (!source) throw new InventoryNotFoundError('InventorySource', sourceId);

    await tx.inventorySource.update({
      where: { id: sourceId },
      data: {
        apiKeyId: null,
        apiKeyPrefix: null,
        enrolledAt: null,
        agentLastSeenAt: null,
        agentVersion: null,
        updatedAt: new Date(),
      },
    });
    return { previousApiKeyId: source.apiKeyId };
  });
}

/** Liveness bump — every push + heartbeat calls this so the online/offline
 *  indicator stays fresh between snapshots. Optionally records the agent version.
 *  No-op-safe: a missing source throws NotFound (the key's tenant must own it). */
export async function touchAgent(
  ctx: ServiceContext,
  sourceId: string,
  opts: { agentVersion?: string | null } = {}
): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const updated = await tx.inventorySource.updateMany({
      where: { id: sourceId, tenantId: ctx.tenantId, deletedAt: null },
      data: {
        agentLastSeenAt: new Date(),
        ...(opts.agentVersion ? { agentVersion: opts.agentVersion } : {}),
      },
    });
    if (updated.count === 0) throw new InventoryNotFoundError('InventorySource', sourceId);
  });
}
