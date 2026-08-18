// Partner Bootcamp management API (docs/114 §B.7/B.8). Scoped to the active org;
// only active partners may host. Hosting bootcamps is part of operating the
// practice, so every route — read and write — is gated to the `PARTNER_OPS`
// capability set {owner, admin, partner} via `requireAnyRole` (docs/114 §B.7),
// NOT the coarse role hierarchy. Publishing is further gated to the Certified
// tier inside the service.
//
//   GET    /v1/partner/bootcamps          POST /v1/partner/bootcamps
//   GET    /v1/partner/bootcamps/:id       PUT  /v1/partner/bootcamps/:id
//   PATCH  /v1/partner/bootcamps/:id/status
//   DELETE /v1/partner/bootcamps/:id       (draft only)

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { ok } from '@wizeworks/api-core/envelope';
import { requireAnyRole, type StaffRole } from '@wizeworks/api-core/auth';

import { bootcampService } from '../../../lib/partners/bootcamp-service.js';
import { toPartnerContext } from '../../../lib/partners/service.js';

const IdParam = z.object({ id: z.string().uuid() });

// Mirrors PARTNER_OPS in ./index.ts — the practice-operator capability set.
const PARTNER_OPS: readonly StaffRole[] = ['owner', 'admin', 'partner'];

const partnerBootcampRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/partner/bootcamps', async (request) => {
    requireAnyRole(request, PARTNER_OPS);
    const items = await bootcampService.list(toPartnerContext(request));
    return ok(items);
  });

  app.post('/v1/partner/bootcamps', async (request) => {
    requireAnyRole(request, PARTNER_OPS);
    const bootcamp = await bootcampService.create(toPartnerContext(request), request.body);
    return ok(bootcamp);
  });

  app.get('/v1/partner/bootcamps/:id', async (request) => {
    requireAnyRole(request, PARTNER_OPS);
    const { id } = IdParam.parse(request.params);
    const bootcamp = await bootcampService.get(toPartnerContext(request), id);
    return ok(bootcamp);
  });

  app.put('/v1/partner/bootcamps/:id', async (request) => {
    requireAnyRole(request, PARTNER_OPS);
    const { id } = IdParam.parse(request.params);
    const bootcamp = await bootcampService.update(toPartnerContext(request), id, request.body);
    return ok(bootcamp);
  });

  app.patch('/v1/partner/bootcamps/:id/status', async (request) => {
    requireAnyRole(request, PARTNER_OPS);
    const { id } = IdParam.parse(request.params);
    const bootcamp = await bootcampService.setStatus(toPartnerContext(request), id, request.body);
    return ok(bootcamp);
  });

  app.delete('/v1/partner/bootcamps/:id', async (request) => {
    requireAnyRole(request, PARTNER_OPS);
    const { id } = IdParam.parse(request.params);
    const result = await bootcampService.remove(toPartnerContext(request), id);
    return ok(result);
  });

  return Promise.resolve();
};

export default partnerBootcampRoutes;
