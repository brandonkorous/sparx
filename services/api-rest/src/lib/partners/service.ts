// Partner Program service (docs/114 Part B). Owns every write into the partner
// capability row, the application queue, the referral ledger, and the commission
// ledger. Routes stay thin — they parse + gate + render the envelope; this owns
// Zod validation, RLS-scoped transactions, event publishing, and the cross-org
// referral write.

import { randomBytes } from 'node:crypto';

import { withSystem, withTenant, type TxClient } from '@sparx/db';
import { badRequest, conflict, forbidden, notFound } from '@sparx/api-core/errors';
import { requireAuth } from '@sparx/api-core/auth';
import type { FastifyRequest } from 'fastify';
import {
  ApplyPartnerInput,
  ApplyTierInput,
  InternalApproveApplicationInput,
  InternalRecordReferralInput,
  InternalReferralPaymentInput,
  InternalSetTierInput,
  JoinPartnerInput,
  UpdatePartnerProfileInput,
  type PartnerTier,
} from '@sparx/partner-schemas';

import { env } from '../../env.js';
import { publishPartnerEvent } from './events.js';

export interface PartnerContext {
  tenantId: string;
  userId: string | null;
}

export function toPartnerContext(request: FastifyRequest): PartnerContext {
  const auth = requireAuth(request);
  return { tenantId: auth.tenantId, userId: auth.actorId };
}

function run<T>(ctx: PartnerContext, fn: (tx: TxClient) => Promise<T>): Promise<T> {
  return withTenant({ tenantId: ctx.tenantId, userId: ctx.userId ?? undefined }, fn);
}

// ── Commission economics (docs/114 §B.4) ─────────────────────────────────────
function firstPaymentRate(tier: string): number {
  // informal 20% · registered 30% · certified 30% (first payment).
  return tier === 'informal' ? 0.2 : 0.3;
}

// Resolve display names for a set of referred/managed org (tenant) ids. The
// referral + membership rows live in the PARTNER's scope, but the referred orgs'
// names live in THOSE orgs' rows — invisible to the partner under normal RLS. A
// partner is legitimately authorized to know who its own clients are (docs/114
// §B.7), so this reads the names via `withSystem` (RLS-escaped, platform scope),
// resolving live rather than snapshotting so a client rename is always reflected.
// Returns id → org name; ids with no tenant row are omitted (caller falls back).
async function resolveOrgNames(tenantIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(tenantIds)];
  if (unique.length === 0) return new Map();
  const rows = await withSystem((tx) =>
    tx.tenant.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } })
  );
  return new Map(rows.map((r) => [r.id, r.name]));
}

// A URL-safe referral code — short, unambiguous (no 0/O/1/l), minted on activation.
function mintReferralCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(10);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

async function uniqueReferralCode(tx: TxClient): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const code = mintReferralCode();
    const existing = await tx.partner.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  // Astronomically unlikely; widen entropy rather than loop forever.
  return mintReferralCode() + mintReferralCode().slice(0, 4);
}

// ── The partner capability row ───────────────────────────────────────────────

export const partnerService = {
  /** The active org's partner row (or null). */
  get(ctx: PartnerContext) {
    return run(ctx, (tx) => tx.partner.findUnique({ where: { tenantId: ctx.tenantId } }));
  },

  /** Apply to the Partner Program from an authed tenant (docs/114 §B.2). ALWAYS an
   *  application for review — there is NO automatic signup at any tier (no unvetted
   *  account represents the Sparx brand). Every application queues a
   *  `partner_applications` row and waits for staff approval, which is what
   *  provisions the `partners` row (see approveApplication → provisionForTenant).
   *  Rejects an already-active partner and a duplicate in-review application. */
  async apply(ctx: PartnerContext, raw: unknown): Promise<{ status: 'pending' }> {
    const input = JoinPartnerInput.parse(raw);

    const existing = await run(ctx, (tx) =>
      tx.partner.findUnique({ where: { tenantId: ctx.tenantId }, select: { id: true } })
    );
    if (existing) throw conflict('This account is already a partner.');

    const current = await this.getMyApplication(ctx.tenantId);
    if (current?.status === 'pending') {
      throw conflict('Your partner application is already in review.');
    }

    await this.createApplication({
      name: input.displayName,
      email: '',
      kind: input.kind,
      requestedTier: input.requestedTier,
      applicantTenantId: ctx.tenantId,
      status: 'pending',
    });
    return { status: 'pending' };
  },

  /** The tenant's own latest partner application (or null) — drives the apply vs
   *  "under review" state on the join surface + the general-settings card. Reads
   *  the platform-tenant review queue filtered to this applicant org. */
  async getMyApplication(
    applicantTenantId: string
  ): Promise<{ status: string; requestedTier: string; createdAt: Date } | null> {
    const platformTenantId = env.SPARX_PLATFORM_TENANT_ID;
    if (!platformTenantId) return null;
    const row = await withTenant({ tenantId: platformTenantId }, (tx) =>
      tx.partnerApplication.findFirst({
        where: { applicantTenantId },
        orderBy: { createdAt: 'desc' },
        select: { status: true, requestedTier: true, createdAt: true },
      })
    );
    return row ?? null;
  },

  async updateProfile(ctx: PartnerContext, raw: unknown) {
    const input = UpdatePartnerProfileInput.parse(raw);
    return run(ctx, async (tx) => {
      const existing = await tx.partner.findUnique({
        where: { tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!existing) throw forbidden('This account is not a partner.');
      return tx.partner.update({ where: { tenantId: ctx.tenantId }, data: input });
    });
  },

  /** Apply for a higher tier (docs/114 §B.2) — queues a staff-review application. */
  async applyTier(ctx: PartnerContext, raw: unknown) {
    const input = ApplyTierInput.parse(raw);
    if (input.requestedTier === 'informal') throw badRequest('Informal needs no application.');
    const partner = await this.get(ctx);
    if (!partner) throw forbidden('This account is not a partner.');
    await this.createApplication({
      name: partner.displayName,
      email: '',
      kind: partner.kind,
      note: input.note ?? undefined,
      requestedTier: input.requestedTier,
      applicantTenantId: ctx.tenantId,
    });
    return { ok: true, status: 'pending' as const };
  },

  /** The referral ledger, each row enriched with the referred org's live name so
   *  the partner sees WHO signed up, not an opaque uuid (docs/114 §B.7). */
  async listReferrals(ctx: PartnerContext) {
    const rows = await run(ctx, (tx) =>
      tx.partnerReferral.findMany({
        where: { tenantId: ctx.tenantId },
        orderBy: { createdAt: 'desc' },
      })
    );
    const names = await resolveOrgNames(rows.map((r) => r.referredTenantId));
    return rows.map((r) => ({ ...r, referredOrgName: names.get(r.referredTenantId) ?? null }));
  },

  listCommissions(ctx: PartnerContext) {
    return run(ctx, (tx) =>
      tx.partnerCommission.findMany({
        where: { tenantId: ctx.tenantId },
        orderBy: { createdAt: 'desc' },
      })
    );
  },

  listPayouts(ctx: PartnerContext) {
    return run(ctx, (tx) =>
      tx.partnerPayoutRun.findMany({
        where: { tenantId: ctx.tenantId },
        orderBy: { createdAt: 'desc' },
      })
    );
  },

  /** Overview KPIs for the Partner Portal home. */
  async overview(ctx: PartnerContext) {
    return run(ctx, async (tx) => {
      const partner = await tx.partner.findUnique({ where: { tenantId: ctx.tenantId } });
      if (!partner) return null;
      const [referralCount, activeReferrals, commissions] = await Promise.all([
        tx.partnerReferral.count({ where: { tenantId: ctx.tenantId } }),
        tx.partnerReferral.count({ where: { tenantId: ctx.tenantId, status: 'active' } }),
        tx.partnerCommission.findMany({
          where: { tenantId: ctx.tenantId },
          select: { amountCents: true, status: true },
        }),
      ]);
      const lifetimeCents = commissions
        .filter((c) => c.status === 'paid')
        .reduce((s, c) => s + c.amountCents, 0);
      const pendingCents = commissions
        .filter((c) => c.status === 'pending' || c.status === 'approved')
        .reduce((s, c) => s + c.amountCents, 0);
      return { partner, referralCount, activeReferrals, lifetimeCents, pendingCents };
    });
  },

  // ── Applications (public apply + review queue on the platform tenant) ────────

  /** Create an application row on the PLATFORM tenant (wizeworks) — WizeWorks'
   *  review queue, mirroring careers/job_applications. Written under the platform
   *  tenant's RLS context. Returns null when the platform tenant isn't configured
   *  (dev without SPARX_PLATFORM_TENANT_ID) so the caller degrades gracefully. */
  async createApplication(input: {
    name: string;
    email: string;
    websiteUrl?: string | null;
    kind: string;
    note?: string | null;
    requestedTier: string;
    applicantTenantId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    status?: 'pending' | 'approved';
  }): Promise<{ id: string } | null> {
    const platformTenantId = env.SPARX_PLATFORM_TENANT_ID;
    if (!platformTenantId) return null;
    const row = await withTenant({ tenantId: platformTenantId }, (tx) =>
      tx.partnerApplication.create({
        data: {
          tenantId: platformTenantId,
          applicantTenantId: input.applicantTenantId ?? null,
          name: input.name,
          email: input.email,
          websiteUrl: input.websiteUrl ?? null,
          kind: input.kind,
          note: input.note ?? null,
          requestedTier: input.requestedTier,
          status: input.status ?? 'pending',
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
        },
        select: { id: true },
      })
    );
    await publishPartnerEvent('partner.application.submitted', platformTenantId, null, {
      applicationId: row.id,
      requestedTier: input.requestedTier,
    });
    return row;
  },

  /** Public application (docs/114 §B.2). ALWAYS queues a pending application for
   *  staff review — no tier auto-activates, ever (no unvetted account represents
   *  the Sparx brand). Staff approval (admin app → approveApplication) is the only
   *  path that provisions the partner row. */
  async submitApplication(
    raw: unknown,
    meta: {
      authedTenantId?: string | null;
      authedUserId?: string | null;
      ipAddress?: string | null;
      userAgent?: string | null;
    }
  ): Promise<{ status: 'pending' }> {
    const input = ApplyPartnerInput.parse(raw);
    if (input.company_website) return { status: 'pending' }; // honeypot: silently drop

    await partnerService.createApplication({
      ...input,
      applicantTenantId: meta.authedTenantId ?? null,
      status: 'pending',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return { status: 'pending' };
  },

  /** Provision (or reactivate) an active partner row for a tenant + mint a code.
   *  Idempotent — re-provisioning an existing partner returns it unchanged. */
  async provisionForTenant(
    tenantId: string,
    input: { displayName: string; kind: string; tier: PartnerTier; websiteUrl?: string | null }
  ) {
    const now = new Date();
    const partner = await withTenant({ tenantId }, async (tx) => {
      const existing = await tx.partner.findUnique({ where: { tenantId } });
      if (existing) {
        if (existing.status === 'active') return existing;
        return tx.partner.update({
          where: { tenantId },
          data: { status: 'active', tier: input.tier, approvedAt: now },
        });
      }
      return tx.partner.create({
        data: {
          tenantId,
          tier: input.tier,
          status: 'active',
          displayName: input.displayName,
          kind: input.kind,
          websiteUrl: input.websiteUrl ?? null,
          referralCode: await uniqueReferralCode(tx),
          appliedAt: now,
          approvedAt: now,
          certifiedAt: input.tier === 'certified' ? now : null,
        },
      });
    });
    await publishPartnerEvent('partner.activated', tenantId, null, {
      partnerId: partner.id,
      tier: partner.tier,
    });
    return partner;
  },

  // ── Internal hooks (shared-secret) ───────────────────────────────────────────

  /** Signup attribution hook (docs/114 §B.3). Resolve the partner by referral code
   *  (withSystem — any active partner, code isn't directory-gated), then insert the
   *  referral row under the PARTNER's tenant context (RLS-safe cross-org write). */
  async recordReferral(raw: unknown): Promise<{ recorded: boolean }> {
    const input = InternalRecordReferralInput.parse(raw);
    const partner = await withSystem((tx) =>
      tx.partner.findFirst({
        where: { referralCode: input.referralCode, status: 'active' },
        select: { id: true, tenantId: true, tier: true },
      })
    );
    if (!partner) return { recorded: false };
    if (partner.tenantId === input.referredTenantId) return { recorded: false }; // no self-referral

    const rate = firstPaymentRate(partner.tier);
    await withTenant({ tenantId: partner.tenantId }, async (tx) => {
      const dup = await tx.partnerReferral.findUnique({
        where: { referredTenantId: input.referredTenantId },
        select: { id: true },
      });
      if (dup) return;
      await tx.partnerReferral.create({
        data: {
          tenantId: partner.tenantId,
          partnerId: partner.id,
          referredTenantId: input.referredTenantId,
          referralCode: input.referralCode,
          commissionRate: rate,
          commissionType: 'one_time',
          status: 'pending',
        },
      });
    });
    await publishPartnerEvent('partner.referral.created', partner.tenantId, null, {
      partnerId: partner.id,
      referredTenantId: input.referredTenantId,
    });
    return { recorded: true };
  },

  /** First-payment hook (docs/114 §B.3-4). The referred org's first invoice cleared
   *  → mark the referral active + accrue a one-time commission at the snapshot rate. */
  async accrueFirstPayment(raw: unknown): Promise<{ accrued: boolean }> {
    const input = InternalReferralPaymentInput.parse(raw);
    // The referral lives under the partner's tenant, so resolve it globally first.
    const referral = await withSystem((tx) =>
      tx.partnerReferral.findUnique({
        where: { referredTenantId: input.referredTenantId },
        select: {
          id: true,
          tenantId: true,
          partnerId: true,
          commissionRate: true,
          firstPaymentAt: true,
        },
      })
    );
    if (!referral || referral.firstPaymentAt) return { accrued: false };
    const amountCents = Math.round(input.netMrrCents * Number(referral.commissionRate));
    await withTenant({ tenantId: referral.tenantId }, async (tx) => {
      await tx.partnerReferral.update({
        where: { id: referral.id },
        data: { firstPaymentAt: new Date(), status: 'active' },
      });
      await tx.partnerCommission.create({
        data: {
          tenantId: referral.tenantId,
          partnerId: referral.partnerId,
          referralId: referral.id,
          amountCents,
          kind: 'one_time',
          status: 'pending',
        },
      });
    });
    await publishPartnerEvent('partner.commission.accrued', referral.tenantId, null, {
      partnerId: referral.partnerId,
      amountCents,
    });
    return { accrued: true };
  },

  /** Staff: the review queue on the platform tenant. */
  listApplications(status?: 'pending' | 'approved' | 'rejected') {
    const platformTenantId = env.SPARX_PLATFORM_TENANT_ID;
    if (!platformTenantId) return Promise.resolve([]);
    return withTenant({ tenantId: platformTenantId }, (tx) =>
      tx.partnerApplication.findMany({
        where: status ? { status } : undefined,
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
    );
  },

  /** Staff: approve an application → provision/activate the applicant's partner row
   *  at the requested (or overridden) tier. Requires the applicant to have an org. */
  async approveApplication(raw: unknown) {
    const input = InternalApproveApplicationInput.parse(raw);
    const platformTenantId = env.SPARX_PLATFORM_TENANT_ID;
    if (!platformTenantId) throw badRequest('Platform tenant not configured.');
    const app = await withTenant({ tenantId: platformTenantId }, (tx) =>
      tx.partnerApplication.findUnique({ where: { id: input.applicationId } })
    );
    if (!app) throw notFound('Application', input.applicationId);
    if (!app.applicantTenantId) throw badRequest('Applicant has no Sparx account yet.');
    const tier = (input.tier ?? app.requestedTier) as PartnerTier;
    const partner = await partnerService.provisionForTenant(app.applicantTenantId, {
      displayName: app.name,
      kind: app.kind,
      tier,
      websiteUrl: app.websiteUrl,
    });
    await withTenant({ tenantId: platformTenantId }, (tx) =>
      tx.partnerApplication.update({
        where: { id: app.id },
        data: { status: 'approved', reviewedAt: new Date() },
      })
    );
    return partner;
  },

  /** Staff: set a partner's tier directly (by the partner's tenant id). */
  async setTier(partnerTenantId: string, raw: unknown) {
    const input = InternalSetTierInput.parse(raw);
    return withTenant({ tenantId: partnerTenantId }, (tx) =>
      tx.partner.update({
        where: { tenantId: partnerTenantId },
        data: {
          tier: input.tier,
          certifiedAt: input.tier === 'certified' ? new Date() : undefined,
        },
      })
    );
  },

  /** Staff: suspend / reinstate a partner (by the partner's tenant id). */
  async setStatus(partnerTenantId: string, status: 'active' | 'suspended') {
    return withTenant({ tenantId: partnerTenantId }, (tx) =>
      tx.partner.update({ where: { tenantId: partnerTenantId }, data: { status } })
    );
  },

  /** Staff: reject a pending application (docs/114 §B.2). Written under the
   *  platform tenant's context, mirroring listApplications/approveApplication. */
  async rejectApplication(applicationId: string, note?: string) {
    const platformTenantId = env.SPARX_PLATFORM_TENANT_ID;
    if (!platformTenantId) throw badRequest('Platform tenant not configured.');
    return withTenant({ tenantId: platformTenantId }, (tx) =>
      tx.partnerApplication.update({
        where: { id: applicationId },
        data: { status: 'rejected', reviewedAt: new Date(), ...(note ? { note } : {}) },
      })
    );
  },

  /** Staff (operator console): the cross-partner roster. `withSystem` +
   *  `partners_visibility` expose only ACTIVE partners — a suspended partner drops
   *  out of this list (reach it by its tenant id via `adminDetail`, whose own
   *  tenant context still sees the row, to reinstate). */
  listAllPartners() {
    return withSystem((tx) =>
      tx.partner.findMany({
        where: { status: 'active', deletedAt: null },
        orderBy: { displayName: 'asc' },
      })
    );
  },

  /** Staff (operator console): one partner's full picture in a single tenant tx —
   *  profile, the referral ledger (+ referred org names), commissions, and payout
   *  runs. Read under the partner's OWN tenant context, so a suspended partner is
   *  still fully visible here (its own row is exempt from the active-only policy). */
  async adminDetail(partnerTenantId: string) {
    const data = await withTenant({ tenantId: partnerTenantId }, async (tx) => {
      const partner = await tx.partner.findUnique({ where: { tenantId: partnerTenantId } });
      if (!partner) return null;
      const [referrals, commissions, payouts] = await Promise.all([
        tx.partnerReferral.findMany({
          where: { tenantId: partnerTenantId },
          orderBy: { createdAt: 'desc' },
        }),
        tx.partnerCommission.findMany({
          where: { tenantId: partnerTenantId },
          orderBy: { createdAt: 'desc' },
        }),
        tx.partnerPayoutRun.findMany({
          where: { tenantId: partnerTenantId },
          orderBy: { createdAt: 'desc' },
        }),
      ]);
      return { partner, referrals, commissions, payouts };
    });
    if (!data) return null;
    const names = await resolveOrgNames(data.referrals.map((r) => r.referredTenantId));
    return {
      ...data,
      referrals: data.referrals.map((r) => ({
        ...r,
        referredOrgName: names.get(r.referredTenantId) ?? null,
      })),
    };
  },
};
