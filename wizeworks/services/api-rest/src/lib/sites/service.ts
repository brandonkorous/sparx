// Cross-tenant site (Property) reads for the operator console (docs/apps/admin —
// user & site management). The fleet-wide roster + one site's detail are read
// under `withSystem` — the no-tenant operator/system context the additive
// `properties_operator_read` visibility policy exposes (migration
// 20261202000000_operator_user_site_visibility). Normal tenant requests keep
// seeing only their own sites via the untouched tenant_isolation policy.
//
// Domains are a non-RLS dispatch table, so the domain reads / counts need no GUC.
// Owning-tenant names resolve against the non-RLS `tenants` table with the plain
// client — exactly like the tenant + user lists.

import { prisma, withSystem, type Prisma } from '@wizeworks/db';
import type {
  OperatorSiteListItem,
  OperatorSiteListResult,
  OperatorSiteDetail,
  OperatorSiteDomain,
} from '@wizeworks/operator';

export interface ListSitesParams {
  q?: string;
  status?: string;
  limit: number;
  offset: number;
}

const SITE_LIST_SELECT = {
  id: true,
  name: true,
  slug: true,
  tenantId: true,
  isPrimary: true,
  status: true,
  createdAt: true,
  _count: { select: { domains: true } },
} satisfies Prisma.PropertySelect;

type SiteListRow = Prisma.PropertyGetPayload<{ select: typeof SITE_LIST_SELECT }>;

interface TenantName {
  name: string;
  slug: string;
}

async function resolveTenantNames(ids: string[]): Promise<Map<string, TenantName>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return new Map();
  const rows = await prisma.tenant.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, slug: true },
  });
  return new Map(rows.map((r) => [r.id, { name: r.name, slug: r.slug }]));
}

function toSiteListItem(row: SiteListRow, names: Map<string, TenantName>): OperatorSiteListItem {
  const t = names.get(row.tenantId);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    tenantId: row.tenantId,
    tenantName: t?.name ?? null,
    tenantSlug: t?.slug ?? null,
    isPrimary: row.isPrimary,
    status: row.status,
    domainCount: row._count.domains,
    createdAt: row.createdAt.toISOString(),
  };
}

/** The cross-tenant site roster, filtered + paginated. */
export async function listAllSites(params: ListSitesParams): Promise<OperatorSiteListResult> {
  const q = (params.q ?? '').trim();
  const where: Prisma.PropertyWhereInput = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { slug: { contains: q, mode: 'insensitive' } },
    ];
  }
  const status = params.status?.trim();
  if (status) where.status = status;

  const { rows, total } = await withSystem(async (tx) => {
    const [rows, total] = await Promise.all([
      tx.property.findMany({
        where,
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
        take: params.limit,
        skip: params.offset,
        select: SITE_LIST_SELECT,
      }),
      tx.property.count({ where }),
    ]);
    return { rows, total };
  });

  const names = await resolveTenantNames(rows.map((r) => r.tenantId));
  return {
    sites: rows.map((r) => toSiteListItem(r, names)),
    total,
    limit: params.limit,
    offset: params.offset,
  };
}

/** One site's full detail (+ hostnames), or null if unknown. */
export async function siteDetail(siteId: string): Promise<OperatorSiteDetail | null> {
  const data = await withSystem(async (tx) => {
    const site = await tx.property.findUnique({
      where: { id: siteId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        isPrimary: true,
        showPlatformCredit: true,
        moduleScope: true,
        tenantId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!site) return null;
    const domains = await tx.domain.findMany({
      where: { propertyId: siteId },
      orderBy: [{ isCanonical: 'desc' }, { createdAt: 'asc' }],
      select: {
        host: true,
        type: true,
        status: true,
        isCanonical: true,
        verifiedAt: true,
        createdAt: true,
      },
    });
    return { site, domains };
  });
  if (!data) return null;

  const names = await resolveTenantNames([data.site.tenantId]);
  const t = names.get(data.site.tenantId);
  const domains: OperatorSiteDomain[] = data.domains.map((d) => ({
    host: d.host,
    type: d.type,
    status: d.status,
    isCanonical: d.isCanonical,
    verifiedAt: d.verifiedAt?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
  }));

  return {
    id: data.site.id,
    name: data.site.name,
    slug: data.site.slug,
    status: data.site.status,
    isPrimary: data.site.isPrimary,
    showPlatformCredit: data.site.showPlatformCredit,
    moduleScope: Array.isArray(data.site.moduleScope) ? (data.site.moduleScope as string[]) : [],
    tenantId: data.site.tenantId,
    tenantName: t?.name ?? null,
    tenantSlug: t?.slug ?? null,
    domains,
    createdAt: data.site.createdAt.toISOString(),
    updatedAt: data.site.updatedAt.toISOString(),
  };
}
