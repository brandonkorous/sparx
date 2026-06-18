// Saved views — platform list-persistence routes (docs/24 shell, docs/104).
//
//   GET    /v1/views?target=<key>   → list views the caller can see for a list
//   POST   /v1/views                → create
//   PATCH  /v1/views/:id            → update (name / config / isDefault)
//   POST   /v1/views/:id/default    → make default for its target
//   DELETE /v1/views/:id            → delete
//
// Platform shell state — NOT module-gated; any logged-in staff member reads,
// `editor`+ writes. Tenant + ownership scoping live in the service.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import type { TenantContext } from '@sparx/db';

import {
  CreateSavedViewInput,
  UpdateSavedViewInput,
  create,
  list,
  remove,
  setDefault,
  update,
} from '../../../lib/saved-views.js';

const PathId = z.object({ id: z.string().uuid() });
const ListQuery = z.object({ target: z.string().min(1).max(63) });

function ctxOf(auth: { tenantId: string; actorId?: string }): TenantContext {
  return { tenantId: auth.tenantId, userId: auth.actorId };
}

const savedViewsRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/views', async (request) => {
    const auth = requireRole(request, 'viewer');
    const { target } = ListQuery.parse(request.query);
    return ok(await list(ctxOf(auth), target));
  });

  app.post('/v1/views', async (request, reply) => {
    const auth = requireRole(request, 'editor');
    const input = CreateSavedViewInput.parse(request.body);
    const created = await create(ctxOf(auth), input);
    reply.code(201);
    return ok(created);
  });

  app.patch('/v1/views/:id', async (request) => {
    const auth = requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    const input = UpdateSavedViewInput.parse(request.body);
    return ok(await update(ctxOf(auth), id, input));
  });

  app.post('/v1/views/:id/default', async (request) => {
    const auth = requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    return ok(await setDefault(ctxOf(auth), id));
  });

  app.delete('/v1/views/:id', async (request, reply) => {
    const auth = requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    await remove(ctxOf(auth), id);
    reply.code(204);
  });

  return Promise.resolve();
};

export default savedViewsRoutes;
