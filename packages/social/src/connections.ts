// Social connection + target READ view (docs/133 §5). The tenant's connected
// accounts and their publish targets — the data the manage UI lists AND an agent
// needs to know WHERE a post can go (a target's `id` is `create_social_post`'s
// `targets[].targetId`).
//
// Lives in @sparx/social (not api-rest) so every transport drives the SAME read —
// one service, many transports, exactly like posts.ts. api-rest's
// social-connections lib re-exports this; the OAuth connect / upsert / target-sync
// / disconnect side stays in api-rest (it is adapter- and crypto-bound
// provisioning, not post authoring, and is deliberately NOT agent-authorable).

import { withTenant } from '@sparx/db';

import type { SocialContext } from './context.js';

export interface SocialTargetView {
  id: string;
  externalTargetId: string;
  name: string;
  avatarUrl: string | null;
  enabled: boolean;
}

export interface SocialConnectionView {
  id: string;
  platform: string;
  status: string;
  /** Which site this connection speaks for (docs/133 §5); null = tenant-wide. */
  propertyId: string | null;
  displayName: string | null;
  externalId: string | null;
  avatarUrl: string | null;
  connectedAt: string;
  targets: SocialTargetView[];
}

/** The tenant's social connections + their targets, for the manage UI and the
 *  `list_social_connections` MCP tool. Read-only; ordered oldest connection first,
 *  targets by name. */
export async function listSocialConnections(ctx: SocialContext): Promise<SocialConnectionView[]> {
  const rows = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.socialConnection.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: 'asc' },
      include: { targets: { orderBy: { name: 'asc' } } },
    })
  );
  return rows.map((r) => ({
    id: r.id,
    platform: r.platform,
    status: r.status,
    propertyId: r.propertyId,
    displayName: r.displayName,
    externalId: r.externalId,
    avatarUrl: r.avatarUrl,
    connectedAt: r.createdAt.toISOString(),
    targets: r.targets.map((t) => ({
      id: t.id,
      externalTargetId: t.externalTargetId,
      name: t.name,
      avatarUrl: t.avatarUrl,
      enabled: t.enabled,
    })),
  }));
}
