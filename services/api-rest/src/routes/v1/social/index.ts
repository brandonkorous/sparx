// Social posting API (docs/133). The dashboard's Social surface: list the tenant's
// connected accounts + the available platform catalog, begin an OAuth connect,
// complete the callback (storing the grant + discovering its post targets), toggle a
// target, and disconnect. Gated on the free `social` module.
//
//   GET    /v1/social                       → { connections, catalog }
//   GET    /v1/social/:platform/connect-url → { url } — signed-state OAuth authorize
//   POST   /v1/social/callback              → { connected, targets } — exchange code,
//                                             encrypt + store the grant, sync targets
//   PATCH  /v1/social/targets/:id           → { enabled } — toggle a publish target
//   DELETE /v1/social/:platform             → disconnect (targets cascade)
//
// `availability` in the catalog is computed at runtime: a platform is connectable only
// when its adapter is registered AND its platform OAuth app + the token-encryption key
// are configured — so a platform lights up the instant ops provisions its approved
// app, with no code change. OAuth tokens are stored AES-256-GCM encrypted, never
// plaintext.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  SOCIAL_CATALOG,
  constraintsFor,
  getSocialAdapter,
  getSocialDescriptor,
  type PlatformConstraints,
  type SocialAuth,
  type SocialPlatform,
  type SocialPlatformDescriptor,
} from '@sparx/social';
import { registerBuiltinSocialAdapters } from '@sparx/social/adapters';
import { encryptSocialToken, isSocialTokenCryptoConfigured } from '@sparx/social/crypto';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { badRequest, conflict, notFound } from '@sparx/api-core/errors';
import { requireSocialModule, toSocialContext } from '../../../lib/social-context.js';
import { resolvePropertyId } from '../../../lib/property.js';
import {
  disconnectSocial,
  listSocialConnections,
  setTargetEnabled,
  syncConnectionTargets,
  upsertSocialConnection,
  type SocialTargetView,
} from '../../../lib/social-connections.js';
import { signSocialOAuthState, verifySocialOAuthState } from '../../../lib/social-oauth.js';
import { getSocialSettings, setSocialRequireApproval } from '../../../lib/social-lifecycle.js';
import socialPostRoutes from './posts.js';

const SOCIAL_PLATFORMS = SOCIAL_CATALOG.map((d) => d.platform) as [
  SocialPlatform,
  ...SocialPlatform[],
];
const PathPlatform = z.object({ platform: z.enum(SOCIAL_PLATFORMS) });
const ConnectQuery = z.object({ redirect_uri: z.string().url() });
const CallbackBody = z.object({ code: z.string().min(1), state: z.string().min(1) });
const TargetToggleBody = z.object({ enabled: z.boolean() });
const PathId = z.object({ id: z.string().uuid() });
const SettingsBody = z.object({ requireApproval: z.boolean() });

type RuntimeDescriptor = SocialPlatformDescriptor & {
  availability: 'available' | 'coming_soon';
  // The platform's posting limits, shipped with the catalog so the composer can run
  // its author-time preview/validation (length, media-required, aspect ratios) from
  // the ONE source of truth without importing the @sparx/social renderer client-side.
  constraints: PlatformConstraints;
};

/** The catalog with availability resolved against the live registry + env. */
function runtimeCatalog(): RuntimeDescriptor[] {
  const cryptoReady = isSocialTokenCryptoConfigured();
  return SOCIAL_CATALOG.map((d) => {
    const adapter = getSocialAdapter(d.platform);
    const available = cryptoReady && !!adapter && adapter.isConfigured();
    return {
      ...d,
      availability: available ? 'available' : 'coming_soon',
      constraints: constraintsFor(d.platform),
    };
  });
}

const socialRoutes: FastifyPluginAsync = async (app) => {
  // Register the built-in adapters once when this route module loads (idempotent).
  registerBuiltinSocialAdapters();

  // Post compose/publish lives in its own sub-plugin (a connection and a post are
  // different resources with different lifecycles) — mirrors channels/product-mappings.
  await app.register(socialPostRoutes);

  app.get('/v1/social', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'viewer');
    const ctx = toSocialContext(request);
    const [connections, settings] = await Promise.all([
      listSocialConnections(ctx),
      getSocialSettings(ctx.tenantId),
    ]);
    return reply.send(ok({ connections, catalog: runtimeCatalog(), settings }));
  });

  // The require-approval default (docs/133 §15.3) — who-may-publish is itself a
  // controlled setting; admin-only, since it governs the brand's live accounts.
  app.patch('/v1/social/settings', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'admin');
    const { requireApproval } = SettingsBody.parse(request.body);
    const settings = await setSocialRequireApproval(
      toSocialContext(request).tenantId,
      requireApproval
    );
    return reply.send(ok({ settings }));
  });

  app.get('/v1/social/:platform/connect-url', async (request, reply) => {
    await requireSocialModule(request);
    const auth = requireRole(request, 'admin');
    const { platform } = PathPlatform.parse(request.params);
    const { redirect_uri: redirectUri } = ConnectQuery.parse(request.query);
    const ctx = toSocialContext(request);

    const descriptor = getSocialDescriptor(platform);
    if (!descriptor) throw notFound('platform', platform);

    if (!isSocialTokenCryptoConfigured()) {
      throw conflict('Social connections are not configured on this deployment yet.', { platform });
    }
    const adapter = getSocialAdapter(platform);
    if (!adapter) {
      throw conflict(
        `${descriptor.name} is not available to connect yet — it ships in ${descriptor.phase}.`,
        { platform, phase: descriptor.phase }
      );
    }
    if (!adapter.isConfigured()) {
      throw conflict(`${descriptor.name} is not available to connect yet.`, { platform });
    }

    // Bind the handshake to the site being worked in (docs/133 §5); the callback reads
    // it back from the signed state and attaches the connection there.
    const propertyId = await resolvePropertyId(
      auth,
      request.headers['x-sparx-property-id'] as string | undefined
    );
    const state = await signSocialOAuthState({
      platform,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      propertyId,
      redirectUri,
    });
    const url = adapter.connectUrl({ tenantId: ctx.tenantId, state, redirectUri, scopes: [] });
    return reply.send(ok({ url }));
  });

  app.post('/v1/social/callback', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'admin');
    const { code, state } = CallbackBody.parse(request.body);
    const ctx = toSocialContext(request);

    const decoded = await verifySocialOAuthState(state);
    // CSRF: the signed state must belong to the authenticated tenant.
    if (decoded.tenantId !== ctx.tenantId) {
      throw badRequest('Social connect token does not match the authenticated tenant.');
    }
    if (!isSocialTokenCryptoConfigured()) {
      throw conflict('Social connections are not configured on this deployment.', {
        platform: decoded.platform,
      });
    }
    const adapter = getSocialAdapter(decoded.platform);
    if (!adapter) {
      throw conflict('Social adapter is no longer available.', { platform: decoded.platform });
    }

    const tokens = await adapter.exchangeCode(code, {
      tenantId: ctx.tenantId,
      state,
      redirectUri: decoded.redirectUri,
      scopes: [],
    });

    const connectionId = await upsertSocialConnection(ctx, {
      platform: decoded.platform,
      // The site captured at connect time and carried through the signed state.
      propertyId: decoded.propertyId,
      externalId: tokens.externalId ?? null,
      displayName: tokens.displayName ?? null,
      avatarUrl: tokens.avatarUrl ?? null,
      accessTokenEnc: encryptSocialToken(tokens.accessToken),
      refreshTokenEnc: tokens.refreshToken ? encryptSocialToken(tokens.refreshToken) : null,
      tokenExpiresAt: tokens.expiresInSeconds
        ? new Date(Date.now() + tokens.expiresInSeconds * 1000)
        : null,
      scopes: tokens.scope ? tokens.scope.split(/[ ,]+/).filter(Boolean) : [],
      params: tokens.params,
    });

    // Discover the grant's post targets and persist them. A failure here does NOT
    // discard the (valuable) grant — the connection stays, targets come back empty,
    // and the UI offers a retry.
    const auth: SocialAuth = {
      externalId: tokens.externalId ?? '',
      accessToken: tokens.accessToken,
      params: tokens.params,
    };
    let targets: SocialTargetView[];
    try {
      const discovered = await adapter.listTargets(auth);
      targets = await syncConnectionTargets(ctx, connectionId, decoded.platform, discovered);
    } catch {
      targets = [];
    }

    return reply.send(
      ok({
        connected: true,
        platform: decoded.platform,
        externalId: tokens.externalId ?? null,
        targets,
      })
    );
  });

  app.patch('/v1/social/targets/:id', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'admin');
    const { id } = PathId.parse(request.params);
    const { enabled } = TargetToggleBody.parse(request.body);
    const updated = await setTargetEnabled(toSocialContext(request), id, enabled);
    if (!updated) throw notFound('target', id);
    return reply.send(ok({ id, enabled }));
  });

  app.delete('/v1/social/:platform', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'admin');
    const { platform } = PathPlatform.parse(request.params);
    await disconnectSocial(toSocialContext(request), platform);
    return reply.status(204).send();
  });
};

export default socialRoutes;
