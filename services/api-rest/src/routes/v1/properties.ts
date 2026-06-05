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
// HOST MODEL (docs/49 §5): every property has a STABLE per-site
// `<tenant>-<slug>.sparx.zone` subdomain, minted at create time and never moved —
// a site's permanent address, so links to it never break. The bare
// `<tenant>.sparx.zone` is a separate primary ALIAS that FOLLOWS the primary:
// make-primary re-points it at the new primary and guarantees the demoted site
// its own per-site subdomain (so nothing becomes unreachable). Custom/purchased
// domains are attached explicitly per-site and are never reassigned here. The
// `domains` table is non-RLS, so its writes use the bare client / the withTenant
// tx without a policy concern; `host` is globally unique (the cross-tenant guard).

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

  // Make this property the tenant's primary. Flips `is_primary` (dashboard
  // default + billing anchor) AND makes the bare `<tenant>.sparx.zone` host
  // follow the primary (docs/49 §5): it re-points to the new primary, and the
  // demoted site is guaranteed its own stable `<tenant>-<slug>.sparx.zone`
  // subdomain so it stays reachable. Per-site subdomains never move; only the
  // bare alias does. Custom/purchased domains are untouched. All in ONE tx so the
  // partial-unique `properties_one_primary_per_tenant` never sees two primaries.
  app.post('/v1/properties/:id/make-primary', async (request) => {
    const auth = requireRole(request, 'editor');
    const { id } = IdParam.parse(request.params);

    // Tenant slug anchors every *.sparx.zone host (`tenants` is non-RLS). The
    // bare host is `<tenant>.sparx.zone` (mintZoneHost ignores the slug arg when
    // isPrimary=true).
    const tenant = await prisma.tenant.findUnique({
      where: { id: auth.tenantId },
      select: { slug: true },
    });
    if (!tenant) throw notFound('Tenant', auth.tenantId);
    const bareHost = mintZoneHost(tenant.slug, 'primary', true);

    const row = await withTenant({ tenantId: auth.tenantId, userId: auth.actorId }, async (tx) => {
      const target = await tx.property.findUnique({ where: { id } });
      if (!target) return null;
      if (target.isPrimary) return target; // already primary — no-op

      const prevPrimary = await tx.property.findFirst({
        where: { isPrimary: true },
        select: { id: true, slug: true },
      });

      // Flip the flag (clear the old primary first so the partial-unique index
      // never sees two).
      await tx.property.updateMany({ where: { isPrimary: true }, data: { isPrimary: false } });
      const updated = await tx.property.update({ where: { id }, data: { isPrimary: true } });

      // (a) Guarantee the demoted site a stable per-site subdomain and make it
      //     that site's canonical (it's about to lose the bare host). Upsert by
      //     the globally-unique host so re-running make-primary is idempotent.
      if (prevPrimary) {
        const demotedHost = mintZoneHost(tenant.slug, prevPrimary.slug, false);
        await tx.domain.upsert({
          where: { host: demotedHost },
          update: { propertyId: prevPrimary.id, status: 'active' },
          create: {
            tenantId: auth.tenantId,
            propertyId: prevPrimary.id,
            host: demotedHost,
            type: 'subdomain',
            status: 'active',
            isCanonical: false,
          },
        });
        // Sole canonical per property — clear-then-set, mirroring the
        // /v1/domains canonical route.
        await tx.domain.updateMany({
          where: { propertyId: prevPrimary.id, isCanonical: true },
          data: { isCanonical: false },
        });
        await tx.domain.update({ where: { host: demotedHost }, data: { isCanonical: true } });
      }

      // (b) Re-point the bare host to the new primary, creating it if it never
      //     existed (older tenant relying on the resolver's primary fallback).
      await tx.domain.upsert({
        where: { host: bareHost },
        update: { propertyId: updated.id, status: 'active' },
        create: {
          tenantId: auth.tenantId,
          propertyId: updated.id,
          host: bareHost,
          type: 'subdomain',
          status: 'active',
          isCanonical: false,
        },
      });
      // (c) New primary's sole canonical = the bare host (clear-then-set).
      await tx.domain.updateMany({
        where: { propertyId: updated.id, isCanonical: true },
        data: { isCanonical: false },
      });
      await tx.domain.update({ where: { host: bareHost }, data: { isCanonical: true } });

      return updated;
    });
    if (!row) throw notFound('Property', id);
    return ok(toView(row));
  });

  // Delete a site. Refuses the primary (make another primary first) — a tenant
  // must always have exactly one. The FK cascade removes the site's Builder
  // pages/layouts/assignments, its domains, and its Model B product/content
  // scope rows; the shared back office (products, content, orders) is untouched.
  app.delete('/v1/properties/:id', async (request) => {
    const auth = requireRole(request, 'editor');
    const { id } = IdParam.parse(request.params);
    const result = await withTenant(
      { tenantId: auth.tenantId, userId: auth.actorId },
      async (tx) => {
        const existing = await tx.property.findUnique({
          where: { id },
          select: { id: true, isPrimary: true },
        });
        if (!existing) return { error: 'not_found' as const };
        if (existing.isPrimary) return { error: 'primary' as const };
        await tx.property.delete({ where: { id } });
        return { ok: true as const };
      }
    );
    if ('error' in result) {
      if (result.error === 'not_found') throw notFound('Property', id);
      throw conflict('You can’t delete your primary site. Make another site primary first.', {
        field: 'isPrimary',
      });
    }
    return ok({ id });
  });
};

export default propertiesRoutes;
