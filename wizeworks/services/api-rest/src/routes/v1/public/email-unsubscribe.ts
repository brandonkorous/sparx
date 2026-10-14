// One-click unsubscribe endpoint (docs/91 §8). Public — the signed token IS the
// auth, so it lives under /v1/public/ (the auth plugin treats it as unauthenticated).
//
//   GET  /v1/public/email/unsubscribe?token=…   → a person opened the link: a page
//                                                  that ASKS, naming the business and
//                                                  the address, with one button
//   POST /v1/public/email/unsubscribe?token=…   → that button, or a mail app's own
//                                                  RFC 8058 one-click Unsubscribe
//
// The POST verifies the HMAC token, then adds a `marketing`-scope EmailSuppression
// for the (tenant, email) it encodes — exactly what enqueueSend checks before a
// marketing send. Idempotent (suppressionService.add upserts).
//
// Two faults this route had (piggles persona issue 983):
//   • The GET unsubscribed on OPEN. Mail scanners open every link in an email, so a
//     reader could be taken off a list without choosing to. RFC 8058 makes the GET
//     safe and the POST the act; the GET now only asks.
//   • The POST refused what mail apps send. RFC 8058 clients (Gmail, Apple Mail,
//     Yahoo) post `List-Unsubscribe=One-Click` as `application/x-www-form-urlencoded`,
//     which Fastify has no parser for, so every one of them got a 415 and the reader
//     stayed on the list. The parser is added in THIS plugin's scope only; the body
//     says nothing the token does not, so it is read and ignored.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma, withTenant } from '@wizeworks/db';
import { suppressionService } from '@wizeworks/email-platform';

import { verifyUnsubscribeToken } from '../../../lib/email-unsubscribe.js';
import {
  unreadableLinkPage,
  unsubscribeAskPage,
  unsubscribedPage,
  type UnsubscribeSubject,
} from '../../../lib/unsubscribe-page.js';

const Query = z.object({ token: z.string().min(1).max(2048) });

const PATH = '/v1/public/email/unsubscribe';

/** Who the reader is leaving, read from the token: the business's name and their
 *  address. Null when the token is not one of ours. */
async function subjectOf(
  token: string
): Promise<(UnsubscribeSubject & { tenantId: string; broadcastId: string | null }) | null> {
  const decoded = verifyUnsubscribeToken(token);
  if (!decoded) return null;
  const tenant = await prisma.tenant.findUnique({
    where: { id: decoded.tenantId },
    select: { name: true },
  });
  const business = tenant?.name.trim() ? tenant.name.trim() : null;
  return {
    tenantId: decoded.tenantId,
    email: decoded.email,
    broadcastId: decoded.broadcastId,
    business,
  };
}

/**
 * Count the unsubscribe against the campaign the link came from: one `unsubscribed`
 * event per reader per campaign, which is what the campaign's "Unsubscribed" reads.
 * Our own link wrote only the do-not-email row, so that figure read 0 however many
 * readers left (piggles persona issue 985). The campaign is looked up under the
 * token's own business, so a link can only ever count against that business's own.
 */
async function countAgainstCampaign(
  tenantId: string,
  broadcastId: string,
  email: string
): Promise<void> {
  await withTenant({ tenantId }, async (tx) => {
    const campaign = await tx.broadcast.findUnique({
      where: { id: broadcastId },
      select: { id: true, propertyId: true },
    });
    if (!campaign) return;
    const already = await tx.emailEvent.findFirst({
      where: { broadcastId, recipient: email, type: 'unsubscribed' },
      select: { id: true },
    });
    if (already) return;
    await tx.emailEvent.create({
      data: {
        tenantId,
        propertyId: campaign.propertyId,
        broadcastId,
        recipient: email,
        type: 'unsubscribed',
        reason: 'unsubscribe link',
        occurredAt: new Date(),
      },
    });
  });
}

const emailUnsubscribeRoutes: FastifyPluginAsync = (app) => {
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_req, body, done) => {
      done(null, body);
    }
  );

  app.get(PATH, async (request, reply) => {
    const { token } = Query.parse(request.query);
    const subject = await subjectOf(token);
    reply.header('Cache-Control', 'no-store');
    if (!subject) return reply.type('text/html').send(unreadableLinkPage());
    return reply
      .type('text/html')
      .send(unsubscribeAskPage(subject, `${PATH}?token=${encodeURIComponent(token)}`));
  });

  app.post(PATH, async (request, reply) => {
    const { token } = Query.parse(request.query);
    const subject = await subjectOf(token);
    reply.header('Cache-Control', 'no-store');
    if (!subject) return reply.type('text/html').send(unreadableLinkPage());
    try {
      await suppressionService.add(
        { tenantId: subject.tenantId },
        { email: subject.email, scope: 'marketing', reason: 'unsubscribe', note: 'one-click link' }
      );
    } catch (err) {
      // A bad email or already-suppressed address must not 500 the click.
      request.log.error({ err }, 'email-unsubscribe: failed to record suppression');
    }
    if (subject.broadcastId) {
      try {
        await countAgainstCampaign(subject.tenantId, subject.broadcastId, subject.email);
      } catch (err) {
        // The reader is off the list either way; a missed count must not 500 them.
        request.log.error({ err }, 'email-unsubscribe: failed to count against campaign');
      }
    }
    return reply.type('text/html').send(unsubscribedPage(subject));
  });

  return Promise.resolve();
};

export default emailUnsubscribeRoutes;
