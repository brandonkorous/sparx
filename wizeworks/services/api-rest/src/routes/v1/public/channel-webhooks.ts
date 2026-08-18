// Public channel webhook (docs/106 §4.4, docs/27 §6) — the single inbound endpoint
// every ORDER channel posts to:
//
//   POST /v1/public/webhooks/channels/:slug
//
// An order channel's webhook URL is registered once at the APP level (one URL for
// every tenant), so this handler resolves the tenant from the payload's shop id via
// the global shop-link directory, verifies the signature, normalizes the order
// through the channel adapter, and ingests it (order + inventory) — all before
// acking. Synchronous ingest is the safest design: the channel only gets a 200 once
// the order is durably stored, and the ingest is idempotent (deterministic order
// number), so a retried delivery never double-writes.
//
// Always 200 on a structural problem (unknown slug, unparseable body, shop not
// connected here) so the channel stops retrying; 403 on a bad signature; 500 only on
// a transient ingest failure (the channel retries, ingest dedupes).

import type { FastifyPluginAsync } from 'fastify';
import { getChannel, type ChannelSlug } from '@wizeworks/channels';
import { registerBuiltinChannels } from '@wizeworks/channels/adapters';
import { ingestChannelOrder } from '@wizeworks/commerce';
import { resolveConnectionAuth, resolveWebhookConnection } from '../../../lib/channels.js';

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const channelWebhookRoutes: FastifyPluginAsync = async (app) => {
  // Register the built-in adapters once (idempotent) so the registry can resolve
  // the channel for verify/ingest.
  registerBuiltinChannels();

  // Raw bytes for signature verification, scoped to this encapsulated plugin.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body: Buffer, done) => {
      done(null, body);
    }
  );

  app.post('/v1/public/webhooks/channels/:slug', async (request, reply) => {
    const slug = (request.params as { slug: string }).slug as ChannelSlug;
    const adapter = getChannel(slug);
    const rawBody = request.body instanceof Buffer ? request.body.toString('utf8') : '';

    // Only order-shape adapters carry inbound webhooks. Anything else → ack + ignore.
    if (!adapter?.ingestOrder || !adapter.webhookShopId) {
      return reply.code(200).send({ received: true });
    }

    // Verify the signature against the raw bytes BEFORE trusting the payload.
    if (adapter.verifyWebhook && !adapter.verifyWebhook({ headers: request.headers, rawBody })) {
      request.log.warn({ slug }, 'channel webhook: signature verification failed');
      return reply.code(403).send({ error: 'invalid signature' });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return reply.code(200).send({ received: true });
    }

    const shopId = adapter.webhookShopId(payload);
    if (!shopId) {
      return reply.code(200).send({ received: true });
    }

    const resolved = await resolveWebhookConnection(slug, shopId);
    if (!resolved) {
      request.log.warn({ slug, shopId }, 'channel webhook: shop not connected here — acking');
      return reply.code(200).send({ received: true });
    }

    const auth = await resolveConnectionAuth(resolved.tenantId, resolved.connection, adapter);
    if (!auth) {
      request.log.warn(
        { slug, shopId, tenantId: resolved.tenantId },
        'channel webhook: connection has no usable token — acking'
      );
      return reply.code(200).send({ received: true });
    }

    try {
      const order = await adapter.ingestOrder(auth, payload);
      const result = await ingestChannelOrder(
        { tenantId: resolved.tenantId },
        {
          channel: slug,
          externalId: order.externalId,
          externalStatus: order.externalStatus,
          placedAt: order.placedAt,
          currency: order.currency,
          customer: order.customer,
          shippingAddress: order.shippingAddress,
          lines: order.lines.map((l) => ({
            externalSku: l.externalSku,
            externalVariantId: l.externalVariantId,
            quantity: l.quantity,
            unitPriceCents: l.unitPriceCents,
          })),
          channelFeeCents: order.channelFeeCents,
        }
      );
      request.log.info(
        {
          slug,
          shopId,
          tenantId: resolved.tenantId,
          orderId: result.orderId,
          orderNumber: result.orderNumber,
          deduped: result.deduped,
          unmappedSkus: result.unmappedSkus.length,
        },
        'channel webhook: order ingested'
      );
      return reply.code(200).send({ received: true });
    } catch (err) {
      request.log.error(
        { slug, shopId, err: err instanceof Error ? err.message : String(err) },
        'channel webhook: ingest failed — will retry'
      );
      // 500 → the channel retries; ingest is idempotent so the retry is safe.
      return reply.code(500).send({ error: 'ingest failed' });
    }
  });
};

export default channelWebhookRoutes;
