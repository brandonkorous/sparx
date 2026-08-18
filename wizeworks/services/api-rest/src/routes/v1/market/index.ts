// sparx.market dashboard API (docs/106 §4.7, docs/72). The AUTHENTICATED merchant
// surface for managing a tenant's first-party marketplace participation: the
// public merchant profile + participation toggle, the ACH payout bank account,
// per-product (and bulk) opt-in into the catalog, and read-only settlement figures.
//
//   GET    /v1/market/profile             → the merchant's market profile (stub when absent)
//   PUT    /v1/market/profile             → upsert profile + participation toggle
//   GET    /v1/market/payout-account      → masked ACH payout account (may be null)
//   PUT    /v1/market/payout-account      → capture / replace the ACH payout account
//   GET    /v1/market/products            → the tenant's currently-listed products
//   PUT    /v1/market/products/:productId → list / un-list one product (+ category)
//   POST   /v1/market/products/bulk       → bulk list / un-list from a selection
//   GET    /v1/market/settlement/summary  → aggregate settlement figures
//   GET    /v1/market/settlement/runs     → the settlement-run history
//
// sparx.market is part of the Commerce module (no separate fee — docs/106 §8), so
// every route is gated on `commerce` via the SAME helper the channels surface uses
// (`requireChannelsModule` + `toChannelContext` from lib/channel-context). Two
// fields are deliberately NOT settable by a tenant through this surface — they are
// sparx-curated / platform-admin only — and the route pins them off:
//   • `commissionBpsOverride` → `updateMerchantProfile(..., { allowCommissionOverride: false })`
//   • product `featured`      → `setProductOptIn(..., { allowFeatured: false })`

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { marketService } from '@wizeworks/commerce';
import {
  MarketBulkOptInInput,
  MarketMerchantProfileInput,
  MarketPayoutAccountInput,
  MarketProductOptInInput,
} from '@wizeworks/commerce-schemas';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';

import { requireChannelsModule, toChannelContext } from '../../../lib/channel-context.js';

const ProductIdParam = z.object({ productId: z.string().uuid() });

const ProductListQuery = z.object({
  take: z.coerce.number().int().min(1).max(200).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const SettlementRunsQuery = z.object({
  take: z.coerce.number().int().min(1).max(100).optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const marketRoutes: FastifyPluginAsync = async (app) => {
  // ── Merchant profile / participation ──────────────────────────────────────────

  app.get('/v1/market/profile', async (request, reply) => {
    await requireChannelsModule(request);
    requireRole(request, 'viewer');
    const profile = await marketService.getMerchantProfile(toChannelContext(request));
    return reply.send(ok(profile));
  });

  app.put('/v1/market/profile', async (request, reply) => {
    await requireChannelsModule(request);
    requireRole(request, 'admin');
    const body = MarketMerchantProfileInput.parse(request.body);
    // The commission override is platform-admin only — a tenant may never set it
    // through this surface, so the override is pinned off here.
    const profile = await marketService.updateMerchantProfile(toChannelContext(request), body, {
      allowCommissionOverride: false,
    });
    return reply.send(ok(profile));
  });

  // ── Payout account (masked; numbers are encrypted server-side) ────────────────

  app.get('/v1/market/payout-account', async (request, reply) => {
    await requireChannelsModule(request);
    requireRole(request, 'viewer');
    const account = await marketService.getPayoutAccount(toChannelContext(request));
    return reply.send(ok(account));
  });

  app.put('/v1/market/payout-account', async (request, reply) => {
    await requireChannelsModule(request);
    requireRole(request, 'admin');
    const body = MarketPayoutAccountInput.parse(request.body);
    const account = await marketService.upsertPayoutAccount(toChannelContext(request), body);
    return reply.send(ok(account));
  });

  // ── Product opt-in ────────────────────────────────────────────────────────────

  app.get('/v1/market/products', async (request, reply) => {
    await requireChannelsModule(request);
    requireRole(request, 'viewer');
    const { take, skip } = ProductListQuery.parse(request.query);
    const products = await marketService.listOptedInProducts(toChannelContext(request), {
      take,
      skip,
    });
    return reply.send(ok(products));
  });

  app.put('/v1/market/products/:productId', async (request, reply) => {
    await requireChannelsModule(request);
    requireRole(request, 'admin');
    const { productId } = ProductIdParam.parse(request.params);
    const body = MarketProductOptInInput.parse(request.body);
    // `featured` is sparx-curated placement (admin-only) — never settable here.
    const state = await marketService.setProductOptIn(toChannelContext(request), productId, body, {
      allowFeatured: false,
    });
    return reply.send(ok(state));
  });

  app.post('/v1/market/products/bulk', async (request, reply) => {
    await requireChannelsModule(request);
    requireRole(request, 'admin');
    const body = MarketBulkOptInInput.parse(request.body);
    const result = await marketService.bulkSetProductOptIn(toChannelContext(request), body);
    return reply.send(ok(result));
  });

  // ── Settlement (read-only) ────────────────────────────────────────────────────

  app.get('/v1/market/settlement/summary', async (request, reply) => {
    await requireChannelsModule(request);
    requireRole(request, 'viewer');
    const summary = await marketService.getSettlementSummary(toChannelContext(request));
    return reply.send(ok(summary));
  });

  app.get('/v1/market/settlement/runs', async (request, reply) => {
    await requireChannelsModule(request);
    requireRole(request, 'viewer');
    const { take } = SettlementRunsQuery.parse(request.query);
    const runs = await marketService.listSettlementRuns(toChannelContext(request), { take });
    return reply.send(ok(runs));
  });
};

export default marketRoutes;
