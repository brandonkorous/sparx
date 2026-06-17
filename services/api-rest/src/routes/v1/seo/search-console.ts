// SEO — Google Search Console connection lifecycle (docs/50 §7, docs/97 §4).
//
//   GET    /v1/seo/search-console/status        → { configured, connection }
//   GET    /v1/seo/search-console/connect-url    → { url } (admin) — Google consent
//   POST   /v1/seo/search-console/exchange       → store grant, list sites (admin)
//   GET    /v1/seo/search-console/sites          → the grant's verified sites (admin)
//   POST   /v1/seo/search-console/select-site     → choose a site + initial sync (admin)
//   POST   /v1/seo/search-console/sync           → re-ingest now (editor)
//   DELETE /v1/seo/search-console                → disconnect (admin)
//
// Per-(tenant, property): the connection belongs to the active web property (the
// site switcher's x-sparx-property-id). The OAuth round-trip carries a signed
// `state` (lib/search-console/state.ts) so the dashboard-hosted callback can post
// the code back here authenticated — the same shape as Stripe Connect. The whole
// surface is inert until the platform sets the Google OAuth client + token key.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant } from '@sparx/db';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { badRequest } from '@sparx/api-core/errors';

import { toSeoContext } from '../../../lib/seo-context.js';
import {
  buildAuthUrl,
  exchangeCode,
  isSearchConsoleConfigured,
  listSites,
} from '../../../lib/search-console/google.js';
import { encryptToken } from '../../../lib/search-console/crypto.js';
import { signOAuthState, verifyOAuthState } from '../../../lib/search-console/state.js';
import { ensureAccessToken, syncConnection } from '../../../lib/search-console/sync.js';

const SYNC_SELECT = {
  id: true,
  tenantId: true,
  propertyId: true,
  siteUrl: true,
  accessTokenEnc: true,
  refreshTokenEnc: true,
  tokenExpiresAt: true,
} as const;

interface ConnectionView {
  status: string;
  siteUrl: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
}

function view(
  c: {
    status: string;
    siteUrl: string | null;
    lastSyncAt: Date | null;
    lastError: string | null;
  } | null
): ConnectionView | null {
  if (!c) return null;
  return {
    status: c.status,
    siteUrl: c.siteUrl,
    lastSyncAt: c.lastSyncAt ? c.lastSyncAt.toISOString() : null,
    lastError: c.lastError,
  };
}

const ConnectUrlQuery = z.object({ redirect_uri: z.string().url() });
const ExchangeBody = z.object({ code: z.string().min(1), state: z.string().min(1) });
const SelectSiteBody = z.object({ siteUrl: z.string().min(1).max(2048) });

const searchConsoleRoutes: FastifyPluginAsync = (app) => {
  // ── Status (read) ──
  app.get('/v1/seo/search-console/status', async (request) => {
    requireRole(request, 'viewer');
    const { tenantId, propertyId } = await toSeoContext(request);
    const conn = await withTenant({ tenantId }, (tx) =>
      tx.searchConsoleConnection.findUnique({
        where: { tenantId_propertyId: { tenantId, propertyId } },
        select: { status: true, siteUrl: true, lastSyncAt: true, lastError: true },
      })
    );
    return ok({ configured: isSearchConsoleConfigured(), connection: view(conn) });
  });

  // ── Build the Google consent URL ──
  app.get('/v1/seo/search-console/connect-url', async (request) => {
    requireRole(request, 'admin');
    if (!isSearchConsoleConfigured()) {
      throw badRequest('Google Search Console is not configured on this platform.');
    }
    const { redirect_uri } = ConnectUrlQuery.parse(request.query);
    const { tenantId, userId, propertyId } = await toSeoContext(request);
    const state = await signOAuthState({ tenantId, userId, propertyId, redirectUri: redirect_uri });
    return ok({ url: buildAuthUrl({ redirectUri: redirect_uri, state }) });
  });

  // ── Exchange the code → store the grant, list the grant's sites ──
  app.post('/v1/seo/search-console/exchange', async (request) => {
    const auth = requireRole(request, 'admin');
    const { code, state } = ExchangeBody.parse(request.body);
    const decoded = await verifyOAuthState(state);
    if (decoded.tenantId !== auth.tenantId) {
      throw badRequest('Connect token does not match the current tenant.');
    }

    const tokens = await exchangeCode({ code, redirectUri: decoded.redirectUri });
    const refreshToken = tokens.refreshToken ?? '';
    if (!refreshToken) {
      throw badRequest(
        'Google did not return a refresh token — remove sparx from your Google account permissions and reconnect.'
      );
    }
    const sites = await listSites(tokens.accessToken);
    // Exactly one verified site → connect it straight away (the common case);
    // otherwise leave it in needs_site and let the merchant pick.
    const sole = sites.length === 1 ? (sites[0]?.siteUrl ?? null) : null;

    const result = await withTenant({ tenantId: auth.tenantId }, async (tx) => {
      const conn = await tx.searchConsoleConnection.upsert({
        where: {
          tenantId_propertyId: { tenantId: auth.tenantId, propertyId: decoded.propertyId },
        },
        create: {
          tenantId: auth.tenantId,
          propertyId: decoded.propertyId,
          status: sole ? 'connected' : 'needs_site',
          siteUrl: sole,
          accessTokenEnc: encryptToken(tokens.accessToken),
          refreshTokenEnc: encryptToken(refreshToken),
          tokenExpiresAt: tokens.expiresAt,
          connectedByUserId: decoded.userId,
        },
        update: {
          status: sole ? 'connected' : 'needs_site',
          siteUrl: sole,
          accessTokenEnc: encryptToken(tokens.accessToken),
          refreshTokenEnc: encryptToken(refreshToken),
          tokenExpiresAt: tokens.expiresAt,
          connectedByUserId: decoded.userId,
          lastError: null,
        },
        select: { ...SYNC_SELECT, status: true, lastSyncAt: true, lastError: true },
      });
      if (sole) await syncConnection(tx, conn);
      return tx.searchConsoleConnection.findUnique({
        where: { id: conn.id },
        select: { status: true, siteUrl: true, lastSyncAt: true, lastError: true },
      });
    });

    return ok({ connection: view(result), sites });
  });

  // ── List the grant's verified sites (for the picker) ──
  app.get('/v1/seo/search-console/sites', async (request) => {
    requireRole(request, 'admin');
    const { tenantId, propertyId } = await toSeoContext(request);
    const sites = await withTenant({ tenantId }, async (tx) => {
      const conn = await tx.searchConsoleConnection.findUnique({
        where: { tenantId_propertyId: { tenantId, propertyId } },
        select: SYNC_SELECT,
      });
      if (!conn || (!conn.accessTokenEnc && !conn.refreshTokenEnc)) {
        throw badRequest('Search Console is not connected for this site.');
      }
      return listSites(await ensureAccessToken(tx, conn));
    });
    return ok({ sites });
  });

  // ── Choose a site → connect + initial sync ──
  app.post('/v1/seo/search-console/select-site', async (request) => {
    requireRole(request, 'admin');
    const { siteUrl } = SelectSiteBody.parse(request.body);
    const { tenantId, propertyId } = await toSeoContext(request);
    const result = await withTenant({ tenantId }, async (tx) => {
      const conn = await tx.searchConsoleConnection.findUnique({
        where: { tenantId_propertyId: { tenantId, propertyId } },
        select: SYNC_SELECT,
      });
      if (!conn) throw badRequest('Search Console is not connected for this site.');
      await tx.searchConsoleConnection.update({
        where: { id: conn.id },
        data: { siteUrl, status: 'connected', lastError: null },
      });
      await syncConnection(tx, { ...conn, siteUrl });
      return tx.searchConsoleConnection.findUnique({
        where: { id: conn.id },
        select: { status: true, siteUrl: true, lastSyncAt: true, lastError: true },
      });
    });
    return ok({ connection: view(result) });
  });

  // ── Re-ingest now ──
  app.post('/v1/seo/search-console/sync', async (request) => {
    requireRole(request, 'editor');
    const { tenantId, propertyId } = await toSeoContext(request);
    const result = await withTenant({ tenantId }, async (tx) => {
      const conn = await tx.searchConsoleConnection.findUnique({
        where: { tenantId_propertyId: { tenantId, propertyId } },
        select: SYNC_SELECT,
      });
      if (!conn?.siteUrl) throw badRequest('Connect a Search Console site before syncing.');
      const sync = await syncConnection(tx, conn);
      const fresh = await tx.searchConsoleConnection.findUnique({
        where: { id: conn.id },
        select: { status: true, siteUrl: true, lastSyncAt: true, lastError: true },
      });
      return { sync, connection: view(fresh) };
    });
    return ok(result);
  });

  // ── Disconnect ──
  app.delete('/v1/seo/search-console', async (request) => {
    requireRole(request, 'admin');
    const { tenantId, propertyId } = await toSeoContext(request);
    await withTenant({ tenantId }, (tx) =>
      tx.searchConsoleConnection.updateMany({
        where: { tenantId, propertyId },
        data: {
          status: 'disconnected',
          siteUrl: null,
          accessTokenEnc: null,
          refreshTokenEnc: null,
          tokenExpiresAt: null,
        },
      })
    );
    return ok({ disconnected: true });
  });

  return Promise.resolve();
};

export default searchConsoleRoutes;
