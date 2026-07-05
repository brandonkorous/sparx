// Internal operator seam (docs/apps/admin/build-plan.md §2 D6, §7). The single
// door through which the WizeWorks admin console (apps/admin) reads cross-tenant
// business data and takes operator actions — it holds NO cross-tenant DB role of
// its own (docs/16 §2.4: no ambient BYPASSRLS).
//
// Auth: the Layer-5 internal-principal pattern (docs/16 §2.5). A shared secret in
// `X-sparx-Internal-Operator-Token`, constant-time compared against
// env.SPARX_INTERNAL_OPERATOR_TOKEN. A SEPARATE secret from the cron/acquisition
// tokens — different blast radius (cross-tenant reads + operator mutations). The
// admin app is the trust boundary: it has already authenticated the operator and
// checked their capability, then presents the operator id in `X-sparx-Operator-Id`
// for the api-rest-side audit trail. ClusterIP-only, hidden from OpenAPI.
//
// Slice 1 (this file) ships the round-trip probe `GET /internal/operator/whoami`
// only — proving the secret auth + the operator-id header make it through the
// seam end-to-end before any real data endpoint (tenant list/detail/metrics)
// lands in later slices.

import { timingSafeEqual } from 'node:crypto';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import {
  INTERNAL_OPERATOR_TOKEN_HEADER,
  OPERATOR_ID_HEADER,
  type OperatorWhoAmIResult,
} from '@sparx/operator';

import { env } from '../../env.js';

function authorize(request: FastifyRequest): void {
  const expected = env.SPARX_INTERNAL_OPERATOR_TOKEN;
  if (!expected) {
    // No token configured → endpoint disabled. 401 (not a silent allow) so a
    // forgotten secret in prod surfaces loudly rather than leaking operator reach.
    throw unauthorized('Internal operator token is not configured.');
  }
  const provided = request.headers[INTERNAL_OPERATOR_TOKEN_HEADER];
  if (typeof provided !== 'string' || provided.length === 0) {
    throw unauthorized('Missing X-sparx-Internal-Operator-Token header.');
  }
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw unauthorized('Invalid operator token.');
  }
}

/** The operator id the admin app attributed this call to (for audit), or null. */
function operatorIdOf(request: FastifyRequest): string | null {
  const raw = request.headers[OPERATOR_ID_HEADER];
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

const operatorInternalRoutes: FastifyPluginAsync = (app) => {
  app.get('/internal/operator/whoami', { logLevel: 'warn', schema: { hide: true } }, (request) => {
    authorize(request);
    const result: OperatorWhoAmIResult = {
      ok: true,
      operatorId: operatorIdOf(request),
      service: 'api-rest',
      time: new Date().toISOString(),
    };
    return result;
  });
  return Promise.resolve();
};

class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}
function unauthorized(message: string): HttpError {
  return new HttpError(401, 'UNAUTHORIZED', message);
}

export default operatorInternalRoutes;
