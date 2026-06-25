// Channels API (docs/106). The dashboard's Settings → Channels surface: list the
// tenant's connections + the available channel catalog, begin a connect flow, and
// disconnect. Gated on the Commerce module (channels carry no separate fee).
//
//   GET    /v1/channels                  → { connections, catalog }
//   POST   /v1/channels/:slug/connect    → begins OAuth connect (409 until the
//                                           channel's adapter ships — P1+)
//   DELETE /v1/channels/:slug            → disconnect (mappings cascade)
//
// The OAuth authorize-URL build + callback exchange land with the first concrete
// adapter (P1); until then the registry is empty and connect returns CONFLICT.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  CHANNEL_CATALOG,
  getChannel,
  getChannelDescriptor,
  type ChannelSlug,
} from '@sparx/channels';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { conflict, notFound } from '@sparx/api-core/errors';
import { requireChannelsModule, toChannelContext } from '../../../lib/channel-context.js';
import { disconnectChannel, listChannelConnections } from '../../../lib/channels.js';

const CHANNEL_SLUGS = CHANNEL_CATALOG.map((c) => c.slug) as [ChannelSlug, ...ChannelSlug[]];
const PathSlug = z.object({ slug: z.enum(CHANNEL_SLUGS) });

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const channelRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/channels', async (request, reply) => {
    await requireChannelsModule(request);
    requireRole(request, 'viewer');
    const connections = await listChannelConnections(toChannelContext(request));
    return reply.send(ok({ connections, catalog: CHANNEL_CATALOG }));
  });

  app.post('/v1/channels/:slug/connect', async (request) => {
    await requireChannelsModule(request);
    requireRole(request, 'admin');
    const { slug } = PathSlug.parse(request.params);
    const descriptor = getChannelDescriptor(slug);
    if (!descriptor) throw notFound('channel', slug);

    const adapter = getChannel(slug);
    if (!adapter) {
      throw conflict(
        `${descriptor.name} is not available to connect yet — it ships in ${descriptor.phase}.`,
        { slug, phase: descriptor.phase }
      );
    }
    // An adapter is registered (P1+). Building the signed OAuth state + the
    // authorize URL (adapter.connectUrl) and the callback exchange land with the
    // first adapter (docs/106 §4.6); the dispatch above does not change.
    throw conflict(`${descriptor.name} connect flow is not yet wired.`, { slug });
  });

  app.delete('/v1/channels/:slug', async (request, reply) => {
    await requireChannelsModule(request);
    requireRole(request, 'admin');
    const { slug } = PathSlug.parse(request.params);
    await disconnectChannel(toChannelContext(request), slug);
    return reply.status(204).send();
  });
};

export default channelRoutes;
