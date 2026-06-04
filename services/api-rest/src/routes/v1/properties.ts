// Properties — a tenant's web properties (the multi-site axis, docs/49). One
// TENANT has one-or-more PROPERTIES (a property = a distinct site: presentation
// + page tree + domain) over the shared back office. Every tenant has exactly
// one is_primary property (seeded by migration 20260626000000_properties).
//
//   GET   /v1/properties        → the tenant's properties (primary first)
//   GET   /v1/properties/:id     → one property
//   PATCH /v1/properties/:id     → rename / update settings (partial)
//
// Property is owned ABOVE every module — NOT module-gated (no requireModule),
// exactly like /v1/brand and /v1/tenant. The `properties` table is ENABLE+FORCE
// RLS, so reads/writes go through withTenant. `property_id` is NOT a security
// boundary — tenant_id (the RLS GUC) is; property scoping is application-tier
// (docs/49 §2).
//
// CREATE and MAKE-PRIMARY are deliberately deferred to Phase 2 (the
// create-additional-property flow): until the Builder presentation layer
// re-keys onto property_id (spec Step B), a second property would have no pages
// or layout to render. This route is the read + rename surface for the single
// primary property that exists today.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant } from '@sparx/db';
// Prisma types only (Update/JSON input shapes) — no runtime Prisma value is used
// here, so this is a type-only import (cf. brand.ts, which needs Prisma.DbNull).
import type { Prisma } from '@prisma/client';
import { ok } from '@sparx/api-core/envelope';
import { notFound } from '@sparx/api-core/errors';
import { requireRole } from '@sparx/api-core/auth';

interface PropertyView {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  isPrimary: boolean;
  status: string;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

function toView(row: {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  isPrimary: boolean;
  status: string;
  settings: unknown;
  createdAt: Date;
  updatedAt: Date;
}): PropertyView {
  return {
    id: row.id,
    tenantId: row.tenantId,
    slug: row.slug,
    name: row.name,
    isPrimary: row.isPrimary,
    status: row.status,
    settings:
      row.settings && typeof row.settings === 'object' && !Array.isArray(row.settings)
        ? (row.settings as Record<string, unknown>)
        : {},
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const IdParam = z.object({ id: z.string().uuid() });

// All fields optional → PATCH semantics. `slug` is intentionally immutable here
// (it's the stable per-tenant handle); `isPrimary`/create/make-primary belong to
// the Phase 2 management flow.
const PatchProperty = z.object({
  name: z.string().min(1).max(255).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature.
const propertiesRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/properties', async (request) => {
    const auth = requireRole(request, 'viewer');
    const rows = await withTenant({ tenantId: auth.tenantId }, (tx) =>
      tx.property.findMany({ orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }] })
    );
    return ok(rows.map(toView));
  });

  app.get('/v1/properties/:id', async (request) => {
    const auth = requireRole(request, 'viewer');
    const { id } = IdParam.parse(request.params);
    const row = await withTenant({ tenantId: auth.tenantId }, (tx) =>
      tx.property.findUnique({ where: { id } })
    );
    if (!row) throw notFound('Property', id);
    return ok(toView(row));
  });

  app.patch('/v1/properties/:id', async (request) => {
    const auth = requireRole(request, 'editor');
    const { id } = IdParam.parse(request.params);
    const input = PatchProperty.parse(request.body);

    // Only forward keys the caller actually sent (PATCH merge).
    const data: Prisma.PropertyUncheckedUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.settings !== undefined) data.settings = input.settings as Prisma.InputJsonValue;

    const row = await withTenant({ tenantId: auth.tenantId, userId: auth.actorId }, async (tx) => {
      // Scope the update to the tenant's own row; a missing id is a 404, not a
      // silent no-op (updateMany would hide it).
      const existing = await tx.property.findUnique({ where: { id }, select: { id: true } });
      if (!existing) return null;
      return tx.property.update({ where: { id }, data });
    });
    if (!row) throw notFound('Property', id);
    return ok(toView(row));
  });
};

export default propertiesRoutes;
