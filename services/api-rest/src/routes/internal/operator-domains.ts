// Operator domain-management endpoints (docs/apps/admin/build-plan.md §5 Slice 5).
// The cross-tenant domain surface — every custom + sparx-purchased host, its
// SSL/TLS readiness, a live DNS diagnostic, the GoDaddy purchase/renewal ledger,
// and a force re-verify. Reads the non-RLS `domains` dispatch table directly (the
// same table the host→site resolver reads before a tenant is known); per-domain
// purchase history is tenant-scoped (FORCE RLS) and read under the tenant's GUC.
//
// Force re-verify mirrors the tenant's OWN verification path exactly (parity, D7):
//   · custom host    → re-run the synchronous DNS check (CNAME for subdomains, the
//                      TXT control-proof for apex) and flip status, same as
//                      POST /v1/domains/:id/verify.
//   · purchased host → re-publish `domain.purchased` to re-trigger the
//                      domain-worker (it re-polls CNAME propagation → active).
//   · subdomain/auto → nothing to verify (our zone is always live).
//
// Same Layer-5 shared-secret auth as the other operator routes; the admin app is
// the capability gate (domain:manage) + audit writer.

import { promises as dns } from 'node:dns';
import type { FastifyPluginAsync } from 'fastify';
import { prisma, withTenant, type Prisma } from '@sparx/db';
import {
  createPublisher,
  publishEvent,
  type PublisherLogger,
  type DomainPurchasedPayload,
} from '@sparx/events';
import type {
  OperatorDomainListItem,
  OperatorDomainListResult,
  OperatorDomainCounts,
  OperatorDomainDetail,
  OperatorDomainDnsProbe,
  OperatorDomainDnsRecord,
  OperatorDomainReverifyResult,
  OperatorDomainSslStatus,
  OperatorDomainVerificationMethod,
} from '@sparx/operator';

import { CNAME_TARGET, isSubdomainHost, verifyCname, verifyTxtToken } from '../../lib/domain.js';
import { authorizeOperator, badRequest, notFound, operatorIdOf } from './operator-internal.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TXT_PREFIX = '_sparx-verify.';

/** Statuses that mean a custom/purchased host is NOT yet serving — the operator
 *  work queue. `active`/`verified` are the terminal-good states. */
const ATTENTION_STATUSES = ['pending', 'verifying', 'failed', 'pending_ssl', 'transfer_pending'];

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// One publisher for the process lifetime (mirrors routes/v1/domains.ts). In dev
// without GCP_PROJECT_ID this is the Pub/Sub stub, so a queued re-verify is a
// no-op locally and a real re-trigger in prod — same as the tenant purchase flow.
const pubLogger: PublisherLogger = {
  info: (obj, msg) => console.info(msg ?? '', obj),
  warn: (obj, msg) => console.warn(msg ?? '', obj),
  error: (obj, msg) => console.error(msg ?? '', obj),
};
const publisher = createPublisher({ logger: pubLogger });

// ── Derivations ───────────────────────────────────────────────────────────────

/** TLS readiness from the routing lifecycle. Caddy issues on-demand certs once a
 *  host is authorized, so a live host is 'secured'; a purchased host still
 *  propagating is 'provisioning'; anything unverified is 'unsecured'. `*.sparx.zone`
 *  subdomains sit under our wildcard/on-demand cert, so they are always secured. */
function sslStatusOf(type: string, status: string): OperatorDomainSslStatus {
  if (status === 'active' || status === 'verified') return 'secured';
  if (type === 'subdomain') return 'secured';
  if (status === 'pending_ssl' || status === 'verifying') return 'provisioning';
  return 'unsecured';
}

function isExpiringSoon(expiresAt: Date | null, now: number): boolean {
  return expiresAt != null && expiresAt.getTime() <= now + THIRTY_DAYS_MS;
}

function verificationMethodOf(type: string, host: string): OperatorDomainVerificationMethod {
  if (type !== 'custom') return 'auto';
  return isSubdomainHost(host) ? 'cname' : 'txt';
}

// ── Live DNS probe ──────────────────────────────────────────────────────────

async function observeCname(host: string): Promise<string[]> {
  try {
    return (await dns.resolveCname(host)).map((c) => c.replace(/\.$/, ''));
  } catch {
    return [];
  }
}

async function observeTxt(name: string): Promise<string[]> {
  try {
    return (await dns.resolveTxt(name)).map((chunks) => chunks.join(''));
  } catch {
    return [];
  }
}

/** The expected records for a host, defined the same way `connectInstructions`
 *  does: the routing CNAME always applies; apex customs additionally carry the
 *  one-time TXT control-proof while a token is live. Subdomain hosts on our own
 *  zone have nothing an operator sets. */
function expectedRecords(
  type: string,
  host: string,
  verificationToken: string | null
): { kind: 'CNAME' | 'TXT'; name: string; expected: string }[] {
  if (type === 'subdomain') return [];
  const records: { kind: 'CNAME' | 'TXT'; name: string; expected: string }[] = [];
  // Apex custom domains prove ownership by TXT (CNAME-at-apex is unreliable), so
  // show the token record while it's live — alongside the routing CNAME/ALIAS.
  if (type === 'custom' && !isSubdomainHost(host) && verificationToken) {
    records.push({ kind: 'TXT', name: `${TXT_PREFIX}${host}`, expected: verificationToken });
  }
  records.push({ kind: 'CNAME', name: host, expected: CNAME_TARGET });
  return records;
}

/** Probe DNS for a host's expected records — expected vs. live-observed. Null for
 *  subdomain hosts (managed automatically). Never throws (lookups fail to []). */
async function probeDns(
  type: string,
  host: string,
  verificationToken: string | null
): Promise<OperatorDomainDnsProbe | null> {
  const expected = expectedRecords(type, host, verificationToken);
  if (expected.length === 0) return null;

  const records: OperatorDomainDnsRecord[] = await Promise.all(
    expected.map(async (rec): Promise<OperatorDomainDnsRecord> => {
      const observed =
        rec.kind === 'CNAME' ? await observeCname(rec.name) : await observeTxt(rec.name);
      const wanted = rec.expected.replace(/\.$/, '');
      return {
        kind: rec.kind,
        name: rec.name,
        expected: rec.expected,
        observed,
        matches: observed.some((v) => v.replace(/\.$/, '') === wanted),
      };
    })
  );

  return {
    checkedAt: new Date().toISOString(),
    records,
    allResolved: records.every((r) => r.matches),
  };
}

// ── DTO assembly ──────────────────────────────────────────────────────────────

type DomainWithTenant = Prisma.DomainGetPayload<{
  include: { tenant: { select: { name: true; slug: true; status: true } } };
}>;

function toListItem(row: DomainWithTenant, now: number): OperatorDomainListItem {
  return {
    id: row.id,
    host: row.host,
    type: row.type,
    status: row.status,
    sslStatus: sslStatusOf(row.type, row.status),
    isCanonical: row.isCanonical,
    tenantId: row.tenantId,
    tenantName: row.tenant.name,
    tenantSlug: row.tenant.slug,
    tenantStatus: row.tenant.status,
    registrar: row.registrar,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    expiringSoon: row.type === 'purchased' && isExpiringSoon(row.expiresAt, now),
    autoRenew: row.autoRenew,
    createdAt: row.createdAt.toISOString(),
  };
}

// ── Route plugin ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature.
const operatorDomainsRoutes: FastifyPluginAsync = async (app) => {
  const opts = { logLevel: 'warn' as const, schema: { hide: true } };

  // ── GET /internal/operator/domains — cross-tenant list ──────────────────────
  app.get<{
    Querystring: {
      q?: string;
      status?: string;
      type?: string;
      tenantId?: string;
      attention?: string;
      limit?: string;
      offset?: string;
    };
  }>('/internal/operator/domains', opts, async (request) => {
    authorizeOperator(request);
    const query = request.query;

    const limit = clampLimit(query.limit);
    const offset = toOffset(query.offset);
    const now = Date.now();

    const type =
      query.type === 'custom' || query.type === 'purchased' || query.type === 'subdomain'
        ? query.type
        : undefined;

    const where: Prisma.DomainWhereInput = {};
    if (query.tenantId && UUID_RE.test(query.tenantId)) where.tenantId = query.tenantId;
    if (query.q?.trim()) where.host = { contains: query.q.trim(), mode: 'insensitive' };
    // Default view is the domains operators manage (custom + purchased); the noisy
    // always-on *.sparx.zone subdomains are shown only when explicitly requested.
    where.type = type ?? { in: ['custom', 'purchased'] };
    if (query.status) where.status = query.status;
    else if (query.attention === '1') where.status = { in: ATTENTION_STATUSES };

    // Header counts are scoped to the tenant filter (when deep-linked) but NOT to
    // the finer q/status/type filters, so the strip stays a stable overview.
    const countWhere: Prisma.DomainWhereInput =
      query.tenantId && UUID_RE.test(query.tenantId) ? { tenantId: query.tenantId } : {};
    const soon = new Date(now + THIRTY_DAYS_MS);

    const [rows, total, byType, needsAttention, expiringSoon] = await Promise.all([
      prisma.domain.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: offset,
        take: limit,
        include: { tenant: { select: { name: true, slug: true, status: true } } },
      }),
      prisma.domain.count({ where }),
      prisma.domain.groupBy({ by: ['type'], where: countWhere, _count: true }),
      prisma.domain.count({
        where: {
          ...countWhere,
          type: { in: ['custom', 'purchased'] },
          status: { in: ATTENTION_STATUSES },
        },
      }),
      prisma.domain.count({
        where: { ...countWhere, type: 'purchased', expiresAt: { lte: soon } },
      }),
    ]);

    const typeCount = (t: string): number => byType.find((g) => g.type === t)?._count ?? 0;
    const counts: OperatorDomainCounts = {
      total: byType.reduce((sum, g) => sum + g._count, 0),
      custom: typeCount('custom'),
      purchased: typeCount('purchased'),
      subdomain: typeCount('subdomain'),
      needsAttention,
      expiringSoon,
    };

    const result: OperatorDomainListResult = {
      domains: rows.map((r) => toListItem(r, now)),
      total,
      limit,
      offset,
      counts,
    };
    return result;
  });

  // ── GET /internal/operator/domains/:id — full detail ────────────────────────
  app.get<{ Params: { id: string } }>('/internal/operator/domains/:id', opts, async (request) => {
    authorizeOperator(request);
    const { id } = request.params;
    if (!UUID_RE.test(id)) throw badRequest('Invalid domain id.');

    const row = await prisma.domain.findUnique({ where: { id } });
    if (!row) throw notFound('Domain not found.');

    const now = Date.now();
    const [tenant, scoped, dnsProbe] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: row.tenantId },
        select: { name: true, slug: true, status: true },
      }),
      // property (FORCE RLS) + purchase ledger (FORCE RLS) under one tenant GUC.
      withTenant({ tenantId: row.tenantId }, async (tx) => {
        const property = await tx.property.findUnique({
          where: { id: row.propertyId },
          select: { id: true, name: true, slug: true, status: true },
        });
        const purchases = await tx.domainPurchase.findMany({
          where: { domain: row.host },
          orderBy: { createdAt: 'desc' },
        });
        return { property, purchases };
      }),
      probeDns(row.type, row.host, row.verificationToken),
    ]);

    const detail: OperatorDomainDetail = {
      id: row.id,
      host: row.host,
      type: row.type,
      status: row.status,
      sslStatus: sslStatusOf(row.type, row.status),
      isCanonical: row.isCanonical,
      verifiedAt: row.verifiedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      registrar: row.registrar,
      registrarOrderId: row.registrarOrderId,
      registeredAt: row.registeredAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      autoRenew: row.autoRenew,
      whoisPrivacy: row.whoisPrivacy,
      renewalPriceCents: row.renewalPriceCents,
      expiringSoon: row.type === 'purchased' && isExpiringSoon(row.expiresAt, now),
      tenant: {
        id: row.tenantId,
        name: tenant?.name ?? '(unknown tenant)',
        slug: tenant?.slug ?? '',
        status: tenant?.status ?? 'unknown',
      },
      property: {
        id: row.propertyId,
        name: scoped.property?.name ?? null,
        slug: scoped.property?.slug ?? null,
      },
      verificationMethod: verificationMethodOf(row.type, row.host),
      dnsProbe,
      purchases: scoped.purchases.map((p) => ({
        id: p.id,
        domain: p.domain,
        registrar: p.registrar,
        registrarOrderId: p.registrarOrderId,
        amountCents: p.amountCents,
        years: p.years,
        type: p.type,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
      })),
    };
    return detail;
  });

  // ── POST /internal/operator/domains/:id/reverify — force re-verify ──────────
  app.post<{ Params: { id: string } }>(
    '/internal/operator/domains/:id/reverify',
    opts,
    async (request) => {
      authorizeOperator(request);
      const { id } = request.params;
      if (!UUID_RE.test(id)) throw badRequest('Invalid domain id.');

      const row = await prisma.domain.findUnique({ where: { id } });
      if (!row) throw notFound('Domain not found.');

      // Auto-managed hosts: nothing an operator can verify.
      if (row.type === 'subdomain') {
        return reverifyResult(row, {
          mode: 'noop',
          passed: null,
          message:
            'This is an automatic sparx.zone address — it is always live and needs no verification.',
          dnsProbe: null,
        });
      }

      // Purchased hosts: re-trigger the domain-worker, which re-polls CNAME
      // propagation and flips the domain to active once it resolves. dnsConfigured
      // is true — DNS was configured at purchase, so the worker skips the GoDaddy
      // re-config and goes straight to the propagation poll.
      if (row.type === 'purchased') {
        const latestPurchase = await withTenant({ tenantId: row.tenantId }, (tx) =>
          tx.domainPurchase.findFirst({
            where: { domain: row.host },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
          })
        );
        await publishEvent<DomainPurchasedPayload>(
          publisher,
          'domain.purchased',
          row.tenantId,
          operatorIdOf(request) ?? 'operator',
          {
            domain: row.host,
            orderId: row.registrarOrderId ?? '',
            purchaseId: latestPurchase?.id ?? '',
            propertyId: row.propertyId,
            dnsConfigured: true,
          },
          pubLogger
        );
        const dnsProbe = await probeDns(row.type, row.host, row.verificationToken);
        return reverifyResult(row, {
          mode: 'queued',
          passed: null,
          message:
            'Re-verification queued. The domain worker will re-check DNS propagation and activate the domain once its CNAME resolves.',
          dnsProbe,
        });
      }

      // Custom hosts: re-run the same synchronous DNS check the tenant's own
      // "Verify now" does (POST /v1/domains/:id/verify), with identical transitions.
      const apex = !isSubdomainHost(row.host);
      if (apex && !row.verificationToken) {
        // The one-time TXT token was spent on a prior success — there is nothing to
        // re-prove. Don't downgrade a live domain; report the current DNS instead.
        const dnsProbe = await probeDns(row.type, row.host, row.verificationToken);
        return reverifyResult(row, {
          mode: 'noop',
          passed: null,
          message:
            'This domain is already verified. To re-prove ownership, re-issue its verification record from the tenant’s dashboard first.',
          dnsProbe,
        });
      }

      const passed = apex
        ? await verifyTxtToken(row.host, row.verificationToken!)
        : await verifyCname(row.host, CNAME_TARGET);

      const updated = await prisma.domain.update({
        where: { id },
        data: passed
          ? { status: 'active', verifiedAt: new Date(), verificationToken: null }
          : { status: 'failed' },
      });
      const dnsProbe = await probeDns(updated.type, updated.host, updated.verificationToken);
      return reverifyResult(updated, {
        mode: 'synchronous',
        passed,
        message: passed
          ? 'Domain verified — it is now live and secures on the next request.'
          : apex
            ? `The TXT control-proof at ${TXT_PREFIX}${row.host} is not resolving yet. DNS can take a few minutes to propagate.`
            : `No CNAME for ${row.host} pointing to ${CNAME_TARGET} yet. DNS can take a few minutes to propagate.`,
        dnsProbe,
      });
    }
  );
};

/** Assemble a reverify result from a domain row + the outcome bits. */
function reverifyResult(
  row: { id: string; host: string; type: string; status: string; verifiedAt: Date | null },
  outcome: {
    mode: OperatorDomainReverifyResult['mode'];
    passed: boolean | null;
    message: string;
    dnsProbe: OperatorDomainDnsProbe | null;
  }
): OperatorDomainReverifyResult {
  return {
    id: row.id,
    host: row.host,
    mode: outcome.mode,
    status: row.status,
    sslStatus: sslStatusOf(row.type, row.status),
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    passed: outcome.passed,
    message: outcome.message,
    dnsProbe: outcome.dnsProbe,
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

export default operatorDomainsRoutes;
