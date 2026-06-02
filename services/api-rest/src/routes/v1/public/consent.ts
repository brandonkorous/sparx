// Public cookie-consent endpoints for storefronts (docs/42 §4).
//
//   GET  /v1/public/consent/config ?tenant=<slug>   → consent config for the banner
//   POST /v1/public/consent        ?tenant=<slug>   → record a consent decision
//
// No auth and NOT module-gated — compliance applies to content-only and
// commerce-only tenants alike, so consent only requires a valid tenant. The
// consent cookie is set client-side (the storefront /api/sparx proxy only
// relays one Set-Cookie), so this endpoint records the decision but never sets
// a cookie. IP + user-agent are captured server-side as the proof of record.

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma, withTenant } from '@sparx/db';
import { ok } from '@sparx/api-core/envelope';
import { notFound } from '@sparx/api-core/errors';
import { readPublicConsentConfig } from '../../../lib/consent.js';

async function resolveTenantBySlug(slug: string): Promise<string> {
  const t = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!t) throw notFound('Tenant', slug);
  return t.id;
}

function clientMeta(request: FastifyRequest): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  const ua = request.headers['user-agent'];
  return { ipAddress: request.ip || null, userAgent: typeof ua === 'string' ? ua : null };
}

const TenantQuery = z.object({ tenant: z.string().min(1).max(63) });

const RecordBody = z.object({
  visitorId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  categories: z.object({
    strictly_necessary: z.literal(true).default(true),
    preferences: z.boolean().default(false),
    analytics: z.boolean().default(false),
    marketing: z.boolean().default(false),
  }),
  action: z.enum(['accept_all', 'reject_all', 'save_prefs', 'opt_out']),
});

const publicConsentRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/public/consent/config', async (request) => {
    const q = TenantQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const config = await withTenant({ tenantId }, (tx) => readPublicConsentConfig(tx, tenantId));
    return ok(config);
  });

  app.post('/v1/public/consent', async (request) => {
    const q = TenantQuery.parse(request.query);
    const body = RecordBody.parse(request.body);
    const tenantId = await resolveTenantBySlug(q.tenant);
    const { ipAddress, userAgent } = clientMeta(request);

    const record = await withTenant({ tenantId }, async (tx) => {
      // Snapshot the mode + policy version at decision time so the record is
      // self-describing even after the tenant later changes its config.
      const config = await readPublicConsentConfig(tx, tenantId);
      return tx.consentRecord.create({
        data: {
          tenantId,
          visitorId: body.visitorId,
          customerId: body.customerId ?? null,
          mode: config.mode === 'off' ? 'gdpr' : config.mode,
          categories: body.categories,
          action: body.action,
          policyVersion: config.policyVersion,
          ipAddress,
          userAgent,
        },
        select: { id: true, createdAt: true },
      });
    });

    return ok({ id: record.id, recordedAt: record.createdAt.toISOString() });
  });

  return Promise.resolve();
};

export default publicConsentRoutes;
