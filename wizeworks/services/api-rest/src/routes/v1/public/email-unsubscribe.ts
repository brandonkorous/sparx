// One-click unsubscribe endpoint (docs/91 §8). Public — the signed token IS the
// auth, so it lives under /v1/public/ (the auth plugin treats it as unauthenticated).
//
//   GET  /v1/public/email/unsubscribe?token=…   → human click (renders a page)
//   POST /v1/public/email/unsubscribe?token=…   → RFC 8058 List-Unsubscribe-Post
//                                                  one-click (mail clients; no body)
//
// Both verify the HMAC token, then add a `marketing`-scope EmailSuppression for the
// (tenant, email) it encodes — exactly what enqueueSend checks before a marketing
// send. Idempotent (suppressionService.add upserts). Always 200 with a small page;
// an invalid/old token still 200s with a neutral message (never leak validity).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { suppressionService } from '@wizeworks/email-platform';

import { verifyUnsubscribeToken } from '../../../lib/email-unsubscribe.js';

const Query = z.object({ token: z.string().min(1).max(2048) });

function page(message: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Unsubscribe</title><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}main{max-width:28rem;padding:2.5rem;background:#fff;border:1px solid #e2e8f0;border-radius:12px;text-align:center}h1{font-size:1.25rem;margin:0 0 .5rem}p{margin:0;color:#475569;line-height:1.5}</style></head><body><main><h1>You're unsubscribed</h1><p>${message}</p></main></body></html>`;
}

async function handle(
  token: string,
  log: { error: (o: unknown, m?: string) => void }
): Promise<void> {
  const decoded = verifyUnsubscribeToken(token);
  if (!decoded) return; // invalid/old token — neutral page, no write.
  try {
    await suppressionService.add(
      { tenantId: decoded.tenantId },
      { email: decoded.email, scope: 'marketing', reason: 'unsubscribe', note: 'one-click link' }
    );
  } catch (err) {
    // A bad email or already-suppressed address must not 500 the click.
    log.error({ err }, 'email-unsubscribe: failed to record suppression');
  }
}

const emailUnsubscribeRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/public/email/unsubscribe', async (request, reply) => {
    const { token } = Query.parse(request.query);
    await handle(token, request.log);
    return reply
      .type('text/html')
      .send(page('You will no longer receive marketing emails at this address.'));
  });

  // RFC 8058 one-click: mail clients POST with no/ignored body.
  app.post('/v1/public/email/unsubscribe', async (request, reply) => {
    const { token } = Query.parse(request.query);
    await handle(token, request.log);
    return reply.type('text/html').send(page('Unsubscribed.'));
  });

  return Promise.resolve();
};

export default emailUnsubscribeRoutes;
