// Internal endpoint invoked by the channel-order-poll k8s CronJob (k8s/cronjobs/).
//
// Auth: shared secret in `X-sparx-Internal-Cron-Token`, constant-time compared
// against env.SPARX_INTERNAL_CRON_TOKEN. Same pattern as the commerce/CRM cron
// surfaces.
//
//   • POST /internal/channels/poll → pull + ingest new orders from every connected
//     order channel that has no reliable webhook (Etsy / Walmart / eBay; Faire as a
//     backup). Push-style channels (TikTok) ingest via the public webhook instead.
//
// Per-tenant loops are sequential to keep DB + outbound-API load predictable. The
// ingest is idempotent (deterministic order number per externalId), so re-polling
// the cursor overlap window never double-writes.

import { timingSafeEqual } from 'node:crypto';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

import { commerceSchedulers } from '@wizeworks/commerce';

import { env } from '../../env.js';
import { pollTenantChannelOrders } from '../../lib/channel-poll.js';

const CRON_TOKEN_HEADER = 'x-sparx-internal-cron-token';

function authorize(request: FastifyRequest): void {
  const expected = env.SPARX_INTERNAL_CRON_TOKEN;
  if (!expected) {
    throw unauthorized('Internal cron token is not configured.');
  }
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

interface TenantOutcome {
  tenantId: string;
  ok: boolean;
  error?: string;
  result?: unknown;
}

async function forEachActiveTenant<T>(
  run: (tenantId: string) => Promise<T>
): Promise<{ tenants: number; outcomes: TenantOutcome[] }> {
  const tenants = await commerceSchedulers.listCommerceActiveTenants();
  const outcomes: TenantOutcome[] = [];
  for (const t of tenants) {
    try {
      const result = await run(t.id);
      outcomes.push({ tenantId: t.id, ok: true, result });
    } catch (err) {
      outcomes.push({
        tenantId: t.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { tenants: tenants.length, outcomes };
}

const channelsCronRoutes: FastifyPluginAsync = (app) => {
  app.post('/internal/channels/poll', async (request) => {
    authorize(request);
    const summary = await forEachActiveTenant((tenantId) => pollTenantChannelOrders(tenantId));
    return { success: true, data: summary };
  });

  return Promise.resolve();
};

function unauthorized(message: string): Error {
  const err = new Error(message);
  (err as { statusCode?: number }).statusCode = 401;
  (err as { code?: string }).code = 'UNAUTHORIZED';
  return err;
}

export default channelsCronRoutes;
