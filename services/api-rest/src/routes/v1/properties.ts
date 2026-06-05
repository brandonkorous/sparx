// Properties — a tenant's web properties (the multi-site axis, docs/49). One
// TENANT has one-or-more PROPERTIES (a property = a distinct site: presentation
// + page tree + domain) over the shared back office. Every tenant has exactly
// one is_primary property (seeded by migration 20260626000000_properties).
//
//   GET   /v1/properties            → the tenant's properties (primary first)
//   POST  /v1/properties            → create an additional site (+ its subdomain)
//   GET   /v1/properties/:id         → one property
//   PATCH /v1/properties/:id         → rename / update settings (partial)
//   POST  /v1/properties/:id/make-primary → flip which site is the tenant's primary
//
// Property is owned ABOVE every module — NOT module-gated (no requireModule),
// exactly like /v1/brand and /v1/tenant. The `properties` table is ENABLE+FORCE
// RLS, so reads/writes go through withTenant. `property_id` is NOT a security
// boundary — tenant_id (the RLS GUC) is; property scoping is application-tier
// (docs/49 §2).
//
// SUBDOMAINS ARE STABLE FROM BIRTH: a property's `*.sparx.zone` host is minted at
// create time (`<tenant>-<slug>.sparx.zone`; the primary keeps the bare
// `<tenant>.sparx.zone`) and never moves. make-primary flips the `is_primary`
// flag (dashboard default + billing anchor) but does NOT reassign hostnames —
// every site keeps its permanent address. The `domains` table is non-RLS, so its
// writes use the bare client / the withTenant tx without a policy concern.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma, withTenant } from '@sparx/db';
// Runtime import: `Prisma.DbNull` (clearing the brandOverride JSON column) is a
// value, plus the Update/JSON input shapes are used as types (cf. brand.ts).
import { Prisma } from '@prisma/client';
import { ok } from '@sparx/api-core/envelope';
import { notFound, conflict, validationError } from '@sparx/api-core/errors';
import { requireRole } from '@sparx/api-core/auth';
import { mintZoneHost } from '../../lib/domain.js';
import { PropertyBrandOverrideSchema, parseBrandOverride } from '../../lib/property-brand.js';

// A stable per-tenant property handle from a display name: lowercase, hyphenated,
// ≤63 chars. Mirrors the tenant slugify in @sparx/auth.
function slugifyProperty(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

interface PropertyView {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  isPrimary: boolean;
  status: string;
  settings: Record<string, unknown>;
  // Per-site brand override (docs/49 §3) — null = inherit the tenant brand.
  brandOverride: Record<string, unknown> | null;
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
  brandOverride: unknown;
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
    brandOverride: parseBrandOverride(row.brandOverride),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const IdParam = z.object({ id: z.string().uuid() });

// All fields optional → PATCH semantics. `slug` is intentionally immutable here
// (it's the stable per-tenant handle that anchors the subdomain host).
// `brandOverride` is the per-site brand override (docs/49 §3); send `null` to
// clear it (inherit the tenant brand) or a partial object to set it.
const PatchProperty = z.object({
  name: z.string().min(1).max(255).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  brandOverride: PropertyBrandOverrideSchema.nullable().optional(),
});

// Create an additional site. `slug` optional → derived from the name. 'primary'
// is reserved for the tenant's primary property.
const CreateProperty = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(63).optional(),
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

  // Create an additional web property (site). Mints its always-on
  // `<tenant>-<slug>.sparx.zone` subdomain so it's reachable immediately; the
  // Builder page tree + chrome are seeded lazily on first edit (listOrSeed).
  app.post('/v1/properties', async (request) => {
    const auth = requireRole(request, 'editor');
    const input = CreateProperty.parse(request.body);
    const slug = slugifyProperty(input.slug ?? input.name);
    if (!slug) {
      throw validationError('Name must contain letters or numbers.', [
        { field: 'name', message: 'Could not derive a URL handle.' },
      ]);
    }
    if (slug === 'primary') {
      throw validationError('“primary” is reserved for your main site.', [
        { field: 'slug', message: 'Choose a different handle.' },
      ]);
    }

    // Tenant slug anchors the subdomain host (`tenants` is non-RLS).
    const tenant = await prisma.tenant.findUnique({
      where: { id: auth.tenantId },
      select: { slug: true },
    });
    if (!tenant) throw notFound('Tenant', auth.tenantId);
    const host = mintZoneHost(tenant.slug, slug, false);

    const row = await withTenant({ tenantId: auth.tenantId, userId: auth.actorId }, async (tx) => {
      // Slug unique per tenant (@@unique([tenantId, slug])).
      const clash = await tx.property.findFirst({ where: { slug }, select: { id: true } });
      if (clash) return { conflict: 'slug' as const };
      // Host is globally unique — another site (anywhere) may already hold it.
      const hostClash = await tx.domain.findUnique({ where: { host }, select: { id: true } });
      if (hostClash) return { conflict: 'host' as const };

      const property = await tx.property.create({
        data: { tenantId: auth.tenantId, slug, name: input.name, isPrimary: false },
      });
      await tx.domain.create({
        data: {
          tenantId: auth.tenantId,
          propertyId: property.id,
          host,
          type: 'subdomain',
          status: 'active',
          isCanonical: true,
        },
      });
      return { property };
    });
    if ('conflict' in row) {
      if (row.conflict === 'slug') {
        throw conflict(`A site with the handle “${slug}” already exists.`, { field: 'slug' });
      }
      throw conflict('That subdomain is already taken. Pick a different handle.', {
        field: 'slug',
      });
    }
    return ok(toView(row.property));
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
    if (input.brandOverride !== undefined) {
      // object → set the override; null → Prisma.DbNull clears it (inherit the
      // tenant brand). `?? DbNull` is exact here since the value is `object | null`.
      data.brandOverride = input.brandOverride ?? Prisma.DbNull;
    }

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

  // Make this property the tenant's primary. Flips the `is_primary` flag only —
  // hostnames are stable from birth (see the header note), so the bare
  // `<tenant>.sparx.zone` keeps pointing at whichever site was primary at
  // creation. Clears the prior primary then sets this one in ONE tx so the
  // partial-unique `properties_one_primary_per_tenant` never sees two.
  app.post('/v1/properties/:id/make-primary', async (request) => {
    const auth = requireRole(request, 'editor');
    const { id } = IdParam.parse(request.params);
    const row = await withTenant({ tenantId: auth.tenantId, userId: auth.actorId }, async (tx) => {
      const target = await tx.property.findUnique({ where: { id } });
      if (!target) return null;
      if (target.isPrimary) return target; // already primary — no-op
      await tx.property.updateMany({
        where: { isPrimary: true },
        data: { isPrimary: false },
      });
      return tx.property.update({ where: { id }, data: { isPrimary: true } });
    });
    if (!row) throw notFound('Property', id);
    return ok(toView(row));
  });
};

export default propertiesRoutes;
