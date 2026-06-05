// Domains — the hostnames pointing at a tenant's web PROPERTIES (docs/49 §5,
// docs/24). The "Foundation + BYO connect" surface: every property is born with
// an always-on `*.sparx.zone` subdomain (minted by the property-create flow),
// and a tenant can CONNECT a domain they already own (CNAME + TXT proof).
//
//   GET    /v1/domains            ?propertyId=  → the tenant's domains (optionally one property's)
//   POST   /v1/domains                          → connect a custom domain { propertyId, host }
//   GET    /v1/domains/:id                       → one domain (+ DNS instructions while pending)
//   POST   /v1/domains/:id/verify                → poll DNS now; verified → routable
//   PATCH  /v1/domains/:id                        → set canonical (the property's apex host)
//   DELETE /v1/domains/:id                        → disconnect (subdomain hosts are protected)
//
// `domains` is a NON-RLS dispatch table (host→property resolution runs before a
// tenant is known). So every query here filters by tenant_id IN THE APP — the
// security boundary is the explicit `where: { tenantId }`, exactly as the
// `tenants` table is managed. Property ownership is checked through withTenant
// (properties IS FORCE RLS). Owned ABOVE modules (not module-gated), like
// /v1/properties.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma, withTenant } from '@sparx/db';
import { ok } from '@sparx/api-core/envelope';
import { notFound, conflict, validationError } from '@sparx/api-core/errors';
import { requireRole } from '@sparx/api-core/auth';
import {
  normalizeHost,
  isValidHost,
  isZoneHost,
  newVerificationToken,
  connectInstructions,
  verifyTxtToken,
} from '../../lib/domain.js';

interface DomainView {
  id: string;
  propertyId: string;
  host: string;
  type: string;
  status: string;
  isCanonical: boolean;
  verifiedAt: string | null;
  createdAt: string;
  // DNS records the tenant must add — present only while a custom domain is
  // unverified (pending/verifying/failed). Null once active or for subdomains.
  instructions: ReturnType<typeof connectInstructions> | null;
}

function toView(row: {
  id: string;
  propertyId: string;
  host: string;
  type: string;
  status: string;
  isCanonical: boolean;
  verificationToken: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
}): DomainView {
  const needsDns = row.type === 'custom' && row.status !== 'active' && row.status !== 'verified';
  return {
    id: row.id,
    propertyId: row.propertyId,
    host: row.host,
    type: row.type,
    status: row.status,
    isCanonical: row.isCanonical,
    verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    instructions:
      needsDns && row.verificationToken
        ? connectInstructions(row.host, row.verificationToken)
        : null,
  };
}

const IdParam = z.object({ id: z.string().uuid() });
const ListQuery = z.object({ propertyId: z.string().uuid().optional() });
const ConnectBody = z.object({
  propertyId: z.string().uuid(),
  host: z.string().min(1).max(255),
});
const PatchBody = z.object({ isCanonical: z.literal(true) });

/** Confirm the property belongs to the caller's tenant (properties IS RLS).
 *  Returns the slug or null. */
async function ownProperty(tenantId: string, propertyId: string): Promise<boolean> {
  const row = await withTenant({ tenantId }, (tx) =>
    tx.property.findUnique({ where: { id: propertyId }, select: { id: true } })
  );
  return row != null;
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature.
const domainsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/domains', async (request) => {
    const auth = requireRole(request, 'viewer');
    const { propertyId } = ListQuery.parse(request.query);
    const rows = await prisma.domain.findMany({
      where: { tenantId: auth.tenantId, ...(propertyId ? { propertyId } : {}) },
      orderBy: [{ isCanonical: 'desc' }, { createdAt: 'asc' }],
    });
    return ok(rows.map(toView));
  });

  app.get('/v1/domains/:id', async (request) => {
    const auth = requireRole(request, 'viewer');
    const { id } = IdParam.parse(request.params);
    const row = await prisma.domain.findFirst({ where: { id, tenantId: auth.tenantId } });
    if (!row) throw notFound('Domain', id);
    return ok(toView(row));
  });

  // Connect a domain the tenant already owns. Mints a TXT proof token and stores
  // a pending row; the tenant adds the DNS records (returned as `instructions`)
  // then calls /verify. The host is GLOBALLY unique — a 409 means another site
  // (this tenant's or anyone's) already holds it.
  app.post('/v1/domains', async (request) => {
    const auth = requireRole(request, 'editor');
    const input = ConnectBody.parse(request.body);
    const host = normalizeHost(input.host);
    if (!isValidHost(host)) {
      throw validationError('Enter a valid domain (e.g. shop.acme.com).', [
        { field: 'host', message: 'Not a valid hostname.' },
      ]);
    }
    if (isZoneHost(host)) {
      throw validationError('That host is managed by Sparx and is added automatically.', [
        { field: 'host', message: 'sparx.zone subdomains cannot be connected.' },
      ]);
    }
    if (!(await ownProperty(auth.tenantId, input.propertyId))) {
      throw notFound('Property', input.propertyId);
    }
    const existing = await prisma.domain.findUnique({ where: { host }, select: { id: true } });
    if (existing) throw conflict('That domain is already connected to a site.', { field: 'host' });

    const row = await prisma.domain.create({
      data: {
        tenantId: auth.tenantId,
        propertyId: input.propertyId,
        host,
        type: 'custom',
        status: 'pending',
        verificationToken: newVerificationToken(),
      },
    });
    return ok(toView(row));
  });

  // Poll DNS for the control-proof TXT. On success the domain becomes routable
  // (status='active') and Caddy will issue its cert on the next HTTPS hit.
  app.post('/v1/domains/:id/verify', async (request) => {
    const auth = requireRole(request, 'editor');
    const { id } = IdParam.parse(request.params);
    const row = await prisma.domain.findFirst({ where: { id, tenantId: auth.tenantId } });
    if (!row) throw notFound('Domain', id);
    if (row.type !== 'custom') {
      // subdomain / purchased hosts are already live; nothing to verify.
      return ok(toView(row));
    }
    if (!row.verificationToken) {
      throw validationError('This domain has no verification token.', [
        { field: 'id', message: 'Missing token.' },
      ]);
    }

    const passed = await verifyTxtToken(row.host, row.verificationToken);
    const updated = await prisma.domain.update({
      where: { id },
      data: passed
        ? { status: 'active', verifiedAt: new Date(), verificationToken: null }
        : { status: 'failed' },
    });
    if (!passed) {
      throw validationError(
        'We could not find the verification TXT record yet. DNS can take a few minutes to propagate — add the record and try again.',
        [{ field: 'host', message: 'TXT record not found.' }]
      );
    }
    return ok(toView(updated));
  });

  // Make this host the canonical (apex) one for its property — at most one
  // canonical per property (the others 301 to it at the edge). One tx so two
  // hosts are never both canonical.
  app.patch('/v1/domains/:id', async (request) => {
    const auth = requireRole(request, 'editor');
    const { id } = IdParam.parse(request.params);
    PatchBody.parse(request.body);
    const row = await prisma.domain.findFirst({ where: { id, tenantId: auth.tenantId } });
    if (!row) throw notFound('Domain', id);
    if (row.status !== 'active' && row.status !== 'verified') {
      throw conflict('Verify this domain before making it canonical.', { field: 'status' });
    }
    const updated = await prisma.$transaction(async (tx) => {
      await tx.domain.updateMany({
        where: { propertyId: row.propertyId, isCanonical: true },
        data: { isCanonical: false },
      });
      return tx.domain.update({ where: { id }, data: { isCanonical: true } });
    });
    return ok(toView(updated));
  });

  // Disconnect a custom/purchased domain. The always-on subdomain is the site's
  // permanent address and can't be removed (delete the property instead).
  app.delete('/v1/domains/:id', async (request) => {
    const auth = requireRole(request, 'editor');
    const { id } = IdParam.parse(request.params);
    const row = await prisma.domain.findFirst({ where: { id, tenantId: auth.tenantId } });
    if (!row) throw notFound('Domain', id);
    if (row.type === 'subdomain') {
      throw conflict(
        'The sparx.zone subdomain is the site’s permanent address and cannot be removed.',
        {
          field: 'type',
        }
      );
    }
    await prisma.domain.delete({ where: { id } });
    return ok({ id });
  });
};

export default domainsRoutes;
