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
import { isInClusterCaller } from '@wizeworks/client-ip';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { isWizeLensPath } from '../lib/wizelens.js';

const rateLimitPlugin: FastifyPluginAsync = async (app) => {
  await app.register(fastifyRateLimit, {
    global: true,
    max: 600, // 10 per second, generous default
    timeWindow: '1 minute',
    // /health is liveness — never rate limit, would flap pods unhealthy.
    // /_wizelens is the local profiler's dashboard (development only).
    //
    // An in-cluster caller with no forwarded chain is one of our pods filling a
    // shared cache (see isInClusterCaller). On 2026-10-18 WizeLens showed one
    // scanner probing `/.env` paths on one tenant site. Each probe missed the
    // site's cache, every miss was keyed on the site POD, and the pod's 600 a
    // minute ran out: about 2,650 cache reads answered 429 in 75 minutes, so
    // page bodies, headers and posts failed for every visitor of every site that
    // pod served. The scanner itself stays limited: the site's uncached reads
    // (site-by-host, actions, the /api/sparx proxy) forward its chain.
    allowList: (request) =>
      request.url === '/health' ||
      isWizeLensPath(request.url) ||
      isInClusterCaller(request.headers['x-forwarded-for'], request.socket.remoteAddress),
    // `context.after` is the time LEFT until the window resets, not the window.
    // It used to sit after "per", so one limit read as "600 requests per 1
    // second" and "600 requests per 29 seconds" — a different, wrong window on
    // every request, and the only true part (how long to wait) read as the
    // part that was not.
    errorResponseBuilder: (_request, context) =>
      new ApiError(
        'RATE_LIMITED',
        `Rate limit of ${String(context.max)} requests exceeded. Try again in ${context.after}.`,
        { retry_after_seconds: Math.ceil(context.ttl / 1000) }
      ),
  });
};

export default fp(rateLimitPlugin, { name: 'rate-limit' });
