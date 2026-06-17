// Platform component CATALOG API (docs/98 §5).
//
// Public (viewer):
//   GET  /v1/platform/catalog              → published entries (summary)
//   GET  /v1/platform/catalog/:id          → one published entry (full, by key)
//
// Admin (owner — the highest per-tenant role; platform-admin JWT tier is deferred):
//   POST   /v1/platform/catalog            → create (draft)
//   PATCH  /v1/platform/catalog/:id        → update identity/tree
//   DELETE /v1/platform/catalog/:id        → hard delete
//   GET    /v1/platform/catalog/admin      → list all (any status)
//   GET    /v1/platform/catalog/admin/:id  → one entry by id (any status)
//
// Lifecycle transitions (owner):
//   POST /v1/platform/catalog/:id/submit   → draft → submitted
//   POST /v1/platform/catalog/:id/review   → submitted → in_review
//   POST /v1/platform/catalog/:id/approve  → in_review → approved
//   POST /v1/platform/catalog/:id/publish  → approved → published
//   POST /v1/platform/catalog/:id/archive  → any → archived
//   POST /v1/platform/catalog/:id/reject   → submitted|in_review|approved → rejected
//
// Auth gating:
//   • Reads of PUBLISHED rows: requireRole(request, 'viewer') — every logged-in user.
//   • All writes + non-published reads: requireRole(request, 'owner').
//   • Rationale: The platform-admin JWT tier (docs/16 §2.4) is deferred. Until it
//     ships, the highest per-tenant role (owner) gates all write operations on this
//     global table. This is intentionally conservative — when the platform-admin
//     tier lands, its gate replaces requireRole('owner') here.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { platformCatalogService } from '@sparx/builder';
import {
  PlatformComponentKind,
  PlatformComponentCategory,
  PlatformComponentStatus,
} from '@sparx/builder-schemas';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';

const IdParam = z.object({ id: z.string().min(1) });
// Filters reuse the shared catalog vocabulary (one source of truth, docs/98 §5).
const ListQuery = z.object({
  kind: PlatformComponentKind.optional(),
  category: PlatformComponentCategory.optional(),
  tags: z.string().optional(), // comma-separated
  status: PlatformComponentStatus.optional(),
});

const catalogRoutes: FastifyPluginAsync = (app) => {
  // ── Public reads (published only) ─────────────────────────────────────────

  app.get('/v1/platform/catalog', async (request) => {
    requireRole(request, 'viewer');
    const { kind, category, tags } = ListQuery.parse(request.query);
    const components = await platformCatalogService.listPublished({
      kind,
      category,
      tags: tags
        ? tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined,
    });
    return ok({ components });
  });

  app.get('/v1/platform/catalog/:id', async (request) => {
    requireRole(request, 'viewer');
    const { id } = IdParam.parse(request.params);
    return ok(await platformCatalogService.getPublishedByKey(id));
  });

  // ── Admin reads (any status) ───────────────────────────────────────────────

  app.get('/v1/platform/catalog/admin', async (request) => {
    requireRole(request, 'owner');
    const { kind, status } = ListQuery.parse(request.query);
    const components = await platformCatalogService.listAll({ kind, status });
    return ok({ components });
  });

  app.get('/v1/platform/catalog/admin/:id', async (request) => {
    requireRole(request, 'owner');
    const { id } = IdParam.parse(request.params);
    return ok(await platformCatalogService.getById(id));
  });

  // ── Writes (owner) ────────────────────────────────────────────────────────

  app.post('/v1/platform/catalog', async (request) => {
    const auth = requireRole(request, 'owner');
    const component = await platformCatalogService.create(auth.actorId, request.body);
    return ok(component);
  });

  app.patch('/v1/platform/catalog/:id', async (request) => {
    requireRole(request, 'owner');
    const { id } = IdParam.parse(request.params);
    return ok(await platformCatalogService.update(id, request.body));
  });

  app.delete('/v1/platform/catalog/:id', async (request) => {
    requireRole(request, 'owner');
    const { id } = IdParam.parse(request.params);
    await platformCatalogService.remove(id);
    return ok({ id });
  });

  // ── Lifecycle transitions (owner) ─────────────────────────────────────────

  app.post('/v1/platform/catalog/:id/submit', async (request) => {
    const auth = requireRole(request, 'owner');
    const { id } = IdParam.parse(request.params);
    return ok(await platformCatalogService.submit(id, auth.actorId));
  });

  app.post('/v1/platform/catalog/:id/review', async (request) => {
    const auth = requireRole(request, 'owner');
    const { id } = IdParam.parse(request.params);
    return ok(await platformCatalogService.startReview(id, auth.actorId));
  });

  app.post('/v1/platform/catalog/:id/approve', async (request) => {
    const auth = requireRole(request, 'owner');
    const { id } = IdParam.parse(request.params);
    return ok(await platformCatalogService.approve(id, auth.actorId));
  });

  app.post('/v1/platform/catalog/:id/publish', async (request) => {
    const auth = requireRole(request, 'owner');
    const { id } = IdParam.parse(request.params);
    return ok(await platformCatalogService.publish(id, auth.actorId));
  });

  app.post('/v1/platform/catalog/:id/archive', async (request) => {
    const auth = requireRole(request, 'owner');
    const { id } = IdParam.parse(request.params);
    return ok(await platformCatalogService.archive(id, auth.actorId));
  });

  app.post('/v1/platform/catalog/:id/reject', async (request) => {
    const auth = requireRole(request, 'owner');
    const { id } = IdParam.parse(request.params);
    return ok(await platformCatalogService.reject(id, auth.actorId));
  });

  return Promise.resolve();
};

export default catalogRoutes;
