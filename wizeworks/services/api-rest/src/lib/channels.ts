// Channel connection management (docs/106). Thin DB orchestration over
// channel_connections / channel_product_mappings — the OAuth dance + per-channel
// sync live in the adapters (@wizeworks/channels) and the channel-sync-worker; this
// is the dashboard's read/disconnect surface. Mirrors how dropship keeps its DB
// orchestration in api-rest rather than the pure-contract package.

import { withSystem, withTenant } from '@wizeworks/db';
import type { Prisma } from '@wizeworks/db';
import { decryptChannelToken, encryptChannelToken } from '@wizeworks/channels/crypto';
import type { ChannelAdapter, ChannelAuth } from '@wizeworks/channels';
import type { ChannelContext } from './channel-context.js';

export interface ChannelConnectionView {
  id: string;
  channel: string;
  status: string;
  /** Which site this connection sells for (docs/131 §4); null = tenant-wide. The
   *  manage UI shows it so two businesses' Etsy connections are distinguishable. */
  propertyId: string | null;
  shopName: string | null;
  externalId: string | null;
  lastSyncedAt: string | null;
  connectedAt: string;
  mappingCount: number;
}

/** The tenant's channel connections, newest activity surfaced for the manage UI. */
export async function listChannelConnections(
  ctx: ChannelContext
): Promise<ChannelConnectionView[]> {
  const rows = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.channelConnection.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { mappings: true } } },
    })
  );
  return rows.map((r) => ({
    id: r.id,
    channel: r.channel,
    status: r.status,
    propertyId: r.propertyId,
    shopName: r.shopName,
    externalId: r.externalId,
    lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null,
    connectedAt: r.createdAt.toISOString(),
    mappingCount: r._count.mappings,
  }));
}

export interface ChannelConnectionUpsert {
  channel: string;
  /** The site this connection belongs to (docs/131 §4); null = tenant-wide.
   *  Carried from the OAuth state, not re-derived. */
  propertyId: string | null;
  externalId: string | null;
  shopName: string | null;
  /** AES-256-GCM ciphertext (via @wizeworks/channels/crypto) — never plaintext. */
  accessTokenEnc: string;
  refreshTokenEnc: string | null;
  tokenExpiresAt: Date | null;
  scopes: string[];
  /** Channel-specific NON-secret params every later API call needs (TikTok's
   *  shopCipher/region). Persisted on the connection metadata + surfaced back as
   *  {@link ChannelAuth.params} on each adapter call. */
  params?: Record<string, string>;
}

/** Create or refresh the tenant's connection for one channel after a successful
 *  OAuth exchange. One connection per (tenant, channel); re-connecting overwrites
 *  the stored grant and clears the prior sync-error trail. Also maintains the
 *  global shop→tenant routing directory so the app-level order webhook can resolve
 *  this tenant from the shop id (docs/106 §4.4). */
export async function upsertChannelConnection(
  ctx: ChannelContext,
  input: ChannelConnectionUpsert
): Promise<void> {
  const metadata = { channelParams: input.params ?? {} } as Prisma.InputJsonValue;
  await withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    // findFirst + branch rather than upsert: the unique is now
    // (tenant, property, channel) with a NULLABLE property, and Prisma's
    // compound-unique input requires non-null components, so a tenant-wide
    // connection (property_id IS NULL) is unreachable through the unique key.
    // The DB still guarantees one — the index is NULLS NOT DISTINCT.
    const existing = await tx.channelConnection.findFirst({
      where: { propertyId: input.propertyId ?? null, channel: input.channel },
      select: { id: true },
    });
    const connection = existing
      ? await tx.channelConnection.update({
          where: { id: existing.id },
          data: {
            status: 'active',
            externalId: input.externalId,
            shopName: input.shopName,
            accessTokenEnc: input.accessTokenEnc,
            refreshTokenEnc: input.refreshTokenEnc,
            tokenExpiresAt: input.tokenExpiresAt,
            scopes: input.scopes,
            syncErrors: [],
            metadata,
          },
          select: { id: true },
        })
      : await tx.channelConnection.create({
          data: {
            tenantId: ctx.tenantId,
            propertyId: input.propertyId ?? null,
            channel: input.channel,
            status: 'active',
            externalId: input.externalId,
            shopName: input.shopName,
            accessTokenEnc: input.accessTokenEnc,
            refreshTokenEnc: input.refreshTokenEnc,
            tokenExpiresAt: input.tokenExpiresAt,
            scopes: input.scopes,
            metadata,
          },
          select: { id: true },
        });

    // Routing directory: drop any stale link for this connection (a reconnect to a
    // different shop) and upsert the current shop → (tenant, connection). RLS pins
    // the write to this tenant; the global SELECT lets the webhook resolve it.
    await tx.channelShopLink.deleteMany({
      where: {
        connectionId: connection.id,
        ...(input.externalId ? { NOT: { externalId: input.externalId } } : {}),
      },
    });
    if (input.externalId) {
      await tx.channelShopLink.upsert({
        where: {
          channel_externalId: { channel: input.channel, externalId: input.externalId },
        },
        create: {
          channel: input.channel,
          externalId: input.externalId,
          tenantId: ctx.tenantId,
          connectionId: connection.id,
        },
        update: { tenantId: ctx.tenantId, connectionId: connection.id },
      });
    }
  });
}

/** Remove a channel connection; its product mappings cascade (DB FK). The global
 *  shop-link rows have no FK, so drop them explicitly in the same tenant tx. */
export async function disconnectChannel(ctx: ChannelContext, channel: string): Promise<void> {
  await withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    await tx.channelShopLink.deleteMany({ where: { tenantId: ctx.tenantId, channel } });
    await tx.channelConnection.deleteMany({ where: { tenantId: ctx.tenantId, channel } });
  });
}

// ── Inbound webhook auth resolution (docs/106 §4.4) ─────────────────────────────

const REFRESH_SKEW_MS = 60_000;

export interface ChannelConnectionAuthRow {
  id: string;
  externalId: string | null;
  accessTokenEnc: string | null;
  refreshTokenEnc: string | null;
  tokenExpiresAt: Date | null;
  metadata: Prisma.JsonValue;
}

const AUTH_ROW_SELECT = {
  id: true,
  externalId: true,
  accessTokenEnc: true,
  refreshTokenEnc: true,
  tokenExpiresAt: true,
  metadata: true,
} as const;

/** Read the channel-specific params back off the connection metadata. */
function paramsFromMetadata(metadata: Prisma.JsonValue): Record<string, string> | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
  const raw = (metadata as Record<string, unknown>).channelParams;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Resolve a live ChannelAuth for a connection: decrypt the access token, refresh
 *  it when near expiry (persisting the rotated grant), and surface the channel
 *  params. Mirrors the channel-sync-worker's resolver — api-rest owns the inbound
 *  webhook ingest, so it resolves auth to call the channel's order-detail API. */
export async function resolveConnectionAuth(
  tenantId: string,
  connection: ChannelConnectionAuthRow,
  adapter: ChannelAdapter
): Promise<ChannelAuth | null> {
  if (!connection.accessTokenEnc || !connection.externalId) return null;
  let accessToken = decryptChannelToken(connection.accessTokenEnc);
  const params = paramsFromMetadata(connection.metadata);

  const expiresAt = connection.tokenExpiresAt?.getTime();
  const nearExpiry = expiresAt != null && expiresAt - Date.now() <= REFRESH_SKEW_MS;
  if (nearExpiry && adapter.refresh && connection.refreshTokenEnc) {
    try {
      const tokens = await adapter.refresh(decryptChannelToken(connection.refreshTokenEnc));
      accessToken = tokens.accessToken;
      await withTenant({ tenantId }, (tx) =>
        tx.channelConnection.update({
          where: { id: connection.id },
          data: {
            accessTokenEnc: encryptChannelToken(tokens.accessToken),
            refreshTokenEnc: tokens.refreshToken
              ? encryptChannelToken(tokens.refreshToken)
              : connection.refreshTokenEnc,
            tokenExpiresAt: tokens.expiresInSeconds
              ? new Date(Date.now() + tokens.expiresInSeconds * 1000)
              : null,
          },
        })
      );
    } catch {
      // Non-fatal — proceed with the current token; a real 401 downstream surfaces
      // as a webhook error and the channel retries.
    }
  }
  return { externalId: connection.externalId, accessToken, params };
}

/** Resolve the tenant + connection that owns a channel shop via the GLOBAL
 *  shop-link directory (cross-tenant read), then load the connection tenant-scoped.
 *  Returns null when the shop isn't connected on this deployment. */
export async function resolveWebhookConnection(
  channel: string,
  shopExternalId: string
): Promise<{ tenantId: string; connection: ChannelConnectionAuthRow } | null> {
  const link = await withSystem((tx) =>
    tx.channelShopLink.findUnique({
      where: { channel_externalId: { channel, externalId: shopExternalId } },
      select: { tenantId: true, connectionId: true },
    })
  );
  if (!link) return null;
  const connection = await withTenant({ tenantId: link.tenantId }, (tx) =>
    tx.channelConnection.findFirst({
      where: { id: link.connectionId, status: 'active' },
      select: AUTH_ROW_SELECT,
    })
  );
  if (!connection) return null;
  return { tenantId: link.tenantId, connection };
}
