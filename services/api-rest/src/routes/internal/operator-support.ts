// Operator support tools (docs/apps/admin/build-plan.md §5 Slice 6). The
// cross-tenant support surface — order/customer lookup, per-tenant search-index
// stats + reindex, order-confirmation re-send, and the email delivery log.
//
// Cross-tenant search rides Typesense (which spans every tenant in one collection
// with a `tenant_id` field), NOT Postgres — orders/customers are FORCE-RLS and
// their natural keys (`order_number`, `email`) are unique only per-tenant, so a
// single cross-tenant SQL query is impossible by design (docs/16 §2.4). Per-tenant
// reads (email log, order lookup for the re-send) go through `withTenant` under the
// tenant's GUC. Reindex + re-send are event-driven (never inline side effects).
//
// Same Layer-5 shared-secret auth as the other operator routes; the admin app is
// the capability gate (support:read / support:act) + audit writer.
//
// Note (76 §3 "view a tenant's event history"): there is no Pub/Sub event-history
// store in Phase 1 (fire-and-forget). The tenant detail's Activity card already
// surfaces `audit_logs` as that proxy (Slice 2) — this slice adds the delivery log.

import crypto from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant, type Prisma } from '@sparx/db';
import {
  collectionStats,
  searchOrdersCrossTenant,
  searchCustomersCrossTenant,
} from '@sparx/search';
import { publish } from '@sparx/api-core/pubsub';
import type {
  OperatorOrderHit,
  OperatorOrderSearchResult,
  OperatorCustomerHit,
  OperatorCustomerSearchResult,
  OperatorSearchIndexStatus,
  OperatorReindexResult,
  OperatorEmailEvent,
  OperatorEmailLogResult,
  OperatorResendConfirmationResult,
} from '@sparx/operator';

import { sendTenantEmailByKey } from '../../lib/tenant-email.js';
import {
  authorizeOperator,
  badRequest,
  notFound,
  operatorIdOf,
  resolveTenantNames,
  HttpError,
} from './operator-internal.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ReindexSchema = z.object({
  collections: z.array(z.enum(['products', 'customers', 'orders'])).optional(),
  dropStale: z.boolean().optional(),
});

/** Typesense unreachable → a clean 503 the admin surfaces, not a raw client error. */
function searchUnavailable(): HttpError {
  return new HttpError(503, 'SEARCH_UNAVAILABLE', 'The search index is currently unavailable.');
}

/** Epoch SECONDS (how the projector stores `placed_at`/`last_order_at`) → ISO. */
function epochToIso(seconds: number | null | undefined): string | null {
  return typeof seconds === 'number' && Number.isFinite(seconds)
    ? new Date(seconds * 1000).toISOString()
    : null;
}

function clampLimit(raw: string | undefined, fallback: number, max: number): number {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(1, n));
}

function toPage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature.
const operatorSupportRoutes: FastifyPluginAsync = async (app) => {
  const opts = { logLevel: 'warn' as const, schema: { hide: true } };

  // ── Cross-tenant order search ───────────────────────────────────────────────
  app.get<{ Querystring: { q?: string; page?: string } }>(
    '/internal/operator/support/orders',
    opts,
    async (request) => {
      authorizeOperator(request);
      const q = (request.query.q ?? '').trim();
      if (!q) {
        const empty: OperatorOrderSearchResult = { orders: [], found: 0, page: 1, perPage: 20 };
        return empty;
      }
      let result;
      try {
        result = await searchOrdersCrossTenant({ q, page: toPage(request.query.page) });
      } catch {
        throw searchUnavailable();
      }
      const tenants = await resolveTenantNames(result.hits.map((h) => h.tenant_id));
      const orders: OperatorOrderHit[] = result.hits.map((d) => {
        const t = tenants.get(d.tenant_id);
        return {
          tenantId: d.tenant_id,
          tenantName: t?.name ?? '(unknown tenant)',
          tenantSlug: t?.slug ?? '',
          orderId: d.order_id,
          orderNumber: d.order_number,
          customerName: d.customer_name ?? null,
          customerEmail: d.customer_email ?? null,
          status: d.status,
          paymentStatus: d.payment_status,
          channel: d.channel,
          totalCents: d.total_cents,
          currency: d.currency,
          placedAt: epochToIso(d.placed_at) ?? new Date(0).toISOString(),
        };
      });
      const out: OperatorOrderSearchResult = {
        orders,
        found: result.found,
        page: result.page,
        perPage: result.perPage,
      };
      return out;
    }
  );

  // ── Cross-tenant customer search ────────────────────────────────────────────
  app.get<{ Querystring: { q?: string; page?: string } }>(
    '/internal/operator/support/customers',
    opts,
    async (request) => {
      authorizeOperator(request);
      const q = (request.query.q ?? '').trim();
      if (!q) {
        const empty: OperatorCustomerSearchResult = {
          customers: [],
          found: 0,
          page: 1,
          perPage: 20,
        };
        return empty;
      }
      let result;
      try {
        result = await searchCustomersCrossTenant({ q, page: toPage(request.query.page) });
      } catch {
        throw searchUnavailable();
      }
      const tenants = await resolveTenantNames(result.hits.map((h) => h.tenant_id));
      const customers: OperatorCustomerHit[] = result.hits.map((d) => {
        const t = tenants.get(d.tenant_id);
        return {
          tenantId: d.tenant_id,
          tenantName: t?.name ?? '(unknown tenant)',
          tenantSlug: t?.slug ?? '',
          customerId: d.customer_id,
          fullName: d.full_name,
          email: d.email || null,
          phone: d.phone ?? null,
          company: d.company ?? null,
          type: d.type,
          totalSpentCents: d.total_spent_cents,
          orderCount: d.order_count,
          lastOrderAt: epochToIso(d.last_order_at),
        };
      });
      const out: OperatorCustomerSearchResult = {
        customers,
        found: result.found,
        page: result.page,
        perPage: result.perPage,
      };
      return out;
    }
  );

  // ── Per-tenant search-index stats ───────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/internal/operator/tenants/:id/search-index',
    opts,
    async (request) => {
      authorizeOperator(request);
      const { id } = request.params;
      if (!UUID_RE.test(id)) throw badRequest('Invalid tenant id.');
      try {
        const collections = await collectionStats(id);
        const status: OperatorSearchIndexStatus = { tenantId: id, collections, unavailable: false };
        return status;
      } catch {
        // Typesense unreachable — report unavailable rather than 500 the whole page.
        const status: OperatorSearchIndexStatus = {
          tenantId: id,
          collections: [],
          unavailable: true,
        };
        return status;
      }
    }
  );

  // ── Trigger a full reindex for a tenant (event-driven) ──────────────────────
  app.post<{ Params: { id: string } }>(
    '/internal/operator/tenants/:id/reindex',
    opts,
    async (request) => {
      authorizeOperator(request);
      const { id } = request.params;
      if (!UUID_RE.test(id)) throw badRequest('Invalid tenant id.');
      const parsed = ReindexSchema.safeParse(request.body ?? {});
      if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'Invalid reindex.');

      const runId = `reindex_${crypto.randomUUID().replace(/-/g, '')}`;
      await publish(request.log, 'search.reindex.requested', id, operatorIdOf(request), {
        runId,
        collections: parsed.data.collections,
        dropStale: parsed.data.dropStale ?? false,
      });
      const out: OperatorReindexResult = { runId, accepted: true };
      return out;
    }
  );

  // ── Per-tenant email delivery log ───────────────────────────────────────────
  app.get<{
    Params: { id: string };
    Querystring: { recipient?: string; type?: string; messageId?: string; limit?: string };
  }>('/internal/operator/tenants/:id/email-log', opts, async (request) => {
    authorizeOperator(request);
    const { id } = request.params;
    if (!UUID_RE.test(id)) throw badRequest('Invalid tenant id.');
    const { recipient, type, messageId } = request.query;
    const limit = clampLimit(request.query.limit, 50, 200);

    const where: Prisma.EmailEventWhereInput = {};
    if (recipient?.trim()) where.recipient = { contains: recipient.trim(), mode: 'insensitive' };
    if (type?.trim()) where.type = type.trim();
    if (messageId?.trim()) where.messageId = messageId.trim();

    const rows = await withTenant({ tenantId: id }, (tx) =>
      tx.emailEvent.findMany({ where, orderBy: { occurredAt: 'desc' }, take: limit })
    );
    const events: OperatorEmailEvent[] = rows.map((e) => ({
      id: e.id,
      messageId: e.messageId,
      recipient: e.recipient,
      type: e.type,
      reason: e.reason,
      broadcastId: e.broadcastId,
      automationKey: e.automationKey,
      occurredAt: e.occurredAt.toISOString(),
    }));
    const out: OperatorEmailLogResult = { events };
    return out;
  });

  // ── Re-send an order's confirmation email ───────────────────────────────────
  // Reuses the SAME primitive the payment webhook uses — renders the tenant's own
  // published order-confirmation tree and publishes `email.send` (never a direct
  // provider call). Fail-safe: `sent:false` with a reason rather than throwing.
  app.post<{ Params: { tenantId: string; orderId: string } }>(
    '/internal/operator/tenants/:tenantId/orders/:orderId/resend-confirmation',
    opts,
    async (request) => {
      authorizeOperator(request);
      const { tenantId, orderId } = request.params;
      if (!UUID_RE.test(tenantId)) throw badRequest('Invalid tenant id.');
      if (!UUID_RE.test(orderId)) throw badRequest('Invalid order id.');

      const order = await withTenant({ tenantId }, (tx) =>
        tx.order.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            orderNumber: true,
            customerId: true,
            propertyId: true,
            customer: { select: { email: true } },
          },
        })
      );
      if (!order) throw notFound('Order not found.');

      const to = order.customer?.email ?? null;
      if (!to) {
        const noEmail: OperatorResendConfirmationResult = {
          sent: false,
          reason: 'no-email',
          orderNumber: order.orderNumber,
          to: null,
        };
        return noEmail;
      }

      const res = await sendTenantEmailByKey(request.log, tenantId, {
        key: 'order-confirmation',
        to,
        propertyId: order.propertyId,
        ref: { customerId: order.customerId, orderId: order.id },
        variables: { operator_resend: '1' },
      });
      const out: OperatorResendConfirmationResult = {
        sent: res.sent,
        reason: res.reason ?? null,
        orderNumber: order.orderNumber,
        to,
      };
      return out;
    }
  );
};

export default operatorSupportRoutes;
