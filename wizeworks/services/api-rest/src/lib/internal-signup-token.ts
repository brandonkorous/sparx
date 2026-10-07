// The shared secret the signup app (the brand's account app) presents to the
// /internal/tenant/* routes: `X-sparx-Internal-Furnish-Token`, compared in
// constant time against env.SPARX_INTERNAL_FURNISH_TOKEN.
//
// One secret for that one caller. The account app already holds it to furnish a
// tenant, which writes far more than opening a checkout does, so letting the same
// caller open a checkout widens nothing.

import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';

import { env } from '../env.js';

const TOKEN_HEADER = 'x-sparx-internal-furnish-token';

function unauthorized(message: string): Error {
  const err = new Error(message);
  (err as { statusCode?: number }).statusCode = 401;
  (err as { code?: string }).code = 'UNAUTHORIZED';
  return err;
}

/** Throws a 401 unless the request carries the signup app's token. */
export function authorizeSignupApp(request: FastifyRequest): void {
  const expected = env.SPARX_INTERNAL_FURNISH_TOKEN;
  if (!expected) {
    // No token configured → endpoint disabled. 401 rather than a silent success,
    // so a forgotten secret in prod shows up as an error, not as quiet nothing.
    throw unauthorized('Internal furnish token is not configured.');
  }
  const provided = request.headers[TOKEN_HEADER];
  if (typeof provided !== 'string' || provided.length === 0) {
    throw unauthorized('Missing X-sparx-Internal-Furnish-Token header.');
  }
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw unauthorized('Invalid furnish token.');
  }
}
