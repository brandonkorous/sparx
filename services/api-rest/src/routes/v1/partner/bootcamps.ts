// Partner Bootcamp management API (docs/114 §B.7/B.8). Scoped to the active org;
// only active partners may host. Reads need `viewer`; create/edit/status need
// `editor` (content authoring). Publishing is further gated to the Certified tier
// inside the service.
//
//   GET    /v1/partner/bootcamps          POST /v1/partner/bootcamps
//   GET    /v1/partner/bootcamps/:id       PUT  /v1/partner/bootcamps/:id
//   PATCH  /v1/partner/bootcamps/:id/status
//   DELETE /v1/partner/bootcamps/:id       (draft only)

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';

import { bootcampService } from '../../../lib/partners/bootcamp-service.js';
import { toPartnerContext } from '../../../lib/partners/service.js';

const IdParam = z.object({ id: z.string().uuid() });

const partnerBootcampRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/partner/bootcamps', async (request) => {
    requireRole(request, 'viewer');
    const items = await bootcampService.list(toPartnerContext(request));
    return ok(items);
  });

  app.post('/v1/partner/bootcamps', async (request) => {
    requireRole(request, 'editor');
    const bootcamp = await bootcampService.create(toPartnerContext(request), request.body);
    return ok(bootcamp);
  });

  app.get('/v1/partner/bootcamps/:id', async (request) => {
    requireRole(request, 'viewer');
    const { id } = IdParam.parse(request.params);
    const bootcamp = await bootcampService.get(toPartnerContext(request), id);
    return ok(bootcamp);
  });

  app.put('/v1/partner/bootcamps/:id', async (request) => {
    requireRole(request, 'editor');
    const { id } = IdParam.parse(request.params);
    const bootcamp = await bootcampService.update(toPartnerContext(request), id, request.body);
    return ok(bootcamp);
  });

  app.patch('/v1/partner/bootcamps/:id/status', async (request) => {
    requireRole(request, 'editor');
    const { id } = IdParam.parse(request.params);
    const bootcamp = await bootcampService.setStatus(toPartnerContext(request), id, request.body);
    return ok(bootcamp);
  });

  app.delete('/v1/partner/bootcamps/:id', async (request) => {
    requireRole(request, 'editor');
    const { id } = IdParam.parse(request.params);
    const result = await bootcampService.remove(toPartnerContext(request), id);
    return ok(result);
  });

  return Promise.resolve();
};

export default partnerBootcampRoutes;
