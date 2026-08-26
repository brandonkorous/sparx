// Inbound SMS — the STOP handler (docs/151 §8, docs/152 D1).
//
//   POST /v1/public/sms/inbound?tenant=<slug>  → a reply from a recipient
//
// This is the half of SMS that is not optional. A suppression table nothing
// writes to is a compliance story rather than a compliance control, and "we
// built STOP" while every STOP falls on the floor is worse than not claiming it,
// because everyone stops looking.
//
// ── WHAT COUNTS AS STOP ──────────────────────────────────────────────────────
//
// The carrier-mandated keywords, matched loosely: case-insensitive, trimmed, and
// ignoring trailing punctuation. Somebody typing "Stop." or "STOP " has opted
// out, and a handler that only matched the exact byte string `STOP` would keep
// texting them. The carriers themselves also intercept these before we ever see
// them, which is precisely why our copy must agree with theirs: if the network
// stops delivering and our list does not know, every later send is paid for and
// silently dropped.
//
// START / UNSTOP re-open. HELP is answered by the carrier, not by us.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@wizeworks/db';
import { ok } from '@wizeworks/api-core/envelope';
import { notFound } from '@wizeworks/api-core/errors';
import { suppressNumber, unsuppressNumber } from '@wizeworks/sms/delivery';

const Query = z.object({ tenant: z.string().min(1).max(63) });

// Twilio posts form-encoded `From` / `Body`; the shape is normalized here so a
// second provider is a mapping rather than a second route.
const Body = z
  .object({
    From: z.string().min(1).max(32).optional(),
    Body: z.string().max(1600).optional(),
    from: z.string().min(1).max(32).optional(),
    body: z.string().max(1600).optional(),
  })
  .passthrough();

const STOP_WORDS = new Set(['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit', 'revoke']);
const START_WORDS = new Set(['start', 'unstop', 'yes']);

/** The first word, lowercased, stripped of the punctuation people type. */
function keyword(text: string): string {
  return (
    text
      .trim()
      .split(/\s+/)[0]
      ?.replace(/[^a-z]/gi, '')
      .toLowerCase() ?? ''
  );
}

const publicSmsInboundRoutes: FastifyPluginAsync = (app) => {
  app.post(
    '/v1/public/sms/inbound',
    {
      config: { rateLimit: { max: 300, timeWindow: '1 minute' } },
    },
    async (request) => {
      const q = Query.parse(request.query);
      const body = Body.parse(request.body ?? {});
      const from = body.From ?? body.from ?? '';
      const text = body.Body ?? body.body ?? '';

      const tenant = await prisma.tenant.findUnique({
        where: { slug: q.tenant },
        select: { id: true },
      });
      if (!tenant) throw notFound('Tenant', q.tenant);
      if (!from) return ok({ received: true, action: 'ignored' });

      const word = keyword(text);
      const ctx = { tenantId: tenant.id };

      if (STOP_WORDS.has(word)) {
        await suppressNumber(ctx, {
          phone: from,
          reason: 'stop',
          source: 'carrier',
          note: `Replied "${text.slice(0, 100)}"`,
        });
        request.log.info({ tenantId: tenant.id }, 'sms: STOP recorded');
        return ok({ received: true, action: 'suppressed' });
      }

      if (START_WORDS.has(word)) {
        await unsuppressNumber(ctx, from);
        request.log.info({ tenantId: tenant.id }, 'sms: START recorded');
        return ok({ received: true, action: 'resumed' });
      }

      // Anything else is a person replying to a business, which is a
      // conversation this route deliberately does not try to be. It is
      // acknowledged so the carrier stops retrying, and logged so it is
      // findable — routing replies into the CRM inbox is its own slice, and
      // pretending otherwise here would silently swallow customer messages.
      request.log.info({ tenantId: tenant.id }, 'sms: inbound reply, not a keyword');
      return ok({ received: true, action: 'ignored' });
    }
  );

  return Promise.resolve();
};

export default publicSmsInboundRoutes;
