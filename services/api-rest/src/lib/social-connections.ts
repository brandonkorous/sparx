// Social connection + target management (docs/133). Thin DB orchestration over
// social_connections / social_targets — the OAuth dance lives in the adapters
// (@sparx/social) and the publish path in the social-worker; this is the dashboard's
// connect / list / attach / disconnect surface. Mirrors how channels keeps its DB
// orchestration in api-rest rather than the pure-contract package.

import { Prisma, withTenant } from '@sparx/db';
import type { SocialPlatform, SocialTargetRef } from '@sparx/social';
import type { SocialContext } from './social-context.js';

// ── read views ──────────────────────────────────────────────────────────────────

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

/** The tenant's social connections + their targets, for the manage UI. */
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

// ── connection upsert ─────────────────────────────────────────────────────────────

export interface SocialConnectionUpsert {
  platform: SocialPlatform;
  /** The site this connection belongs to (docs/133 §5); null = tenant-wide. Carried
   *  from the OAuth state, not re-derived. */
  propertyId: string | null;
  externalId: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  /** AES-256-GCM ciphertext (via @sparx/social/crypto) — never plaintext. */
  accessTokenEnc: string;
  refreshTokenEnc: string | null;
  tokenExpiresAt: Date | null;
  scopes: string[];
  /** Platform-specific NON-secret params every later API call needs. Persisted on the
   *  connection metadata + surfaced back as SocialAuth.params on each adapter call. */
  params?: Record<string, string>;
}

/** Create or refresh the tenant's connection for one platform after a successful OAuth
 *  exchange. One connection per (tenant, site, platform); re-connecting overwrites the
 *  stored grant and clears the prior error. Returns the connection id so the caller can
 *  immediately sync its targets. */
export async function upsertSocialConnection(
  ctx: SocialContext,
  input: SocialConnectionUpsert
): Promise<string> {
  const metadata = { socialParams: input.params ?? {} } as Prisma.InputJsonValue;
  return withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    // findFirst + branch rather than upsert: the unique is (tenant, property,
    // platform) with a NULLABLE property, so a tenant-wide connection (property_id
    // IS NULL) is unreachable through Prisma's compound-unique input. The DB still
    // guarantees one — the index is NULLS NOT DISTINCT.
    const existing = await tx.socialConnection.findFirst({
      where: { propertyId: input.propertyId ?? null, platform: input.platform },
      select: { id: true },
    });
    const connection = existing
      ? await tx.socialConnection.update({
          where: { id: existing.id },
          data: {
            status: 'active',
            externalId: input.externalId,
            displayName: input.displayName,
            avatarUrl: input.avatarUrl,
            accessTokenEnc: input.accessTokenEnc,
            refreshTokenEnc: input.refreshTokenEnc,
            tokenExpiresAt: input.tokenExpiresAt,
            scopes: input.scopes,
            lastError: Prisma.DbNull,
            metadata,
          },
          select: { id: true },
        })
      : await tx.socialConnection.create({
          data: {
            tenantId: ctx.tenantId,
            propertyId: input.propertyId ?? null,
            platform: input.platform,
            status: 'active',
            externalId: input.externalId,
            displayName: input.displayName,
            avatarUrl: input.avatarUrl,
            accessTokenEnc: input.accessTokenEnc,
            refreshTokenEnc: input.refreshTokenEnc,
            tokenExpiresAt: input.tokenExpiresAt,
            scopes: input.scopes,
            metadata,
          },
          select: { id: true },
        });
    return connection.id;
  });
}

// ── target sync ─────────────────────────────────────────────────────────────────

/** Reconcile the discovered targets for a connection: upsert each (preserving the
 *  tenant's enabled toggle on existing rows) and drop any that the account no longer
 *  exposes. Returns the resulting targets for the connect response. */
export async function syncConnectionTargets(
  ctx: SocialContext,
  connectionId: string,
  platform: SocialPlatform,
  targets: SocialTargetRef[]
): Promise<SocialTargetView[]> {
  return withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    for (const t of targets) {
      const meta = { params: t.params ?? {} } as Prisma.InputJsonValue;
      await tx.socialTarget.upsert({
        where: {
          connectionId_externalTargetId: {
            connectionId,
            externalTargetId: t.externalTargetId,
          },
        },
        // Preserve `enabled` on update — a reconnect must not silently re-enable a
        // target the tenant turned off.
        update: { name: t.name, avatarUrl: t.avatarUrl ?? null, metadata: meta },
        create: {
          tenantId: ctx.tenantId,
          connectionId,
          platform,
          externalTargetId: t.externalTargetId,
          name: t.name,
          avatarUrl: t.avatarUrl ?? null,
          metadata: meta,
        },
      });
    }

    // Drop targets the account no longer exposes.
    const keep = targets.map((t) => t.externalTargetId);
    await tx.socialTarget.deleteMany({
      where: { connectionId, externalTargetId: { notIn: keep.length ? keep : ['__none__'] } },
    });

    const rows = await tx.socialTarget.findMany({
      where: { connectionId },
      orderBy: { name: 'asc' },
    });
    return rows.map((t) => ({
      id: t.id,
      externalTargetId: t.externalTargetId,
      name: t.name,
      avatarUrl: t.avatarUrl,
      enabled: t.enabled,
    }));
  });
}

/** Toggle a single target on/off (the tenant's per-destination publish switch). */
export async function setTargetEnabled(
  ctx: SocialContext,
  targetId: string,
  enabled: boolean
): Promise<boolean> {
  return withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    const result = await tx.socialTarget.updateMany({
      where: { id: targetId, tenantId: ctx.tenantId },
      data: { enabled },
    });
    return result.count > 0;
  });
}

/** Disconnect every connection for a platform; its targets cascade (DB FK). */
export async function disconnectSocial(
  ctx: SocialContext,
  platform: SocialPlatform
): Promise<void> {
  await withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.socialConnection.deleteMany({ where: { tenantId: ctx.tenantId, platform } })
  );
}
