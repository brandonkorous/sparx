// Saved views — the PLATFORM list-persistence surface (docs/24, docs/146 Phase 10.2).
//
//   GET    /v1/saved-views?target=      → shared views + the caller's own
//   POST   /v1/saved-views              → save one
//   PATCH  /v1/saved-views/:id          → rename / re-point / make default
//   POST   /v1/saved-views/:id/default  → make it the one this list opens on
//   DELETE /v1/saved-views/:id
//
// ── Why this exists at the platform level and not per module ─────────────────
//
// The service and the table have been here since docs/24; what was missing was
// a route, because the shared `ListToolbar` that would have called it belonged
// to `apps/dashboard` and went with it. CRM grew its own (`/v1/crm/saved-views`,
// over its own `crm_saved_views` table) for reasons of its own — an object-key
// vocabulary and per-site scoping that no other list has.
//
// Everything else shares this one. `target` is just a list identity, so nothing
// here is inventory-specific and nothing needs to be: the moment a commerce or
// invoicing list wants saved views it passes its own target and is done. Making
// this an inventory route would have meant a second copy the first time anything
// else asked, which is the shape of problem the saved-view PRESETS already have
// (they seed by module and are read by nothing).
//
// Not module-gated — this is shell state, the sibling of favourites and recents.
// A `viewer` may save a view: filtering a list you are allowed to read, and
// naming that filter, is not a privileged act.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { FastifyRequest } from 'fastify';
import type { TenantContext } from '@wizeworks/db';
import { ok } from '@wizeworks/api-core/envelope';
import { requireAuth, requireRole } from '@wizeworks/api-core/auth';
import {
  CreateSavedViewInput,
  UpdateSavedViewInput,
  create,
  list,
  remove,
  setDefault,
  update,
} from '../../lib/saved-views.js';

function toTenantContext(request: FastifyRequest): TenantContext {
  const auth = requireAuth(request);
  return { tenantId: auth.tenantId, userId: auth.actorId };
}

const IdPath = z.object({ id: z.string().uuid() });
const ListQuery = z.object({ target: z.string().min(1).max(63) });

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const savedViewRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/saved-views', async (request) => {
    requireRole(request, 'viewer');
    const { target } = ListQuery.parse(request.query);
    return ok({ items: await list(toTenantContext(request), target) });
  });

  app.post('/v1/saved-views', async (request, reply) => {
    requireRole(request, 'viewer');
    const input = CreateSavedViewInput.parse(request.body);
    return reply.status(201).send(ok(await create(toTenantContext(request), input)));
  });

  app.patch('/v1/saved-views/:id', async (request) => {
    requireRole(request, 'viewer');
    const { id } = IdPath.parse(request.params);
    const input = UpdateSavedViewInput.parse(request.body);
    return ok(await update(toTenantContext(request), id, input));
  });

  app.post('/v1/saved-views/:id/default', async (request) => {
    requireRole(request, 'viewer');
    const { id } = IdPath.parse(request.params);
    return ok(await setDefault(toTenantContext(request), id));
  });

  app.delete('/v1/saved-views/:id', async (request, reply) => {
    requireRole(request, 'viewer');
    const { id } = IdPath.parse(request.params);
    await remove(toTenantContext(request), id);
    return reply.status(204).send();
  });
};

export default savedViewRoutes;
