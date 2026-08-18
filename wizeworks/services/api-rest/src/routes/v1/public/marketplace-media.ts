// Public marketplace media (docs/85 §6) — serves the world-readable catalog card
// imagery (icon.png, preview.png, screenshots) the ingest copied to storage.
//
//   GET /v1/public/marketplace/media/:category/:slug/:filename
//
// Like the variants route, api-rest pipes the bytes itself: the org forbids
// allUsers on the GCS bucket, so the object lives private and Cloudflare (in front
// of api.sparx.works) absorbs repeat traffic. No auth — catalog imagery is public.
// Keys are first-party + deterministic, so there's nothing to enumerate.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { notFound } from '@wizeworks/api-core/errors';

import { getStorage, marketplaceMediaKey } from '../../../lib/storage.js';

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

const PathParams = z.object({
  category: z.enum(['themes', 'components', 'blueprints', 'integrations']),
  slug: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9][a-z0-9-]*$/),
  filename: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9][a-z0-9._-]*\.(png|jpg|jpeg|webp|svg)$/i),
});

const marketplaceMediaRoutes: FastifyPluginAsync = (app) => {
  app.get<{ Params: z.infer<typeof PathParams> }>(
    '/v1/public/marketplace/media/:category/:slug/:filename',
    async (request, reply) => {
      const { category, slug, filename } = PathParams.parse(request.params);
      const ext = filename.split('.').pop()!.toLowerCase();

      let obj;
      try {
        obj = await getStorage().readObject(marketplaceMediaKey(category, slug, filename));
      } catch {
        throw notFound('MarketplaceMedia', `${category}/${slug}/${filename}`);
      }

      // Marketplace media is replaced by a new version bump, not mutated in place,
      // so cache hard — Cloudflare serves every repeat from the edge.
      reply
        .header('cache-control', 'public, max-age=31536000, immutable')
        .header(
          'content-type',
          CONTENT_TYPES[ext] ?? obj.contentType ?? 'application/octet-stream'
        );
      if (obj.size !== null) reply.header('content-length', String(obj.size));

      return reply.send(obj.body);
    }
  );

  return Promise.resolve();
};

export default marketplaceMediaRoutes;
