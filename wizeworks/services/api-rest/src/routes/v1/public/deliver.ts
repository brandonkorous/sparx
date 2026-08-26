// Gated delivery — the download half (docs/151 §7, docs/152 C4).
//
//   GET /v1/public/deliver/:token → stream the gated asset the token names
//
// "Give us your email and we will send you the guide" is only an exchange if the
// guide is genuinely behind the email. So the asset lives in the PRIVATE bucket
// and this route streams it, exactly as the staff attachment route already does;
// the only difference is what authorizes the read. There is no session here — an
// anonymous visitor clicking a link in their inbox — so the SIGNED TOKEN is the
// authorization, and it carries the storage key rather than accepting one.
//
// That last point is the whole security of it: nothing in the request names an
// object. The key is inside the HMAC-signed payload, so a visitor cannot walk the
// bucket by editing a URL, and a token minted for one asset cannot be pointed at
// another without invalidating its own signature.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { badRequest, notFound } from '@wizeworks/api-core/errors';
import { getStorage } from '../../../lib/storage.js';
import { verifyGatedDeliveryToken } from '../../../lib/gated-delivery-token.js';

const Params = z.object({ token: z.string().min(1).max(4096) });

const publicDeliverRoutes: FastifyPluginAsync = (app) => {
  app.get(
    '/v1/public/deliver/:token',
    {
      // Generous — one person may legitimately re-download a guide a few times,
      // on a laptop and then a phone. Bounded so a leaked link cannot be turned
      // into a bandwidth bill.
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { token } = Params.parse(request.params);
      const verified = verifyGatedDeliveryToken(token);

      if (!verified.ok) {
        // An EXPIRED link gets a real explanation, because the person holding it
        // did nothing wrong — they saved the email and came back too late, and
        // the remedy (ask again on the site) is one they can act on. Anything
        // else gets a flat not-found: a forged or malformed token should learn
        // nothing about whether the object it guessed at exists.
        if (verified.reason === 'expired') {
          throw badRequest(
            'This download link has run out. Ask for it again on the site and we will send a fresh one.'
          );
        }
        throw notFound('Download', 'link');
      }

      const { claims } = verified;
      const obj = await getStorage()
        .readObject(claims.key)
        .catch(() => null);
      // A validly-signed token for an object the tenant has since deleted. Not an
      // error on the visitor's part, so it reads as a missing file rather than a
      // rejected link.
      if (!obj) throw notFound('Download', claims.name);

      // Forced download, never inline: the tenant chose this file, but it is
      // served from our origin to an anonymous visitor, and an inline-rendered
      // HTML or SVG would run as us. `no-store` keeps a shared proxy from
      // caching one person's gated asset for the next.
      // First NON-EMPTY of the three. `??` would keep an empty string, and a
      // content-type of '' is how a browser ends up guessing at a file it was
      // told nothing about.
      const contentType =
        [claims.mime, obj.contentType].find((t) => t != null && t.length > 0) ??
        'application/octet-stream';
      reply
        .header('content-type', contentType)
        .header('content-disposition', `attachment; filename="${claims.name}"`)
        .header('cache-control', 'private, no-store')
        .header('x-content-type-options', 'nosniff');
      if (obj.size !== null) reply.header('content-length', String(obj.size));
      return reply.send(obj.body);
    }
  );

  return Promise.resolve();
};

export default publicDeliverRoutes;
