// Redirects.
//
//   GET    /v1/redirects                 → list
//   POST   /v1/redirects                 → create one
//   POST   /v1/redirects/bulk            → CSV-style bulk import { rows: [...] }
//   DELETE /v1/redirects/:id
//
// Chain / loop detection is enforced on insert by walking forward from
// `toPath` up to 8 hops; if we encounter `fromPath` mid-chain, reject. The
// production runtime path (Caddy + storefront edge) flattens redirects on
// resolve so the DB only needs the basic safety net here.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withRequestTenant } from '@sparx/api-core/db';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { conflict, notFound } from '@sparx/api-core/errors';
import { writeAudit } from '@sparx/api-core/audit';
import { publish } from '@sparx/api-core/pubsub';
import type { Prisma, Redirect, TxClient } from '@sparx/db';

import { resolveListScope, resolvePropertyId } from '../../../lib/property.js';

const PathSchema = z.string().min(1).max(2048).startsWith('/', 'Paths must begin with "/".');

// The dashboard consumes snake_case fields (`redirects-list.tsx`), and
// `hitCount` is a Prisma BigInt — passing a raw row straight to `ok`/`paged`
// throws "Do not know how to serialize a BigInt" during response
// serialization (no response schema is declared on these routes to coerce
// it), so every row needs this explicit shape + Number() conversion.
function toApiRedirect(row: Redirect) {
  return {
    id: row.id,
    property_id: row.propertyId,
    from_path: row.fromPath,
    to_path: row.toPath,
    status_code: row.statusCode,
    hit_count: Number(row.hitCount),
    created_at: row.createdAt.toISOString(),
  };
}

const CreateBody = z.object({
  from_path: PathSchema,
  to_path: PathSchema,
  status_code: z
    .union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)])
    .default(301),
  // Which site this rule fires on (docs/131 §3.8). Explicit null = every site.
  // Omitted = the site being worked in, resolved at the route.
  property_id: z.string().uuid().nullable().optional(),
});

const BulkBody = z.object({
  rows: z.array(CreateBody).min(1).max(5000),
});

const ListQuery = z.object({
  // A site id, or `all` for every site this member may reach (docs/131 §3.8).
  property: z.string().min(1).max(64).optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const PathId = z.object({ id: z.string().uuid() });

/** Chain/loop detection, walked WITHIN the site the new rule applies to
 *  (docs/131 §3.8). Scoping matters here: a tenant-wide rule and a site rule can
 *  now share a from_path, so an unscoped walk would follow hops that will never
 *  fire together and reject a perfectly valid redirect as a loop. */
async function assertNoChain(
  tx: TxClient,
  propertyId: string | null,
  fromPath: string,
  toPath: string
): Promise<void> {
  if (fromPath === toPath) {
    throw conflict('A redirect cannot point to itself.');
  }
  let probe = toPath;
  for (let hop = 0; hop < 8; hop++) {
    const next = await tx.redirect.findFirst({
      // `OR` rather than `in: [id, null]` — Prisma's `in` rejects null.
      where: { fromPath: probe, OR: [{ propertyId }, { propertyId: null }] },
      orderBy: { propertyId: { sort: 'desc', nulls: 'last' } },
    });
    if (!next) return;
    if (next.toPath === fromPath) {
      throw conflict(`Redirect would create a loop via ${probe} → ${next.toPath}.`);
    }
    probe = next.toPath;
  }
  throw conflict('Redirect would create a chain longer than 8 hops.');
}

const redirectRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/redirects', async (request) => {
    const auth = requireRole(request, 'viewer');
    const q = ListQuery.parse(request.query);
    // This site's rules plus the tenant-wide ones (docs/131 §3.8) — a management
    // list, so both tiers show: an author needs to see the shared rule that will
    // fire here, not just the ones they wrote for this site.
    const propertyId = await resolveListScope(
      auth,
      q.property,
      request.headers['x-sparx-property-id']
    );
    // `OR` rather than `in: [id, null]` — Prisma's `in` rejects null.
    const where: Prisma.RedirectWhereInput = propertyId
      ? { OR: [{ propertyId }, { propertyId: null }] }
      : {};
    const [rows, total] = await withRequestTenant(request, (tx) =>
      Promise.all([
        tx.redirect.findMany({
          where,
          orderBy: { fromPath: 'asc' },
          take: Math.min(q.take ?? 50, 250),
          skip: q.skip ?? 0,
        }),
        tx.redirect.count({ where }),
      ])
    );
    return paged(rows.map(toApiRedirect), { total, per_page: q.take ?? 50 });
  });

  app.post('/v1/redirects', async (request, reply) => {
    const auth = requireRole(request, 'editor');
    const input = CreateBody.parse(request.body);

    // Omitted → the site being worked in; only an EXPLICIT null makes the rule
    // fire on every domain. Defaulting the other way is what let a 301 written
    // for one business redirect visitors of another.
    const scopeId = await resolvePropertyId(
      auth,
      request.headers['x-sparx-property-id'] as string | undefined
    );
    const propertyId = input.property_id === undefined ? scopeId : input.property_id;

    const created = await withRequestTenant(request, async (tx) => {
      await assertNoChain(tx, propertyId, input.from_path, input.to_path);
      const existing = await tx.redirect.findFirst({
        where: { fromPath: input.from_path, propertyId },
      });
      if (existing) {
        throw conflict(`A redirect from "${input.from_path}" already exists.`);
      }
      const row = await tx.redirect.create({
        data: {
          tenantId: auth.tenantId,
          propertyId,
          fromPath: input.from_path,
          toPath: input.to_path,
          statusCode: input.status_code,
        },
      });
      await writeAudit(tx, request, auth, {
        action: 'redirect.created',
        entityType: 'redirect',
        entityId: row.id,
        after: { fromPath: row.fromPath, toPath: row.toPath, statusCode: row.statusCode },
      });
      return row;
    });

    await publish(request.log, 'redirect.added', auth.tenantId, auth.actorId, {
      id: created.id,
      fromPath: created.fromPath,
      toPath: created.toPath,
    });

    reply.code(201);
    return ok(toApiRedirect(created));
  });

  app.post('/v1/redirects/bulk', async (request) => {
    const auth = requireRole(request, 'editor');
    const input = BulkBody.parse(request.body);

    // Same default as the single create: a bulk import lands on the site being
    // worked in unless a row says otherwise. An unscoped import is how a
    // thousand rules written for one business would start firing on all of them.
    const scopeId = await resolvePropertyId(
      auth,
      request.headers['x-sparx-property-id'] as string | undefined
    );

    const result = await withRequestTenant(request, async (tx) => {
      const inserted: string[] = [];
      const skipped: { row: number; reason: string }[] = [];
      for (let i = 0; i < input.rows.length; i++) {
        const r = input.rows[i];
        if (!r) continue;
        const propertyId = r.property_id === undefined ? scopeId : r.property_id;
        try {
          await assertNoChain(tx, propertyId, r.from_path, r.to_path);
          const row = await tx.redirect.create({
            data: {
              tenantId: auth.tenantId,
              propertyId,
              fromPath: r.from_path,
              toPath: r.to_path,
              statusCode: r.status_code,
            },
          });
          inserted.push(row.id);
        } catch (err) {
          skipped.push({
            row: i,
            reason: err instanceof Error ? err.message : 'unknown',
          });
        }
      }
      await writeAudit(tx, request, auth, {
        action: 'redirect.bulk_imported',
        entityType: 'redirect',
        entityId: null,
        after: { inserted: inserted.length, skipped: skipped.length },
      });
      return { inserted: inserted.length, skipped };
    });

    return ok(result);
  });

  app.delete('/v1/redirects/:id', async (request, reply) => {
    const auth = requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    await withRequestTenant(request, async (tx) => {
      const existing = await tx.redirect.findFirst({ where: { id } });
      if (!existing) throw notFound('Redirect', id);
      await tx.redirect.delete({ where: { id } });
      await writeAudit(tx, request, auth, {
        action: 'redirect.deleted',
        entityType: 'redirect',
        entityId: id,
        before: { fromPath: existing.fromPath, toPath: existing.toPath },
      });
    });
    await publish(request.log, 'redirect.removed', auth.tenantId, auth.actorId, { id });
    reply.code(204);
  });
  return Promise.resolve();
};

export default redirectRoutes;
