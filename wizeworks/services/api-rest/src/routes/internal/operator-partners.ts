// Operator Partner-Program endpoints (docs/apps/admin/build-plan.md Slice 9;
// docs/114 §B). The WizeWorks-side partner administration surface, folded behind
// the SAME operator seam as the rest of the console (D6: one internal principal —
// the admin app never holds the separate partners token). These wrap the existing
// `partnerService` / payout runners / `directoryService`; they add no partner
// business logic of their own.
//
// Data access follows the partner RLS design (migration 20261003000000):
//   • applications live on the platform tenant → a single scoped read;
//   • the roster comes from `withSystem` (partners_visibility exposes ACTIVE rows
//     only — a suspended partner drops out of the list, but its own tenant context
//     still sees it, so the detail endpoint can reinstate it);
//   • per-partner referrals/commissions/payouts are read under the partner's own
//     tenant context (pure tenant isolation — no cross-partner read exists).
//
// Attribution: partner-tenant-scoped writes (approve/tier/suspend) stamp the
// affected partner tenant's own `audit_logs` as `actor_type='operator'`
// (owner-visible), mirroring the tenant write actions; the admin app additionally
// writes the wize_admin operator audit. Capability gating (partner:read /
// partner:act) is enforced admin-side.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant, type Prisma } from '@wizeworks/db';
import type {
  OperatorPartnerApplication,
  OperatorPartnerListItem,
  OperatorPartnerDetail,
  OperatorPartnerReferral,
  OperatorPartnerCommission,
  OperatorPartnerPayoutRun,
  OperatorPartnerTier,
} from '@wizeworks/operator';

import { authorizeOperator, badRequest, notFound, operatorIdOf } from './operator-internal.js';
import { partnerService } from '../../lib/partners/service.js';
import { approvePendingCommissions, runPayouts } from '../../lib/partners/payouts.js';
import { directoryService } from '../../lib/partners/directory.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIERS = ['informal', 'registered', 'certified'] as const;

const StatusQuery = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});
const ApproveSchema = z.object({ tier: z.enum(TIERS).optional() });
const RejectSchema = z.object({ note: z.string().max(2000).optional() });
const TierSchema = z.object({ tier: z.enum(TIERS) });
const StatusSchema = z.object({ status: z.enum(['active', 'suspended']) });

// ── Row → DTO mappers ────────────────────────────────────────────────────────

interface PartnerRow {
  id: string;
  tenantId: string;
  displayName: string;
  kind: string;
  tier: string;
  status: string;
  referralCode: string;
  websiteUrl: string | null;
  directoryVisible: boolean;
  stripePayoutAccountId: string | null;
  approvedAt: Date | null;
  createdAt: Date;
}

function toPartnerItem(p: PartnerRow): OperatorPartnerListItem {
  return {
    tenantId: p.tenantId,
    id: p.id,
    displayName: p.displayName,
    kind: p.kind,
    tier: p.tier as OperatorPartnerTier,
    status: p.status,
    referralCode: p.referralCode,
    websiteUrl: p.websiteUrl,
    directoryVisible: p.directoryVisible,
    hasPayoutAccount: Boolean(p.stripePayoutAccountId),
    approvedAt: p.approvedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

interface ApplicationRow {
  id: string;
  applicantTenantId: string | null;
  name: string;
  email: string;
  websiteUrl: string | null;
  kind: string;
  note: string | null;
  requestedTier: string;
  status: string;
  createdAt: Date;
  reviewedAt: Date | null;
}

function toApplication(a: ApplicationRow): OperatorPartnerApplication {
  return {
    id: a.id,
    applicantTenantId: a.applicantTenantId,
    name: a.name,
    email: a.email,
    websiteUrl: a.websiteUrl,
    kind: a.kind,
    note: a.note,
    requestedTier: a.requestedTier,
    status: a.status,
    createdAt: a.createdAt.toISOString(),
    reviewedAt: a.reviewedAt?.toISOString() ?? null,
  };
}

function toReferral(r: {
  id: string;
  referredTenantId: string;
  referredOrgName: string | null;
  referralCode: string;
  status: string;
  commissionRate: unknown;
  firstPaymentAt: Date | null;
  createdAt: Date;
}): OperatorPartnerReferral {
  return {
    id: r.id,
    referredTenantId: r.referredTenantId,
    referredOrgName: r.referredOrgName,
    referralCode: r.referralCode,
    status: r.status,
    commissionRate: Number(r.commissionRate),
    firstPaymentAt: r.firstPaymentAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

function toCommission(c: {
  id: string;
  amountCents: number;
  currency: string;
  kind: string;
  status: string;
  payoutRunId: string | null;
  paidAt: Date | null;
  createdAt: Date;
}): OperatorPartnerCommission {
  return {
    id: c.id,
    amountCents: c.amountCents,
    currency: c.currency,
    kind: c.kind,
    status: c.status,
    payoutRunId: c.payoutRunId,
    paidAt: c.paidAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  };
}

function toPayoutRun(p: {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  amountCents: number;
  currency: string;
  commissionCount: number;
  status: string;
  stripeTransferId: string | null;
  paidAt: Date | null;
  createdAt: Date;
}): OperatorPartnerPayoutRun {
  return {
    id: p.id,
    periodStart: p.periodStart.toISOString(),
    periodEnd: p.periodEnd.toISOString(),
    amountCents: p.amountCents,
    currency: p.currency,
    commissionCount: p.commissionCount,
    status: p.status,
    stripeTransferId: p.stripeTransferId,
    paidAt: p.paidAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

/** Stamp the partner tenant's own audit_logs for an operator-initiated write
 *  (owner-visible). Best-effort — never block the action on the audit write. */
async function stampPartnerAudit(
  tenantId: string,
  operatorId: string | null,
  action: string,
  diff: Prisma.InputJsonValue
): Promise<void> {
  try {
    await withTenant({ tenantId }, (tx) =>
      tx.auditLog.create({
        data: {
          tenantId,
          actorId: operatorId,
          actorType: 'operator',
          action,
          entityType: 'partner',
          entityId: tenantId,
          diff,
          ipAddress: null,
          userAgent: null,
        },
      })
    );
  } catch {
    // best-effort — the partner domain events remain the authoritative trail
  }
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const operatorPartnerRoutes: FastifyPluginAsync = async (app) => {
  const opts = { logLevel: 'warn' as const, schema: { hide: true } };

  // ── Applications review queue ──
  app.get<{ Querystring: { status?: string } }>(
    '/internal/operator/partners/applications',
    opts,
    async (request) => {
      authorizeOperator(request);
      const { status } = StatusQuery.parse(request.query);
      const rows = await partnerService.listApplications(status);
      return rows.map(toApplication);
    }
  );

  app.post<{ Params: { id: string } }>(
    '/internal/operator/partners/applications/:id/approve',
    opts,
    async (request) => {
      authorizeOperator(request);
      const { id } = request.params;
      if (!UUID_RE.test(id)) throw badRequest('Invalid application id.');
      const parsed = ApproveSchema.safeParse(request.body ?? {});
      if (!parsed.success) throw badRequest('Invalid tier.');
      const partner = await partnerService.approveApplication({
        applicationId: id,
        ...(parsed.data.tier ? { tier: parsed.data.tier } : {}),
      });
      await stampPartnerAudit(partner.tenantId, operatorIdOf(request), 'partner.approved', {
        tier: partner.tier,
        applicationId: id,
      });
      return toPartnerItem(partner);
    }
  );

  app.post<{ Params: { id: string } }>(
    '/internal/operator/partners/applications/:id/reject',
    opts,
    async (request) => {
      authorizeOperator(request);
      const { id } = request.params;
      if (!UUID_RE.test(id)) throw badRequest('Invalid application id.');
      const parsed = RejectSchema.safeParse(request.body ?? {});
      if (!parsed.success) throw badRequest('Invalid note.');
      const row = await partnerService.rejectApplication(id, parsed.data.note);
      return toApplication(row);
    }
  );

  // ── Roster + per-partner detail ──
  app.get('/internal/operator/partners', opts, async (request) => {
    authorizeOperator(request);
    const rows = await partnerService.listAllPartners();
    return rows.map(toPartnerItem);
  });

  app.get<{ Params: { tenantId: string } }>(
    '/internal/operator/partners/:tenantId',
    opts,
    async (request) => {
      authorizeOperator(request);
      const { tenantId } = request.params;
      if (!UUID_RE.test(tenantId)) throw badRequest('Invalid tenant id.');
      const detail = await partnerService.adminDetail(tenantId);
      if (!detail) throw notFound('This account is not a partner.');

      const paidCents = detail.commissions
        .filter((c) => c.status === 'paid')
        .reduce((s, c) => s + c.amountCents, 0);
      const pendingCents = detail.commissions
        .filter((c) => c.status === 'pending' || c.status === 'approved')
        .reduce((s, c) => s + c.amountCents, 0);

      const result: OperatorPartnerDetail = {
        partner: toPartnerItem(detail.partner),
        bio: detail.partner.bio ?? null,
        payoutMinCents: detail.partner.payoutMinCents,
        kpis: {
          referralCount: detail.referrals.length,
          activeReferrals: detail.referrals.filter((r) => r.status === 'active').length,
          lifetimeCents: paidCents,
          pendingCents,
        },
        referrals: detail.referrals.map(toReferral),
        commissions: detail.commissions.map(toCommission),
        payouts: detail.payouts.map(toPayoutRun),
      };
      return result;
    }
  );

  app.patch<{ Params: { tenantId: string } }>(
    '/internal/operator/partners/:tenantId/tier',
    opts,
    async (request) => {
      authorizeOperator(request);
      const { tenantId } = request.params;
      if (!UUID_RE.test(tenantId)) throw badRequest('Invalid tenant id.');
      const parsed = TierSchema.safeParse(request.body);
      if (!parsed.success) throw badRequest('`tier` must be informal, registered, or certified.');
      const partner = await partnerService.setTier(tenantId, parsed.data);
      await stampPartnerAudit(tenantId, operatorIdOf(request), 'partner.tier.set', {
        tier: partner.tier,
      });
      return toPartnerItem(partner);
    }
  );

  app.patch<{ Params: { tenantId: string } }>(
    '/internal/operator/partners/:tenantId/status',
    opts,
    async (request) => {
      authorizeOperator(request);
      const { tenantId } = request.params;
      if (!UUID_RE.test(tenantId)) throw badRequest('Invalid tenant id.');
      const parsed = StatusSchema.safeParse(request.body);
      if (!parsed.success) throw badRequest('`status` must be active or suspended.');
      const partner = await partnerService.setStatus(tenantId, parsed.data.status);
      await stampPartnerAudit(
        tenantId,
        operatorIdOf(request),
        parsed.data.status === 'suspended' ? 'partner.suspended' : 'partner.reinstated',
        { status: partner.status }
      );
      return toPartnerItem(partner);
    }
  );

  // ── Commissions + payouts (money-moving, gated partner:act admin-side) ──
  app.post('/internal/operator/partners/commissions/approve', opts, async (request) => {
    authorizeOperator(request);
    return approvePendingCommissions();
  });

  app.post('/internal/operator/partners/payouts/run', opts, async (request) => {
    authorizeOperator(request);
    return runPayouts(new Date());
  });

  // ── Bootcamps overview (cross-partner published cohorts, read-only) ──
  app.get('/internal/operator/bootcamps', opts, async (request) => {
    authorizeOperator(request);
    // Default paging (the directory query caps its own limit); `total` carries the
    // full published count even when the first page is shorter.
    const result = await directoryService.listBootcamps({});
    return { items: result.items, total: result.total };
  });
};

export default operatorPartnerRoutes;
