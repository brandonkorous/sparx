// Meta platform callbacks for the social module (docs/133 §6) — the two endpoints
// every Meta app MUST expose before App Review will pass, and which Meta calls
// on its own schedule with no bearer token:
//
//   POST /v1/public/social/meta/deauthorize   → a user removed sparx from their
//                                               Facebook/Instagram/Threads account
//   POST /v1/public/social/meta/data-deletion → a user requested deletion of the
//                                               data sparx holds about them
//
// Public by path (`/v1/public/`), exactly like the Mailgun receiver: the
// `signed_request` HMAC IS the authentication. Meta posts it form-encoded as
// `<base64url signature>.<base64url payload>`, signed HMAC-SHA256 with the app
// secret. An unverifiable request is rejected — never trusted, never acted on.
//
// Facebook/Instagram share META_APP_SECRET; Threads has its own THREADS_APP_SECRET
// (a separate app registration — see adapters/threads.ts). Meta does not tell us
// WHICH app called, so we accept a signature from either secret and act on the
// platforms that secret governs. That is not a widening: a valid signature already
// proves possession of one of our own app secrets.
//
// Both handlers are idempotent and always answer 200 on a valid signature — Meta
// retries otherwise, and a duplicate deauthorize is a no-op once the grant is gone.

import crypto from 'node:crypto';

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withSystem } from '@sparx/db';
import type { SocialPlatform } from '@sparx/social';
import { ApiError } from '@sparx/api-core/errors';

/** Platforms each app secret is authoritative for. */
const META_PLATFORMS: SocialPlatform[] = ['facebook_page', 'instagram'];
const THREADS_PLATFORMS: SocialPlatform[] = ['threads'];

const SignedRequestBody = z.object({ signed_request: z.string().min(1) });

interface SignedRequestPayload {
  user_id?: string;
  algorithm?: string;
  issued_at?: number;
}

/** base64url → Buffer (Meta omits padding). */
function fromBase64Url(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/**
 * Verify + decode a Meta `signed_request` against ONE app secret. Returns null when
 * the signature does not match, so the caller can try the other secret without
 * distinguishing "wrong app" from "forged".
 */
export function decodeSignedRequest(signed: string, secret: string): SignedRequestPayload | null {
  const [sigPart, payloadPart] = signed.split('.');
  if (!sigPart || !payloadPart) return null;

  const expected = crypto.createHmac('sha256', secret).update(payloadPart).digest();
  const actual = fromBase64Url(sigPart);
  // Length check first: timingSafeEqual throws on a length mismatch.
  if (actual.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(actual, expected)) return null;

  let payload: SignedRequestPayload;
  try {
    payload = JSON.parse(fromBase64Url(payloadPart).toString('utf8')) as SignedRequestPayload;
  } catch {
    return null;
  }
  // Meta only ever signs these with HMAC-SHA256; anything else is a downgrade attempt.
  if (payload.algorithm && payload.algorithm.toUpperCase() !== 'HMAC-SHA256') return null;
  return payload;
}

interface VerifiedRequest {
  userId: string;
  platforms: SocialPlatform[];
}

/**
 * Verify against whichever of our Meta app secrets signed the request, and report
 * which platforms that app governs. Throws when no configured secret matches.
 */
function verifyMetaRequest(signed: string): VerifiedRequest {
  const candidates: Array<{ secret: string | undefined; platforms: SocialPlatform[] }> = [
    { secret: process.env.META_APP_SECRET, platforms: META_PLATFORMS },
    { secret: process.env.THREADS_APP_SECRET, platforms: THREADS_PLATFORMS },
  ];

  for (const { secret, platforms } of candidates) {
    if (!secret) continue;
    const payload = decodeSignedRequest(signed, secret);
    if (payload?.user_id) return { userId: payload.user_id, platforms };
  }
  throw new ApiError('FORBIDDEN', 'Invalid Meta signed_request.');
}

/**
 * Revoke every Meta connection belonging to this external user id, across all
 * tenants. Cross-tenant by necessity — Meta identifies the person, not the tenant —
 * so it runs under `withSystem` and is narrowed by (platform, externalId), never by
 * externalId alone. Targets cascade with the connection.
 *
 * Returns the number of connections removed, for the log line.
 */
async function revokeMetaConnections(userId: string, platforms: SocialPlatform[]): Promise<number> {
  return withSystem(async (tx) => {
    const { count } = await tx.socialConnection.deleteMany({
      where: { platform: { in: platforms }, externalId: userId },
    });
    return count;
  });
}

const socialMetaCallbackRoutes: FastifyPluginAsync = async (app) => {
  // A user removed the app from their Meta account. The grant is already dead on
  // Meta's side, so the honest thing is to drop our copy rather than let the tenant
  // keep seeing a "connected" account that can no longer publish.
  app.post('/v1/public/social/meta/deauthorize', async (request, reply) => {
    const { signed_request: signed } = SignedRequestBody.parse(request.body);
    const { userId, platforms } = verifyMetaRequest(signed);

    const removed = await revokeMetaConnections(userId, platforms);
    request.log.info(
      { platforms, removed },
      'Meta deauthorize callback — removed social connections'
    );

    // Meta ignores the body; 200 is the whole contract.
    return reply.status(200).send({ success: true });
  });

  // A user asked Meta to delete the data we hold about them. Deleting the grant IS
  // the deletion — a SocialConnection holds only the account's own id/display name
  // plus our encrypted tokens; sparx stores no other Meta-sourced personal data.
  // Published posts are the TENANT's own content, not the end user's, so they stay.
  app.post('/v1/public/social/meta/data-deletion', async (request, reply) => {
    const { signed_request: signed } = SignedRequestBody.parse(request.body);
    const { userId, platforms } = verifyMetaRequest(signed);

    const removed = await revokeMetaConnections(userId, platforms);
    request.log.info(
      { platforms, removed },
      'Meta data-deletion callback — removed social connections'
    );

    // Meta requires this exact shape: a status URL the person can open, and a
    // confirmation code we can look up. The code is the deletion's identity — we
    // derive it from the user id so a repeat request returns the SAME code rather
    // than minting a new one for work already done.
    const confirmationCode = crypto
      .createHash('sha256')
      .update(`meta-deletion:${userId}`)
      .digest('hex')
      .slice(0, 24);

    const base = process.env.SPARX_PUBLIC_API_REST_URL ?? 'https://api.sparx.works';
    return reply.status(200).send({
      url: `${base}/v1/public/social/meta/deletion-status?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    });
  });

  // The human-readable status page Meta links the person to. There is nothing to
  // look up: deletion is synchronous in the handler above, so by the time a code
  // exists the work is done.
  app.get('/v1/public/social/meta/deletion-status', async (request, reply) => {
    const { code } = z.object({ code: z.string().optional() }).parse(request.query);
    return reply.status(200).send({
      status: 'completed',
      confirmation_code: code ?? null,
      detail:
        'Any social account connections associated with this Meta account have been removed from sparx.',
    });
  });
};

export default socialMetaCallbackRoutes;
