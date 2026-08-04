// Commerce — providers (payments, shipping, tax, fulfillment integrations) +
// returns + subscriptions.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  paymentMethodService,
  providerService,
  returnService,
  subscriptionService,
} from '@sparx/commerce';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireCommerceModule, toCommerceContext } from '../../../lib/commerce-context.js';

const PathId = z.object({ id: z.string().uuid() });
const SlugParam = z.object({ slug: z.string().min(1).max(128) });

const ListReturnsQuery = z.object({
  status: z.string().optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const ListSubscriptionsQuery = z.object({
  status: z.string().optional(),
  customer_id: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; no top-level await needed because route registration is sync.
const providerRoutes: FastifyPluginAsync = async (app) => {
  // Provider catalog + installations
  app.get('/v1/commerce/providers/available', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const q = request.query as Record<string, string | undefined>;
    return ok(
      await providerService.listAvailable({
        ...(q?.kind ? { kind: q.kind as never } : {}),
      })
    );
  });

  app.get('/v1/commerce/providers/installations', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    return ok(await providerService.listInstallations(toCommerceContext(request)));
  });

  app.get('/v1/commerce/providers/installations/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await providerService.getInstallation(toCommerceContext(request), id));
  });

  app.get('/v1/commerce/providers/metadata/:slug', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const { slug } = SlugParam.parse(request.params);
    return ok(await providerService.getMetadata(slug));
  });

  app.post('/v1/commerce/providers/install', async (request, reply) => {
    requireRole(request, 'admin');
    await requireCommerceModule(request);
    const created = await providerService.install(toCommerceContext(request), request.body);
    reply.code(201);
    return ok(created);
  });

  app.delete('/v1/commerce/providers/installations/:id', async (request, reply) => {
    requireRole(request, 'admin');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    await providerService.uninstall(toCommerceContext(request), id);
    reply.code(204);
  });

  app.patch('/v1/commerce/providers/installations/:id/config', async (request) => {
    requireRole(request, 'admin');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    const body = (request.body as Record<string, unknown>) ?? {};
    await providerService.updateConfig(toCommerceContext(request), { ...body, installationId: id });
    return ok({ id, updated: true });
  });

  app.post('/v1/commerce/providers/installations/:id/enabled', async (request) => {
    requireRole(request, 'admin');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    const body = (request.body as Record<string, unknown>) ?? {};
    await providerService.setEnabled(toCommerceContext(request), { ...body, installationId: id });
    return ok({ id, updated: true });
  });

  app.post('/v1/commerce/providers/installations/:id/test', async (request) => {
    requireRole(request, 'admin');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await providerService.test(toCommerceContext(request), { installationId: id }));
  });

  // Returns
  app.get('/v1/commerce/returns', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const q = ListReturnsQuery.parse(request.query);
    const { items, total } = await returnService.list(toCommerceContext(request), {
      status: q.status as never,
      take: q.take,
      skip: q.skip,
    });
    return paged(items, { total, per_page: q.take ?? 50 });
  });

  app.get('/v1/commerce/returns/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await returnService.get(toCommerceContext(request), id));
  });

  app.post('/v1/commerce/returns/:id/approve', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    const body = (request.body as Record<string, unknown>) ?? {};
    await returnService.approve(toCommerceContext(request), { ...body, returnId: id });
    return ok({ id, approved: true });
  });

  app.post('/v1/commerce/returns/:id/deny', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    const body = (request.body as Record<string, unknown>) ?? {};
    await returnService.deny(toCommerceContext(request), { ...body, returnId: id });
    return ok({ id, denied: true });
  });

  app.post('/v1/commerce/returns/:id/received', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    await returnService.markReceived(toCommerceContext(request), id);
    return ok({ id, received: true });
  });

  app.post('/v1/commerce/returns/:id/inspection', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    const body = (request.body as Record<string, unknown>) ?? {};
    await returnService.recordInspection(toCommerceContext(request), { ...body, returnId: id });
    return ok({ id, inspected: true });
  });

  app.post('/v1/commerce/returns/:id/refund', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    const body = (request.body as Record<string, unknown>) ?? {};
    return ok(
      await returnService.issueRefund(toCommerceContext(request), { ...body, returnId: id })
    );
  });

  // Subscriptions
  app.get('/v1/commerce/subscriptions', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const q = ListSubscriptionsQuery.parse(request.query);
    const { items, total } = await subscriptionService.list(toCommerceContext(request), {
      status: q.status as never,
      ...(q.customer_id ? { customerId: q.customer_id } : {}),
      take: q.take,
      skip: q.skip,
    });
    return paged(items, { total, per_page: q.take ?? 50 });
  });

  app.get('/v1/commerce/subscriptions/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await subscriptionService.get(toCommerceContext(request), id));
  });

  app.post('/v1/commerce/subscriptions/:id/pause', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    const body = (request.body as Record<string, unknown>) ?? {};
    await subscriptionService.pause(toCommerceContext(request), { ...body, subscriptionId: id });
    return ok({ id, paused: true });
  });

  app.post('/v1/commerce/subscriptions/:id/resume', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    const body = (request.body as Record<string, unknown>) ?? {};
    await subscriptionService.resume(toCommerceContext(request), { ...body, subscriptionId: id });
    return ok({ id, resumed: true });
  });

  app.post('/v1/commerce/subscriptions/:id/skip-next', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    const body = (request.body as Record<string, unknown>) ?? {};
    await subscriptionService.skipNextOccurrence(toCommerceContext(request), {
      ...body,
      subscriptionId: id,
    });
    return ok({ id, skipped: true });
  });

  app.post('/v1/commerce/subscriptions/:id/cancel', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    const body = (request.body as Record<string, unknown>) ?? {};
    await subscriptionService.cancel(toCommerceContext(request), { ...body, subscriptionId: id });
    return ok({ id, cancelled: true });
  });

  // A customer's saved cards, operator-side. Feeds the "use a different card"
  // picker on a repeat order — without it an operator can see that a card is
  // expired but has nothing to switch it to.
  app.get('/v1/commerce/customers/:id/payment-methods', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    const methods = await paymentMethodService.list(toCommerceContext(request), id);
    return ok({ methods });
  });

  // Repoint a repeat order at a different saved card, or switch it to invoicing
  // (docs/142). The operator-side fix for an expired card — the alternative is
  // cancelling a paying customer and re-selling them.
  app.post('/v1/commerce/subscriptions/:id/payment-method', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    const body = (request.body as Record<string, unknown>) ?? {};
    await subscriptionService.changePaymentMethod(toCommerceContext(request), {
      ...body,
      subscriptionId: id,
    });
    return ok({ id, updated: true });
  });
};

export default providerRoutes;
