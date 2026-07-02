// PUBLIC Bootcamp directory + detail + RSVP (docs/114 §B.6/B.8). Unauthenticated,
// no-tenant (the `/v1/public/` prefix skips auth). Directory + detail run under
// withSystem so `bootcamps_visibility` shows only published cohorts.
//
//   GET  /v1/public/bootcamps                  → faceted, paged directory
//   GET  /v1/public/bootcamps/:slug            → one published cohort (detail)
//   POST /v1/public/bootcamps/:slug/register   → on-platform RSVP → host CRM lead

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { ok } from '@sparx/api-core/envelope';
import { notFound } from '@sparx/api-core/errors';

import { directoryService } from '../../../lib/partners/directory.js';
import { bootcampService } from '../../../lib/partners/bootcamp-service.js';

const SlugParam = z.object({ slug: z.string().min(1).max(160) });

const publicBootcampRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/public/bootcamps', async (request) => {
    const result = await directoryService.listBootcamps(request.query as Record<string, unknown>);
    return ok(result);
  });

  app.get('/v1/public/bootcamps/:slug', async (request) => {
    const { slug } = SlugParam.parse(request.params);
    const bootcamp = await directoryService.getBootcamp(slug);
    if (!bootcamp) throw notFound('Bootcamp', slug);
    return ok(bootcamp);
  });

  app.post('/v1/public/bootcamps/:slug/register', async (request) => {
    const { slug } = SlugParam.parse(request.params);
    const result = await bootcampService.register(slug, request.body);
    return ok(result);
  });

  return Promise.resolve();
};

export default publicBootcampRoutes;
