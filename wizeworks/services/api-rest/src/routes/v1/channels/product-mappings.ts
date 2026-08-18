// Channel product mappings — the sparx variant ↔ external listing link.
//
//   GET    /v1/channels/mappings?product_id=<uuid>  → every mapping for one product
//   PATCH  /v1/channels/mappings/:id                → pause/resume syncing one listing
//   DELETE /v1/channels/mappings/:id                → unlink (does NOT delist)
//
// `channel_product_mappings` has existed since the channels module shipped and
// has been written by the sync worker and read by order ingest, but it has never
// had a transport of its own — so nothing in any UI could answer "where is this
// product actually listed, and is that listing healthy". These three routes are
// that answer, and no more: creating a mapping is the sync worker's job (it is
// the side of the pair that knows the external ids), so there is deliberately no
// POST here for an operator to hand-type a listing id into.
//
// The list is keyed on PRODUCT, not connection, because that is the question a
// product panel asks. Mappings are variant-grain, so a four-variant product on
// three channels is twelve rows in one request rather than twelve requests.
//
// DELETE unlinks locally. It cannot delist on the channel's side — that is the
// channel's own seller tools — and the copy in the UI has to say so, because
// "remove" that leaves a live listing selling stock we no longer decrement is
// the worst possible thing for this button to mean silently.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant } from '@wizeworks/db';
import { getChannelDescriptor, type ChannelSlug } from '@wizeworks/channels';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { notFound } from '@wizeworks/api-core/errors';
import { requireChannelsModule, toChannelContext } from '../../../lib/channel-context.js';

const ProductQuery = z.object({ product_id: z.string().uuid() });
const PathId = z.object({ id: z.string().uuid() });
const PatchBody = z.object({ syncEnabled: z.boolean() });

/** The channel's display name, so a panel never has to render `google_shopping`
 *  at a person. Falls back to the stored slug for a channel that has since been
 *  dropped from the catalog — an unknown name is better than a blank cell. */
function channelName(slug: string): string {
  return getChannelDescriptor(slug as ChannelSlug)?.name ?? slug;
}

const channelProductMappingRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/channels/mappings', async (request) => {
    await requireChannelsModule(request);
    requireRole(request, 'viewer');
    const ctx = toChannelContext(request);
    const { product_id: productId } = ProductQuery.parse(request.query);

    const rows = await withTenant(ctx, (tx) =>
      tx.channelProductMapping.findMany({
        where: { tenantId: ctx.tenantId, productId },
        orderBy: [{ channel: 'asc' }, { createdAt: 'asc' }],
        include: {
          connection: {
            select: { id: true, status: true, shopName: true, lastSyncedAt: true },
          },
          variant: { select: { id: true, sku: true, title: true } },
        },
      })
    );

    return ok(
      rows.map((row) => ({
        id: row.id,
        channel: row.channel,
        channelName: channelName(row.channel),
        connectionId: row.connectionId,
        connectionStatus: row.connection.status,
        shopName: row.connection.shopName,
        variantId: row.variantId,
        variantSku: row.variant.sku,
        variantTitle: row.variant.title,
        externalProductId: row.externalProductId,
        externalVariantId: row.externalVariantId,
        externalSku: row.externalSku,
        syncEnabled: row.syncEnabled,
        lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
        syncError: row.syncError,
      }))
    );
  });

  app.patch('/v1/channels/mappings/:id', async (request) => {
    await requireChannelsModule(request);
    requireRole(request, 'editor');
    const ctx = toChannelContext(request);
    const { id } = PathId.parse(request.params);
    const body = PatchBody.parse(request.body ?? {});

    const existing = await withTenant(ctx, (tx) =>
      tx.channelProductMapping.findFirst({ where: { id, tenantId: ctx.tenantId } })
    );
    if (!existing) throw notFound('channel listing', id);

    const updated = await withTenant(ctx, (tx) =>
      tx.channelProductMapping.update({
        where: { id },
        data: { syncEnabled: body.syncEnabled },
      })
    );
    return ok({ id: updated.id, syncEnabled: updated.syncEnabled });
  });

  app.delete('/v1/channels/mappings/:id', async (request, reply) => {
    await requireChannelsModule(request);
    requireRole(request, 'editor');
    const ctx = toChannelContext(request);
    const { id } = PathId.parse(request.params);

    const existing = await withTenant(ctx, (tx) =>
      tx.channelProductMapping.findFirst({ where: { id, tenantId: ctx.tenantId } })
    );
    if (!existing) throw notFound('channel listing', id);

    await withTenant(ctx, (tx) => tx.channelProductMapping.delete({ where: { id } }));
    reply.code(204);
  });

  return Promise.resolve();
};

export default channelProductMappingRoutes;
