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
import {
  requireSocialModule,
  resolveSocialProperty,
  toSocialContext,
} from '../../../lib/social-context.js';
import { resolvePropertyId } from '../../../lib/property.js';
import {
  checkSocialConnectionReadiness,
  checkSocialReadiness,
  disconnectSocial,
  listSocialConnections,
  setTargetEnabled,
  syncConnectionTargets,
  upsertSocialConnection,
  type SocialTargetView,
} from '../../../lib/social-connections.js';
import { signSocialOAuthState, verifySocialOAuthState } from '../../../lib/social-oauth.js';
import { getSocialSettings, updateSocialSettings } from '../../../lib/social-lifecycle.js';
import { getSocialInsights } from '../../../lib/social-metrics.js';
import socialPostRoutes from './posts.js';
import socialPlanningRoutes from './planning.js';
import socialInboxRoutes from './inbox.js';

const SOCIAL_PLATFORMS = SOCIAL_CATALOG.map((d) => d.platform) as [
  SocialPlatform,
  ...SocialPlatform[],
];
const PathPlatform = z.object({ platform: z.enum(SOCIAL_PLATFORMS) });
const ConnectQuery = z.object({ redirect_uri: z.string().url() });
const CallbackBody = z.object({ code: z.string().min(1), state: z.string().min(1) });
const TargetToggleBody = z.object({ enabled: z.boolean() });
const PathId = z.object({ id: z.string().uuid() });
const SettingsBody = z.object({
  requireApproval: z.boolean().optional(),
  trackLinks: z.boolean().optional(),
});
const InsightsQuery = z.object({
  windowDays: z.coerce.number().int().min(1).max(365).optional(),
});

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
  // The things set up once and leaned on weekly (hashtag sets, the posting cadence,
  // best-time), and the inbound conversation half. Each is a distinct resource with its
  // own lifecycle — same reasoning that split posts out of connections.
  await app.register(socialPlanningRoutes);
  await app.register(socialInboxRoutes);

  app.get('/v1/social', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'viewer');
    const ctx = toSocialContext(request);
    // Scoped to the site being worked in: a connected account speaks for ONE business,
    // so two brands under one owner must not see each other's accounts in one list.
    const propertyId = await resolveSocialProperty(request);
    const [connections, settings] = await Promise.all([
      listSocialConnections(ctx, propertyId),
      getSocialSettings(ctx.tenantId),
    ]);
    return reply.send(ok({ connections, catalog: runtimeCatalog(), settings }));
  });

  // "Can these accounts actually do what we're about to ask?" — the granted-vs-required
  // permission diff, plus whatever the platform will admit about its own approval of
  // sparx's app. Separate from the connection list because it makes a live call PER
  // account: the list must stay fast, and this is the thing a person opens when a post
  // failed or when they're waiting on a platform review to land.
  app.get('/v1/social/readiness', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'admin');
    const propertyId = await resolveSocialProperty(request);
    const connections = await checkSocialReadiness(toSocialContext(request), propertyId);
    return reply.send(ok({ connections }));
  });

  app.get('/v1/social/readiness/:id', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'admin');
    const { id } = PathId.parse(request.params);
    const readiness = await checkSocialConnectionReadiness(toSocialContext(request), id);
    if (!readiness) throw notFound('connection', id);
    return reply.send(ok(readiness));
  });

  // Performance rollup over a window — per-account totals + best posts (docs/
  // implementation/social.md "Measure"). The post-scoped detail lives under
  // /v1/social/posts/:id/metrics.
  app.get('/v1/social/insights', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'viewer');
    const { windowDays } = InsightsQuery.parse(request.query);
    const insights = await getSocialInsights(toSocialContext(request), windowDays ?? 30);
    return reply.send(ok(insights));
  });

  // The module's two tenant-wide settings — the require-approval default (docs/133
  // §15.3) and whether outbound links are tagged for attribution. Admin-only: one governs
  // what reaches the brand's live accounts, the other what a customer sees in a URL.
  app.patch('/v1/social/settings', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'admin');
    const patch = SettingsBody.parse(request.body);
    const settings = await updateSocialSettings(toSocialContext(request).tenantId, patch);
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
