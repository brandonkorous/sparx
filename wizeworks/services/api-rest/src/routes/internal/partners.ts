// Internal Partner Program endpoints (docs/114 §B.8). ClusterIP-only, hidden from
// OpenAPI, self-authorized with a constant-time shared-secret header (its own
// secret — these write cross-org referral/commission rows). Not under
// `/v1/public/`, so the auth preHandler leaves request.auth = null (no Bearer)
// and this guard is the sole gate. Mirrors internal/acquisition-report.ts.
//
//   POST  /internal/partners/referrals                  → signup attribution hook
//   POST  /internal/partners/referral-payment           → first-payment accrual hook
//   GET   /internal/partners/applications               → staff review queue
//   POST  /internal/partners/applications/:id/approve   → approve → provision partner
//   PATCH /internal/partners/:tenantId/tier             → set tier
//   PATCH /internal/partners/:tenantId/suspend          → suspend
//   PATCH /internal/partners/:tenantId/reinstate        → reinstate

import { timingSafeEqual } from 'node:crypto';

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ok } from '@wizeworks/api-core/envelope';
import { unauthorized } from '@wizeworks/api-core/errors';

import { env } from '../../env.js';
import { partnerService } from '../../lib/partners/service.js';
import { approvePendingCommissions, runPayouts } from '../../lib/partners/payouts.js';

const TOKEN_HEADER = 'x-sparx-internal-partners-token';

function authorize(request: FastifyRequest): void {
  const expected = env.SPARX_INTERNAL_PARTNERS_TOKEN;
  if (!expected) throw unauthorized('Internal partners token is not configured.');
  const provided = request.headers[TOKEN_HEADER];
  if (typeof provided !== 'string' || provided.length === 0) {
    throw unauthorized(`Missing ${TOKEN_HEADER} header.`);
  }
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw unauthorized('Invalid internal partners token.');
  }
}

const TenantParam = z.object({ tenantId: z.string().uuid() });
const AppIdParam = z.object({ id: z.string().uuid() });
const StatusQuery = z.object({ status: z.enum(['pending', 'approved', 'rejected']).optional() });

const internalPartnerRoutes: FastifyPluginAsync = (app) => {
  app.post('/internal/partners/referrals', { schema: { hide: true } }, async (request) => {
    authorize(request);
    const result = await partnerService.recordReferral(request.body);
    return ok(result);
  });

  app.post('/internal/partners/referral-payment', { schema: { hide: true } }, async (request) => {
    authorize(request);
    const result = await partnerService.accrueFirstPayment(request.body);
    return ok(result);
  });

  app.get('/internal/partners/applications', { schema: { hide: true } }, async (request) => {
    authorize(request);
    const { status } = StatusQuery.parse(request.query);
    const items = await partnerService.listApplications(status);
    return ok(items);
  });

  app.post(
    '/internal/partners/applications/:id/approve',
    { schema: { hide: true } },
    async (request) => {
      authorize(request);
      const { id } = AppIdParam.parse(request.params);
      const partner = await partnerService.approveApplication({
        ...(request.body as object),
        applicationId: id,
      });
      return ok(partner);
    }
  );

  app.patch('/internal/partners/:tenantId/tier', { schema: { hide: true } }, async (request) => {
    authorize(request);
    const { tenantId } = TenantParam.parse(request.params);
    const partner = await partnerService.setTier(tenantId, request.body);
    return ok(partner);
  });

  app.patch('/internal/partners/:tenantId/suspend', { schema: { hide: true } }, async (request) => {
    authorize(request);
    const { tenantId } = TenantParam.parse(request.params);
    const partner = await partnerService.setStatus(tenantId, 'suspended');
    return ok(partner);
  });

  app.patch(
    '/internal/partners/:tenantId/reinstate',
    { schema: { hide: true } },
    async (request) => {
      authorize(request);
      const { tenantId } = TenantParam.parse(request.params);
      const partner = await partnerService.setStatus(tenantId, 'active');
      return ok(partner);
    }
  );

  // Cron: promote eligible pending commissions to `approved` (clawback window
  // passed), then run the monthly Stripe Connect payout batch (docs/114 §B.4).
  app.post(
    '/internal/partners/commissions/approve',
    { schema: { hide: true } },
    async (request) => {
      authorize(request);
      const result = await approvePendingCommissions();
      return ok(result);
    }
  );

  app.post('/internal/partners/payouts/run', { schema: { hide: true } }, async (request) => {
    authorize(request);
    const result = await runPayouts(new Date());
    return ok(result);
  });

  return Promise.resolve();
};

export default internalPartnerRoutes;
