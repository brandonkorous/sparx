// Channels API (docs/106). The dashboard's Settings → Channels surface: list the
// tenant's connections + the available channel catalog, begin an OAuth connect,
// complete the callback, and disconnect. Gated on the Commerce module (channels
// carry no separate fee).
//
//   GET    /v1/channels                    → { connections, catalog }
//   GET    /v1/channels/:slug/connect-url  → { url } — signed-state OAuth authorize
//                                            URL the dashboard redirects the browser to
//   POST   /v1/channels/callback           → { connected } — exchange code+state,
//                                            encrypt + store the grant
//   DELETE /v1/channels/:slug              → disconnect (mappings cascade)
//
// `availability` in the catalog is computed at runtime (NOT the static catalog's
// baseline): a channel is connectable only when its adapter is registered AND its
// platform OAuth credentials + the token-encryption key are configured. So a
// channel lights up the instant ops provisions its approved app, with no code
// change (docs/106 §4.6). OAuth tokens are stored AES-256-GCM encrypted on the
// connection row, never plaintext.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  CHANNEL_CATALOG,
  getChannel,
  getChannelDescriptor,
  type ChannelDescriptor,
  type ChannelSlug,
} from '@wizeworks/channels';
import { registerBuiltinChannels } from '@wizeworks/channels/adapters';
import { encryptChannelToken, isChannelTokenCryptoConfigured } from '@wizeworks/channels/crypto';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { badRequest, conflict, notFound } from '@wizeworks/api-core/errors';
import { requireChannelsModule, toChannelContext } from '../../../lib/channel-context.js';
import { resolvePropertyId } from '../../../lib/property.js';
import {
  disconnectChannel,
  listChannelConnections,
  upsertChannelConnection,
} from '../../../lib/channels.js';
import { signChannelOAuthState, verifyChannelOAuthState } from '../../../lib/channels-oauth.js';
import channelProductMappingRoutes from './product-mappings.js';

const CHANNEL_SLUGS = CHANNEL_CATALOG.map((c) => c.slug) as [ChannelSlug, ...ChannelSlug[]];
const PathSlug = z.object({ slug: z.enum(CHANNEL_SLUGS) });
const ConnectQuery = z.object({ redirect_uri: z.string().url() });
const CallbackBody = z.object({ code: z.string().min(1), state: z.string().min(1) });

/** The catalog with availability resolved against the live registry + env. */
function runtimeCatalog(): ChannelDescriptor[] {
  const cryptoReady = isChannelTokenCryptoConfigured();
  return CHANNEL_CATALOG.map((d) => {
    const adapter = getChannel(d.slug);
    const available = cryptoReady && !!adapter && adapter.isConfigured();
    return { ...d, availability: available ? 'available' : 'coming_soon' };
  });
}

const channelRoutes: FastifyPluginAsync = async (app) => {
  // Register the built-in adapters once when this route module loads (idempotent).
  registerBuiltinChannels();

  // Per-listing routes live in their own file — a connection and a product
  // mapping are different resources with different role gates.
  await app.register(channelProductMappingRoutes);

  app.get('/v1/channels', async (request, reply) => {
    await requireChannelsModule(request);
    requireRole(request, 'viewer');
    const connections = await listChannelConnections(toChannelContext(request));
    return reply.send(ok({ connections, catalog: runtimeCatalog() }));
  });

  app.get('/v1/channels/:slug/connect-url', async (request, reply) => {
    await requireChannelsModule(request);
    const auth = requireRole(request, 'admin');
    const { slug } = PathSlug.parse(request.params);
    const { redirect_uri: redirectUri } = ConnectQuery.parse(request.query);
    const ctx = toChannelContext(request);

    const descriptor = getChannelDescriptor(slug);
    if (!descriptor) throw notFound('channel', slug);

    if (!isChannelTokenCryptoConfigured()) {
      throw conflict('Channel connections are not configured on this deployment yet.', { slug });
    }
    const adapter = getChannel(slug);
    if (!adapter) {
      throw conflict(
        `${descriptor.name} is not available to connect yet — it ships in ${descriptor.phase}.`,
        { slug, phase: descriptor.phase }
      );
    }
    if (!adapter.isConfigured()) {
      throw conflict(`${descriptor.name} is not available to connect yet.`, { slug });
    }

    // Bind the handshake to the site being worked in (docs/131 §4); the callback
    // reads it back from the signed state and attaches the connection there.
    const propertyId = await resolvePropertyId(
      auth,
      request.headers['x-sparx-property-id'] as string | undefined
    );
    const state = await signChannelOAuthState({
      slug,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      propertyId,
      redirectUri,
    });
    const url = adapter.connectUrl({ tenantId: ctx.tenantId, state, redirectUri, scopes: [] });
    return reply.send(ok({ url }));
  });

  app.post('/v1/channels/callback', async (request, reply) => {
    await requireChannelsModule(request);
    requireRole(request, 'admin');
    const { code, state } = CallbackBody.parse(request.body);
    const ctx = toChannelContext(request);

    const decoded = await verifyChannelOAuthState(state);
    // CSRF: the signed state must belong to the authenticated tenant.
    if (decoded.tenantId !== ctx.tenantId) {
      throw badRequest('Channel connect token does not match the authenticated tenant.');
    }
    if (!isChannelTokenCryptoConfigured()) {
      throw conflict('Channel connections are not configured on this deployment.', {
        slug: decoded.slug,
      });
    }
    const adapter = getChannel(decoded.slug);
    if (!adapter) throw conflict('Channel adapter is no longer available.', { slug: decoded.slug });

    const tokens = await adapter.exchangeCode(code, {
      tenantId: ctx.tenantId,
      state,
      redirectUri: decoded.redirectUri,
      scopes: [],
    });

    await upsertChannelConnection(ctx, {
      channel: decoded.slug,
      // The site captured at connect time and carried through the signed state
      // (docs/131 §4) — not re-derived here, where there is no reliable signal.
      propertyId: decoded.propertyId,
      externalId: tokens.externalId ?? null,
      shopName: tokens.shopName ?? null,
      accessTokenEnc: encryptChannelToken(tokens.accessToken),
      refreshTokenEnc: tokens.refreshToken ? encryptChannelToken(tokens.refreshToken) : null,
      tokenExpiresAt: tokens.expiresInSeconds
        ? new Date(Date.now() + tokens.expiresInSeconds * 1000)
        : null,
      scopes: tokens.scope ? tokens.scope.split(/[ ,]+/).filter(Boolean) : [],
      params: tokens.params,
    });

    return reply.send(
      ok({ connected: true, channel: decoded.slug, externalId: tokens.externalId ?? null })
    );
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
