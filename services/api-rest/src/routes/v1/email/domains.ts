// Email sending domains — provision in Mailgun, show DNS records, verify.
//
//   GET    /v1/email/domains              → list
//   POST   /v1/email/domains              → provision (Mailgun POST /v4/domains)
//   GET    /v1/email/domains/:id          → fetch one (incl. dns_records)
//   POST   /v1/email/domains/:id/verify   → re-check DNS, flip state
//   POST   /v1/email/domains/:id/default  → make default sender FOR THIS SITE
//   DELETE /v1/email/domains/:id          → remove

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { domainService } from '@sparx/email-platform';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { publish } from '@sparx/api-core/pubsub';
import { prisma } from '@sparx/db';
import { appOrigin } from '@sparx/links/server';
import { requireEmailModule, toEmailContext } from '../../../lib/email-context.js';
import { resolvePropertyId } from '../../../lib/property.js';

const PathId = z.object({ id: z.string().uuid() });

const ListDomainsQuery = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const emailDomainRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/email/domains', async (request) => {
    requireRole(request, 'viewer');
    await requireEmailModule(request);
    const q = ListDomainsQuery.parse(request.query);
    const { items, total } = await domainService.list(toEmailContext(request), {
      q: q.q,
      take: q.take,
      skip: q.skip,
    });
    return paged(items, { total, per_page: q.take ?? 50 });
  });

  app.get('/v1/email/domains/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireEmailModule(request);
    const { id } = PathId.parse(request.params);
    const domain = await domainService.get(toEmailContext(request), id);
    return ok(domain);
  });

  app.post('/v1/email/domains', async (request, reply) => {
    requireRole(request, 'admin');
    await requireEmailModule(request);
    const domain = await domainService.create(toEmailContext(request), request.body);
    reply.code(201);
    return ok(domain);
  });

  app.post('/v1/email/domains/:id/verify', async (request) => {
    requireRole(request, 'admin');
    await requireEmailModule(request);
    const { id } = PathId.parse(request.params);
    const ctx = toEmailContext(request);
    // Snapshot the state so we email the owner ONCE, on the pending→verified
    // transition — not on every re-check of an already-verified domain.
    const before = await domainService.get(ctx, id);
    const domain = await domainService.verify(ctx, id);
    if (before.state !== 'verified' && domain.state === 'verified') {
      try {
        const tenant = await prisma.tenant.findUnique({
          where: { id: ctx.tenantId },
          select: { email: true },
        });
        if (tenant?.email) {
          await publish(request.log, 'email.send', ctx.tenantId, null, {
            to: tenant.email,
            template: 'email-domain-verified',
            props: { domainName: domain.domain, dashboardUrl: appOrigin() },
          });
        }
      } catch (err) {
        request.log.warn({ err, domainId: id }, 'failed to publish email-domain-verified');
      }
    }
    return ok(domain);
  });

  app.post('/v1/email/domains/:id/default', async (request) => {
    const auth = requireRole(request, 'admin');
    await requireEmailModule(request);
    const { id } = PathId.parse(request.params);
    // "Default" is now per-site (docs/131 §3.4): this makes the domain the
    // default for the site the caller is currently working in, not for every
    // business the tenant runs.
    const propertyId = await resolvePropertyId(
      auth,
      request.headers['x-sparx-property-id'] as string | undefined
    );
    const domain = await domainService.setDefault(toEmailContext(request), propertyId, id);
    return ok(domain);
  });

  app.delete('/v1/email/domains/:id', async (request, reply) => {
    requireRole(request, 'admin');
    await requireEmailModule(request);
    const { id } = PathId.parse(request.params);
    await domainService.remove(toEmailContext(request), id);
    reply.code(204);
  });

  return Promise.resolve();
};

export default emailDomainRoutes;
