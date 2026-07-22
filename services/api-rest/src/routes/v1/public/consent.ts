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
import { withTenant } from '@sparx/db';
import { ok } from '@sparx/api-core/envelope';
import { readPublicConsentConfig } from '../../../lib/consent.js';
import { requireTenantIdBySlug } from '../../../lib/tenant-slug.js';
import { resolvePublicPropertyId } from '../../../lib/property.js';

// Cached in lib/tenant-slug.ts (docs/127 §5).
const resolveTenantBySlug = requireTenantIdBySlug;

function clientMeta(request: FastifyRequest): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  const ua = request.headers['user-agent'];
  return { ipAddress: request.ip || null, userAgent: typeof ua === 'string' ? ua : null };
}

const TenantQuery = z.object({
  tenant: z.string().min(1).max(63),
  // WHICH site the banner is rendering on (docs/131 §3.9) — the same
  // `?property=<slug>` every other public storefront read carries. Absent
  // resolves to the primary, matching resolvePublicPropertyId everywhere else.
  property: z.string().min(1).max(63).optional(),
});

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
    const propertyId = await resolvePublicPropertyId(tenantId, q.property);
    const config = await withTenant({ tenantId }, (tx) =>
      readPublicConsentConfig(tx, tenantId, propertyId)
    );
    return ok(config);
  });

  app.post('/v1/public/consent', async (request) => {
    const q = TenantQuery.parse(request.query);
    const body = RecordBody.parse(request.body);
    const tenantId = await resolveTenantBySlug(q.tenant);
    // The business this person is actually deciding about. Recording it against
    // the tenant meant a "reject all" on one storefront silently governed the
    // other — and, worse, an "accept" did too.
    const propertyId = await resolvePublicPropertyId(tenantId, q.property);
    const { ipAddress, userAgent } = clientMeta(request);

    const record = await withTenant({ tenantId }, async (tx) => {
      // Snapshot the mode + policy version at decision time so the record is
      // self-describing even after the business later changes its config.
      const config = await readPublicConsentConfig(tx, tenantId, propertyId);
      return tx.consentRecord.create({
        data: {
          tenantId,
          propertyId,
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
