// Commerce — product types (docs/143). The commerce mirror of /v1/content/types.
//
//   GET    /v1/commerce/product-types            → list every type the tenant can use
//   GET    /v1/commerce/product-types/:key       → fetch one
//   POST   /v1/commerce/product-types            → create a tenant-custom type
//   PATCH  /v1/commerce/product-types/:key       → update a tenant-custom type (built-ins read-only)
//   PUT    /v1/commerce/product-types/:key/schema → author the attribute schema (FORKS a built-in)
//   DELETE /v1/commerce/product-types/:key       → remove a tenant-custom type (built-ins read-only)
//
// Attribute schemas are validated against the FieldDef union from
// @wizeworks/field-schema (via @wizeworks/commerce-schemas ProductTypeSchema) — the same
// validator used at product-write time, so a schema can never persist in a shape
// the attribute validator won't accept.
//
// PUT :key/schema mirrors the CMS keystone: editing a platform built-in's fields
// transparently FORKS it into a tenant-owned copy (same key, is_built_in=false)
// that shadows the platform row — read paths dedupe by key, tenant copy wins.
//
// Routes are intentionally thin — the service owns validation, audit logs, and
// fork rules. Transport handles auth, module gate, envelope.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { productTypeService } from '@wizeworks/commerce';
import {
  CreateProductTypeInput,
  UpdateProductTypeInput,
  ReplaceProductTypeSchemaInput,
} from '@wizeworks/commerce-schemas';
import { ok, paged } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { notFound } from '@wizeworks/api-core/errors';
import { toCommerceContext, requireCommerceModule } from '../../../lib/commerce-context.js';

const KeyParams = z.object({ key: z.string().min(1).max(63) });

const ListQuery = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  kind: z.enum(['built_in', 'custom']).optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const productTypeRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/commerce/product-types', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const q = ListQuery.parse(request.query);
    const rows = await productTypeService.list(toCommerceContext(request).tenantId);
    // The service already dedupes by key (tenant fork shadows built-in). Filter +
    // page in memory — the type catalog is a small, bounded set.
    const needle = q.q?.toLowerCase();
    const filtered = rows.filter((r) => {
      if (q.kind === 'built_in' && !r.isBuiltIn) return false;
      if (q.kind === 'custom' && r.isBuiltIn) return false;
      if (needle) {
        const haystack = `${r.name} ${r.pluralName ?? ''} ${r.description ?? ''}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
    const total = filtered.length;
    const skip = q.skip ?? 0;
    const take = Math.min(q.take ?? 50, 250);
    return paged(filtered.slice(skip, skip + take), { total, per_page: q.take ?? 50 });
  });

  app.get('/v1/commerce/product-types/:key', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const { key } = KeyParams.parse(request.params);
    const row = await productTypeService.get(toCommerceContext(request).tenantId, key);
    if (!row) throw notFound('Product type', key);
    return ok(row);
  });

  app.post('/v1/commerce/product-types', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const input = CreateProductTypeInput.parse(request.body);
    const created = await productTypeService.create(toCommerceContext(request), input);
    reply.code(201);
    return ok(created);
  });

  app.patch('/v1/commerce/product-types/:key', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { key } = KeyParams.parse(request.params);
    const input = UpdateProductTypeInput.parse(request.body);
    const updated = await productTypeService.update(toCommerceContext(request), key, input);
    return ok(updated);
  });

  // AUTHOR SCHEMA (fork-on-edit) — the field-builder's Save. Editing a tenant-owned
  // type updates its schema in place; editing a platform built-in FORKS it. The
  // response carries `forked` so the client can surface "this is now your copy".
  app.put('/v1/commerce/product-types/:key/schema', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { key } = KeyParams.parse(request.params);
    const { attributeSchema } = ReplaceProductTypeSchemaInput.parse(request.body);
    const { productType, forked } = await productTypeService.replaceSchema(
      toCommerceContext(request),
      key,
      attributeSchema
    );
    return ok({ ...productType, forked });
  });

  app.delete('/v1/commerce/product-types/:key', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { key } = KeyParams.parse(request.params);
    await productTypeService.remove(toCommerceContext(request), key);
    reply.code(204);
    return;
  });

  return Promise.resolve();
};

export default productTypeRoutes;
