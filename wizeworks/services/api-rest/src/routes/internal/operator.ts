// Internal operator seam (docs/apps/admin/build-plan.md §2 D6, §7). The single
// door through which the WizeWorks admin console (wizeworks/apps/admin) reads cross-tenant
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
// Endpoints:
//   • GET /internal/operator/whoami        — Slice-1 round-trip probe
//   • GET /internal/operator/tenants       — cross-tenant tenant list (Slice 2)
//   • GET /internal/operator/tenants/:id   — one tenant's full detail (Slice 2)
//
// Representation parity (D7): the tenant reads compute the SAME values the tenant's
// own dashboard shows — the subscription snapshot via `@wizeworks/billing.getBillingState`,
// module enablement via `@wizeworks/modules.deriveModuleStates`, and real storage from
// media `byteSize` — so operators understand an account without impersonating it.
//
// The `tenants` + `domains` tables are non-RLS dispatch rows, read with the plain
// system client. Tenant-scoped data (storage, the tenant's audit trail) is read
// under the tenant's GUC via `withTenant`. This service NEVER writes the operator
// audit log — that lives in the `wize_admin` schema, which only the admin app can
// reach; the admin app audits each read at the action level before calling here.

import type { FastifyPluginAsync } from 'fastify';
import { prisma, withTenant, withSystem, type Prisma } from '@wizeworks/db';
import { deriveModuleStates, blockingDependents, type ModuleSlug } from '@wizeworks/modules';
import { getBillingState, MODULE_MONTHLY_CENTS } from '@wizeworks/billing';
import type {
  OperatorWhoAmIResult,
  OperatorTenantListItem,
  OperatorTenantListResult,
  OperatorTenantDetail,
  OperatorBillingInterval,
} from '@wizeworks/operator';

import { computeMetrics } from './operator-metrics.js';
import { authorizeOperator, badRequest, notFound, operatorIdOf } from './operator-internal.js';
import { readStorageLimitBytes } from '../../lib/tenant-limits.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Tenant read helpers (pure DTO assembly; exported for the billing plugin) ──

/** The columns the list needs — everything derivable from the tenant row alone,
 *  so the list is a single findMany with no per-tenant follow-up query. */
export const TENANT_LIST_SELECT = {
  id: true,
  slug: true,
  name: true,
  email: true,
  plan: true,
  status: true,
  subscriptionStatus: true,
  trialEndsAt: true,
  currentPeriodEnd: true,
  cancelAtPeriodEnd: true,
  billingInterval: true,
  settings: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TenantSelect;

type TenantListRow = Prisma.TenantGetPayload<{ select: typeof TENANT_LIST_SELECT }>;

function toInterval(raw: string | null | undefined): OperatorBillingInterval {
  return raw === 'annual' ? 'annual' : 'monthly';
}

/** Enterprise tenants (Gillett Diesel, docs/92) flag `settings.billing.planType`. */
function planTypeOf(settings: unknown): 'standard' | 'enterprise' {
  const billing = (settings as { billing?: { planType?: string } } | null)?.billing;
  return billing?.planType === 'enterprise' ? 'enterprise' : 'standard';
}

/** MRR = the sum of EXPLICIT billable modules (bundled-free capabilities are $0),
 *  matching the dashboard plan total in `@wizeworks/billing.getBillingState`. */
function mrrCentsOf(states: ReturnType<typeof deriveModuleStates>): number {
  return (Object.keys(MODULE_MONTHLY_CENTS) as ModuleSlug[])
    .filter((m) => states[m].source === 'explicit')
    .reduce((sum, m) => sum + (MODULE_MONTHLY_CENTS[m] ?? 0), 0);
}

export function toTenantListItem(row: TenantListRow): OperatorTenantListItem {
  const states = deriveModuleStates(row.settings);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    email: row.email,
    plan: row.plan,
    status: row.status,
    subscriptionStatus: row.subscriptionStatus,
    planType: planTypeOf(row.settings),
    trialEndsAt: row.trialEndsAt?.toISOString() ?? null,
    currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    billingInterval: toInterval(row.billingInterval),
    activeModules: (Object.keys(states) as ModuleSlug[]).filter((m) => states[m].enabled),
    mrrCents: mrrCentsOf(states),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function clampLimit(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n)) return 50;
  return Math.min(200, Math.max(1, n));
}

function toOffset(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Signup-series window in days — default 90, clamped 1–365. */
function clampWindow(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n)) return 90;
  return Math.min(365, Math.max(1, n));
}

// ── Route registration ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const operatorInternalRoutes: FastifyPluginAsync = async (app) => {
  app.get('/internal/operator/whoami', { logLevel: 'warn', schema: { hide: true } }, (request) => {
    authorizeOperator(request);
    const result: OperatorWhoAmIResult = {
      ok: true,
      operatorId: operatorIdOf(request),
      service: 'api-rest',
      time: new Date().toISOString(),
    };
    return result;
  });

  app.get<{
    Querystring: { q?: string; status?: string; plan?: string; limit?: string; offset?: string };
  }>(
    '/internal/operator/tenants',
    { logLevel: 'warn', schema: { hide: true } },
    async (request) => {
      authorizeOperator(request);

      const q = (request.query.q ?? '').trim();
      const limit = clampLimit(request.query.limit);
      const offset = toOffset(request.query.offset);

      const where: Prisma.TenantWhereInput = {};
      if (q) {
        where.OR = [
          { name: { contains: q, mode: 'insensitive' } },
          { slug: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ];
      }
      const status = request.query.status?.trim();
      if (status) where.status = status;
      const plan = request.query.plan?.trim();
      if (plan) where.plan = plan;

      const [rows, total] = await Promise.all([
        prisma.tenant.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
          select: TENANT_LIST_SELECT,
        }),
        prisma.tenant.count({ where }),
      ]);

      const result: OperatorTenantListResult = {
        tenants: rows.map(toTenantListItem),
        total,
        limit,
        offset,
      };
      return result;
    }
  );

  app.get<{ Params: { id: string } }>(
    '/internal/operator/tenants/:id',
    { logLevel: 'warn', schema: { hide: true } },
    async (request) => {
      authorizeOperator(request);
      const { id } = request.params;
      if (!UUID_RE.test(id)) throw badRequest('Invalid tenant id.');

      const tenant = await prisma.tenant.findUnique({
        where: { id },
        select: {
          id: true,
          slug: true,
          name: true,
          email: true,
          plan: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          stripeCustomerId: true,
          settings: true,
          acquisitionChannel: true,
          acquisitionSource: true,
          acquisitionCampaign: true,
          acquiredAt: true,
        },
      });
      if (!tenant) throw notFound('Tenant not found.');

      // Canonical parity: the exact subscription snapshot the tenant's own
      // dashboard renders (Finance → subscription).
      const billing = await getBillingState(id);

      const states = deriveModuleStates(tenant.settings);
      const modules = (Object.keys(states) as ModuleSlug[]).map((key) => ({
        key,
        enabled: states[key].enabled,
        source: states[key].source,
        includedBy: states[key].includedBy,
        requiredBy: blockingDependents(key, (m) => states[m].enabled),
        monthlyCents: states[key].source === 'explicit' ? (MODULE_MONTHLY_CENTS[key] ?? 0) : 0,
      }));

      // Domains live on the non-RLS dispatch table — filter by tenant id.
      const domains = await prisma.domain.findMany({
        where: { tenantId: id },
        orderBy: [{ isCanonical: 'desc' }, { createdAt: 'asc' }],
        select: {
          host: true,
          type: true,
          status: true,
          isCanonical: true,
          verifiedAt: true,
          expiresAt: true,
          createdAt: true,
        },
      });

      // Tenant-scoped (FORCE RLS) reads under the tenant's GUC: storage footprint
      // + the tenant's own recent activity trail (the read-only "understand this
      // account" view that replaces impersonation, D7).
      const scoped = await withTenant({ tenantId: id }, async (tx) => {
        const assets = await tx.mediaAsset.aggregate({ _sum: { byteSize: true }, _count: true });
        const variants = await tx.mediaVariant.aggregate({ _sum: { byteSize: true } });
        const activity = await tx.auditLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 25,
          select: {
            id: true,
            action: true,
            actorType: true,
            entityType: true,
            entityId: true,
            createdAt: true,
          },
        });
        // The tenant's team + sites (both FORCE-RLS on tenant_id; readable under
        // the tenant's own GUC). Member USER identity is resolved separately below
        // (a consultant's user row lives in ANOTHER tenant, hidden here).
        const members = await tx.member.findMany({
          where: { organizationId: id },
          orderBy: { createdAt: 'asc' },
          select: { userId: true, role: true, memberType: true, status: true },
        });
        const properties = await tx.property.findMany({
          where: { tenantId: id },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          select: { id: true, name: true, slug: true, status: true, isPrimary: true },
        });
        return { assets, variants, activity, members, properties };
      });

      const assetBytes = Number(scoped.assets._sum.byteSize ?? 0n);
      const variantBytes = Number(scoped.variants._sum.byteSize ?? 0n);

      // Resolve member identities cross-tenant (users_operator_read visibility
      // policy exposes rows in the no-tenant system context) so consultant members
      // still show a name/email.
      const memberUserIds = scoped.members.map((m) => m.userId);
      const memberUsers =
        memberUserIds.length > 0
          ? await withSystem((tx) =>
              tx.user.findMany({
                where: { id: { in: memberUserIds } },
                select: { id: true, name: true, email: true },
              })
            )
          : [];
      const userMap = new Map(memberUsers.map((u) => [u.id, u]));

      const detail: OperatorTenantDetail = {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        email: tenant.email,
        plan: tenant.plan,
        status: tenant.status,
        createdAt: tenant.createdAt.toISOString(),
        updatedAt: tenant.updatedAt.toISOString(),
        hasStripeCustomer: Boolean(tenant.stripeCustomerId),
        acquisition: {
          channel: tenant.acquisitionChannel,
          source: tenant.acquisitionSource,
          campaign: tenant.acquisitionCampaign,
          acquiredAt: tenant.acquiredAt?.toISOString() ?? null,
        },
        billing: {
          configured: billing.configured,
          billingActive: billing.billingActive,
          subscriptionStatus: billing.subscriptionStatus,
          trialEndsAt: billing.trialEndsAt,
          currentPeriodEnd: billing.currentPeriodEnd,
          cancelAtPeriodEnd: billing.cancelAtPeriodEnd,
          billingInterval: billing.billingInterval,
          planTotalCents: billing.planTotalCents,
          planType: billing.planType,
        },
        modules,
        domains: domains.map((d) => ({
          host: d.host,
          type: d.type,
          status: d.status,
          isCanonical: d.isCanonical,
          verifiedAt: d.verifiedAt?.toISOString() ?? null,
          expiresAt: d.expiresAt?.toISOString() ?? null,
          createdAt: d.createdAt.toISOString(),
        })),
        storage: {
          assetBytes,
          variantBytes,
          totalBytes: assetBytes + variantBytes,
          assetCount: scoped.assets._count,
          storageLimitBytes: readStorageLimitBytes(tenant.settings),
        },
        recentActivity: scoped.activity.map((a) => ({
          id: a.id,
          action: a.action,
          actorType: a.actorType,
          entityType: a.entityType,
          entityId: a.entityId,
          createdAt: a.createdAt.toISOString(),
        })),
        members: scoped.members.map((m) => {
          const u = userMap.get(m.userId);
          return {
            userId: m.userId,
            name: u?.name ?? null,
            email: u?.email ?? null,
            role: m.role,
            memberType: m.memberType,
            status: m.status,
          };
        }),
        sites: scoped.properties.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          status: p.status,
          isPrimary: p.isPrimary,
        })),
      };
      return detail;
    }
  );

  app.get<{ Querystring: { windowDays?: string } }>(
    '/internal/operator/metrics',
    { logLevel: 'warn', schema: { hide: true } },
    async (request) => {
      authorizeOperator(request);
      const windowDays = clampWindow(request.query.windowDays);
      // One read of the non-RLS dispatch table; every figure is derived in memory
      // (computeMetrics) — no per-tenant scans.
      const rows = await prisma.tenant.findMany({
        select: {
          status: true,
          subscriptionStatus: true,
          cancelAtPeriodEnd: true,
          stripeSubscriptionId: true,
          settings: true,
          createdAt: true,
        },
      });
      return computeMetrics(rows, windowDays, new Date());
    }
  );
};

export default operatorInternalRoutes;
