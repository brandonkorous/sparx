// B2B accounts — B2B-module-enriched view of the CRM's b2b_accounts spine
// (pricing-tier assignment, account-level product overrides, fleet management, and
// the credit/status data). Thin transport over @sparx/b2b's accountService.
//
//   GET    /v1/b2b/accounts                          → list (with tier/credit info)
//   GET    /v1/b2b/accounts/:id                      → fetch one (enriched)
//   PATCH  /v1/b2b/accounts/:id                      → update trade config
//   PUT    /v1/b2b/accounts/:id/fleet                  → replace fleet vehicle array
//   GET    /v1/b2b/accounts/:id/compatible-products   → products compatible with fleet
//   GET    /v1/b2b/accounts/:id/overrides             → list per-account overrides
//   POST   /v1/b2b/accounts/:id/overrides             → add override
//   PATCH  /v1/b2b/accounts/:id/overrides/:oid        → update override
//   DELETE /v1/b2b/accounts/:id/overrides/:oid        → remove override

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { accountService } from '@sparx/b2b';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireB2bModule, toB2bContext } from '../../../lib/b2b-context.js';

const PathId = z.object({ id: z.string().uuid() });
const PathIdOid = z.object({ id: z.string().uuid(), oid: z.string().uuid() });

const b2bAccountRoutes: FastifyPluginAsync = (app) => {
  // ─── List ─────────────────────────────────────────────────────────────────

  app.get('/v1/b2b/accounts', async (request) => {
    requireRole(request, 'viewer');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { items, total, take } = await accountService.listAccounts(
      ctx,
      accountService.AccountListQuery.parse(request.query)
    );
    return paged(items, { total, per_page: take });
  });

  // ─── Get one (enriched) ─────────────────────────────────────────────────────

  app.get('/v1/b2b/accounts/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);
    return ok(await accountService.getAccount(ctx, id));
  });

  // ─── Patch (B2B trade config) ─────────────────────────────────────────────

  app.patch('/v1/b2b/accounts/:id', async (request) => {
    requireRole(request, 'editor');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);
    return ok(await accountService.updateTradeConfig(ctx, id, request.body));
  });

  // ─── Fleet vehicles ──────────────────────────────────────────────────────

  app.put('/v1/b2b/accounts/:id/fleet', async (request) => {
    requireRole(request, 'editor');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);
    return ok(await accountService.setFleet(ctx, id, request.body));
  });

  // ─── Compatible products (fleet-filtered catalog) ─────────────────────────

  app.get('/v1/b2b/accounts/:id/compatible-products', async (request) => {
    requireRole(request, 'viewer');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);
    const q = accountService.CompatibleProductsQuery.parse(request.query);
    return ok(await accountService.listCompatibleProducts(ctx, id, q));
  });

  // ─── Account-level product overrides ─────────────────────────────────────

  app.get('/v1/b2b/accounts/:id/overrides', async (request) => {
    requireRole(request, 'viewer');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id: accountId } = PathId.parse(request.params);
    return ok(await accountService.listAccountOverrides(ctx, accountId));
  });

  app.post('/v1/b2b/accounts/:id/overrides', async (request, reply) => {
    requireRole(request, 'editor');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id: accountId } = PathId.parse(request.params);
    const override = await accountService.addAccountOverride(ctx, accountId, request.body);
    reply.code(201);
    return ok(override);
  });

  app.patch('/v1/b2b/accounts/:id/overrides/:oid', async (request) => {
    requireRole(request, 'editor');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id: accountId, oid } = PathIdOid.parse(request.params);
    return ok(await accountService.updateAccountOverride(ctx, accountId, oid, request.body));
  });

  app.delete('/v1/b2b/accounts/:id/overrides/:oid', async (request, reply) => {
    requireRole(request, 'editor');
    await requireB2bModule(request);
    const ctx = toB2bContext(request);
    const { id: accountId, oid } = PathIdOid.parse(request.params);
    await accountService.removeAccountOverride(ctx, accountId, oid);
    reply.code(204);
  });

  return Promise.resolve();
};

export default b2bAccountRoutes;
