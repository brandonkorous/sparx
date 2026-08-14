// Shared secret auth for the internal cron surface.
//
// Every `POST /internal/<module>/<job>` endpoint is invoked by a k8s CronJob
// inside the cluster (k8s/cronjobs/). They are ClusterIP-only and carry no JWT,
// so the guard is a shared secret in `X-sparx-Internal-Cron-Token`, compared in
// constant time against `env.SPARX_INTERNAL_CRON_TOKEN`.
//
// Extracted because ten cron route files had each inlined a byte-identical copy
// of it. Those ten are left alone deliberately — a sweep across unrelated
// modules is not this change — but nothing new should add an eleventh.

import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';

import { env } from '../env.js';

const CRON_TOKEN_HEADER = 'x-sparx-internal-cron-token';

export function unauthorized(message: string): Error {
  const err = new Error(message);
  (err as { statusCode?: number }).statusCode = 401;
  (err as { code?: string }).code = 'UNAUTHORIZED';
  return err;
}

/** Throw 401 unless the request carries the cluster's cron token. An unset
 *  token is a REFUSAL, never an open door: a missing secret in prod must fail
 *  the job rather than expose the endpoint. */
export function authorizeCron(request: FastifyRequest): void {
  const expected = env.SPARX_INTERNAL_CRON_TOKEN;
  if (!expected) throw unauthorized('Internal cron token is not configured.');

  const provided = request.headers[CRON_TOKEN_HEADER];
  if (typeof provided !== 'string' || provided.length === 0) {
    throw unauthorized('Missing X-sparx-Internal-Cron-Token header.');
  }

  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw unauthorized('Invalid cron token.');
  }
}

/**
 * Run `job` for every tenant, collecting per-tenant outcomes instead of
 * aborting the sweep on the first failure.
 *
 * Sequential on purpose — a scheduler that fans out across every tenant at once
 * is a connection storm against a pool the whole platform shares. One tenant's
 * error is recorded and the run continues, because the alternative is that a
 * single bad row stops every tenant after it from being processed tonight.
 */
export async function forEachTenant<T>(
  tenants: { id: string; slug: string }[],
  job: (tenantId: string) => Promise<T>
): Promise<{
  tenants: number;
  ok: number;
  failed: number;
  outcomes: { tenantId: string; slug: string; ok: boolean; error?: string; result?: T }[];
}> {
  const outcomes: {
    tenantId: string;
    slug: string;
    ok: boolean;
    error?: string;
    result?: T;
  }[] = [];

  for (const tenant of tenants) {
    try {
      outcomes.push({
        tenantId: tenant.id,
        slug: tenant.slug,
        ok: true,
        result: await job(tenant.id),
      });
    } catch (error) {
      outcomes.push({
        tenantId: tenant.id,
        slug: tenant.slug,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    tenants: tenants.length,
    ok: outcomes.filter((o) => o.ok).length,
    failed: outcomes.filter((o) => !o.ok).length,
    outcomes,
  };
}
