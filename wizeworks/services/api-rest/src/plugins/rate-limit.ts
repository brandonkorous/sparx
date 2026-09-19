// Rate limit.
//
// Phase 1: simple per-IP token bucket. Plan-tiered limits (docs/06 §433
// listed Starter 60 rpm, Pro 600 rpm, etc.) land when billing data wires
// in — read tenant.plan from request.auth and override `max` accordingly.
// For now this protects against trivial scrapers + accidental tight loops.
//
// ── Why the builder returns an ApiError and not the envelope ──────────────
//
// `@fastify/rate-limit` does not construct an error and attach our body to it.
// It THROWS whatever `errorResponseBuilder` returns:
//
//     throw params.errorResponseBuilder(req, respCtx)   // index.js:333
//
// Its own default builder returns an `Error` carrying `statusCode = 429`, and
// that `statusCode` is the only thing the error handler can read. This builder
// used to return a plain envelope object instead — no prototype, no
// `statusCode` — so it missed every branch in `createErrorsPlugin` and fell
// through to the last one:
//
//     500  {"code":"INTERNAL_ERROR","message":"An internal error occurred."}
//
// with `x-ratelimit-remaining: 0` and `retry-after: 48` still on the response.
// The machine-readable half was right and the human-readable half was a lie,
// on every rate-limited request the platform has ever served: the console said
// "a problem reaching the server", and a shopper who mistyped their password
// three times, or filled in a contact form too quickly, was told the site had
// broken. The remedy — wait N seconds — was in a header nobody reads.
//
// A wrong status is not cosmetic here. 500 means "our bug, safe to retry", and
// well-behaved clients DO retry it, which drains the bucket further. 429 with
// Retry-After is the one answer that makes a client back off, so returning 500
// defeated the thing the limiter exists to do.
//
// `ApiError` is what the error handler's FIRST branch matches, and
// `STATUS_BY_CODE.RATE_LIMITED` is already 429, so the envelope, the code, the
// details and the status all come out of one object.

import fastifyRateLimit from '@fastify/rate-limit';
import { ApiError } from '@wizeworks/api-core/errors';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

const rateLimitPlugin: FastifyPluginAsync = async (app) => {
  await app.register(fastifyRateLimit, {
    global: true,
    max: 600, // 10 per second, generous default
    timeWindow: '1 minute',
    // /health is liveness — never rate limit, would flap pods unhealthy.
    allowList: (request) => request.url === '/health',
    errorResponseBuilder: (_request, context) =>
      new ApiError(
        'RATE_LIMITED',
        `Rate limit of ${String(context.max)} requests per ${context.after} exceeded.`,
        { retry_after_seconds: Math.ceil(context.ttl / 1000) }
      ),
  });
};

export default fp(rateLimitPlugin, { name: 'rate-limit' });
