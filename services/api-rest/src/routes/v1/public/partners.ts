// PUBLIC Partner directory + application (docs/114 §B.6/B.8). Unauthenticated,
// no-tenant — the `/v1/public/` prefix skips Bearer auth (app.ts). The directory
// runs under withSystem so the `partners_visibility` RLS policy shows only active
// partners; the app layer further filters directory_visible.
//
//   GET  /v1/public/partners            → faceted, paged directory
//   GET  /v1/public/partners/:id        → one public profile
//   POST /v1/public/partners/apply      → submit an application (informal auto-approves)

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ok } from '@sparx/api-core/envelope';
import { notFound } from '@sparx/api-core/errors';

import { directoryService } from '../../../lib/partners/directory.js';
import { partnerService } from '../../../lib/partners/service.js';

const IdParam = z.object({ id: z.string().uuid() });

function clientMeta(request: FastifyRequest): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  const fwd = request.headers['x-forwarded-for'];
  const ip = Array.isArray(fwd) ? fwd[0] : (fwd ?? request.ip);
  const ua = request.headers['user-agent'];
  const first = (ip ?? '').split(',')[0]?.trim();
  return {
    ipAddress: first && first.length > 0 ? first : null,
    userAgent: typeof ua === 'string' ? ua : null,
  };
}

const publicPartnerRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/public/partners', async (request) => {
    const result = await directoryService.listPartners(request.query as Record<string, unknown>);
    return ok(result);
  });

  app.get('/v1/public/partners/:id', async (request) => {
    const { id } = IdParam.parse(request.params);
    const partner = await directoryService.getPartner(id);
    if (!partner) throw notFound('Partner', id);
    return ok(partner);
  });

  app.post('/v1/public/partners/apply', async (request) => {
    const result = await partnerService.submitApplication(request.body, clientMeta(request));
    return ok(result);
  });

  return Promise.resolve();
};

export default publicPartnerRoutes;
