// Public email-capture endpoint for storefronts — the Builder "Email signup"
// block (docs/51 §7).
//
//   POST /v1/public/signup ?tenant=<slug> [&property=<slug>]  → opt a visitor
//   into marketing email. Creates or updates a CRM `prospect` contact with
//   `marketing` consent (idempotent on the tenant/property/email identity).
//
// No auth (anonymous shoppers), but MODULE-GATED on CRM: the contact spine lives
// in the CRM module, so a tenant without CRM active gets a 404 (MODULE_DISABLED)
// rather than a silently-dropped signup. IP is captured server-side as proof of
// the opt-in (mirrors the consent record). The reply never reveals whether the
// email was already on file — a signup form must not double as an email oracle.
//
// ── IT ALSO ENTERS A FUNNEL (docs/152 C1) ────────────────────────────────────
//
// The capture offers in the catalog are built on this endpoint, so without the
// stitch below a slide-in could collect an address into CRM all week while its
// campaign reported nobody. `formNodeId` is what ties one back to the campaign
// that placed it — the same key the contact-form path uses, so an author who
// points a campaign at a block gets the same answer either way.

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { isModuleEnabled } from '@wizeworks/auth';
import { customerService } from '@wizeworks/crm';
import { prisma, withTenant } from '@wizeworks/db';
import { ok } from '@wizeworks/api-core/envelope';
import { moduleDisabled, notFound } from '@wizeworks/api-core/errors';
import { captureFunnelStage, findFormCaptureTarget } from '../../../lib/funnel-entry.js';

const Query = z.object({
  tenant: z.string().min(1).max(63),
  property: z.string().min(1).max(63).optional(),
});

const Body = z.object({
  email: z.string().email().max(255),
  firstName: z.string().max(255).optional(),
  lastName: z.string().max(255).optional(),
  /** Which block on the page captured this. Optional because a signup authored
   *  before campaigns existed still works — it simply enters no funnel. */
  formNodeId: z.string().min(1).max(255).optional(),
});

function clientIp(request: FastifyRequest): string | undefined {
  return request.ip || undefined;
}

/** Capped: the funnel's entry attribution reads it, and a header is attacker-set. */
function userAgent(request: FastifyRequest): string | undefined {
  const ua = request.headers['user-agent'];
  return typeof ua === 'string' ? ua.slice(0, 1000) : undefined;
}

const publicSignupRoutes: FastifyPluginAsync = (app) => {
  app.post('/v1/public/signup', async (request) => {
    const q = Query.parse(request.query);
    const body = Body.parse(request.body);

    const tenant = await prisma.tenant.findUnique({
      where: { slug: q.tenant },
      select: { id: true },
    });
    if (!tenant) throw notFound('Tenant', q.tenant);

    // The contact spine is a CRM concern — gate the capture on it.
    if (!(await isModuleEnabled(tenant.id, 'crm'))) throw moduleDisabled('crm');

    // Resolve the originating site (docs/58 D2) so the contact is scoped to it.
    // A miss → tenant-level contact (propertyId null), never a hard error: a
    // newsletter signup shouldn't 404 because a site slug drifted.
    let propertyId: string | null = null;
    if (q.property) {
      const property = await withTenant({ tenantId: tenant.id }, (tx) =>
        tx.property.findFirst({
          where: { tenantId: tenant.id, slug: q.property },
          select: { id: true },
        })
      );
      propertyId = property?.id ?? null;
    }

    await customerService.subscribe(
      { tenantId: tenant.id },
      {
        email: body.email,
        firstName: body.firstName ?? null,
        lastName: body.lastName ?? null,
        propertyId,
        source: 'signup',
        ipAddress: clientIp(request),
      }
    );

    // Never inside the subscribe: the contact and its consent record are the
    // tenant's actual business, and a reporting nicety must not be able to cost
    // them a subscriber. Same ordering as the contact-form stitch.
    if (body.formNodeId && propertyId) {
      const target = await findFormCaptureTarget(tenant.id, propertyId, body.formNodeId);
      if (target) {
        await captureFunnelStage({
          log: request.log,
          tenantId: tenant.id,
          funnelId: target.funnelId,
          stageKey: target.stageKey,
          subjectEmail: body.email,
          ip: request.ip,
          userAgent: userAgent(request) ?? '',
          now: new Date(),
        });
      }
    }

    return ok({ ok: true });
  });

  return Promise.resolve();
};

export default publicSignupRoutes;
