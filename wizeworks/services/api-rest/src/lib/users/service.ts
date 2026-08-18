// Cross-tenant staff-user (User/Member) reads for the operator console
// (docs/apps/admin — user & site management). The fleet-wide roster + a user's
// full membership picture are read under `withSystem` — the no-tenant
// operator/system context that the additive `users_operator_read` /
// `members_operator_read` visibility policies expose (migration
// 20261202000000_operator_user_site_visibility). Normal tenant requests, which
// always have `current_tenant_id()` set, keep seeing only their own rows.
//
// Home-tenant names resolve against the non-RLS `tenants` dispatch table with the
// plain client (no GUC needed) — exactly like the tenant list.

import { prisma, withSystem, type Prisma } from '@wizeworks/db';
import type {
  OperatorUserListItem,
  OperatorUserListResult,
  OperatorUserDetail,
  OperatorUserMembership,
} from '@wizeworks/operator';

export interface ListUsersParams {
  q?: string;
  limit: number;
  offset: number;
}

const USER_LIST_SELECT = {
  id: true,
  email: true,
  name: true,
  emailVerified: true,
  tenantId: true,
  role: true,
  lastLoginAt: true,
  createdAt: true,
  _count: { select: { memberships: true } },
} satisfies Prisma.UserSelect;

type UserListRow = Prisma.UserGetPayload<{ select: typeof USER_LIST_SELECT }>;

interface TenantName {
  name: string;
  slug: string;
}

/** Resolve tenant ids → name/slug in one non-RLS read (the `tenants` dispatch
 *  table needs no tenant context). */
async function resolveTenantNames(ids: string[]): Promise<Map<string, TenantName>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return new Map();
  const rows = await prisma.tenant.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, slug: true },
  });
  return new Map(rows.map((r) => [r.id, { name: r.name, slug: r.slug }]));
}

function toUserListItem(row: UserListRow, names: Map<string, TenantName>): OperatorUserListItem {
  const home = names.get(row.tenantId);
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    emailVerified: row.emailVerified,
    homeTenantId: row.tenantId,
    homeTenantName: home?.name ?? null,
    homeTenantSlug: home?.slug ?? null,
    role: row.role,
    membershipCount: row._count.memberships,
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** The cross-tenant staff-user roster, filtered + paginated. */
export async function listAllUsers(params: ListUsersParams): Promise<OperatorUserListResult> {
  const q = (params.q ?? '').trim();
  const where: Prisma.UserWhereInput = {};
  if (q) {
    where.OR = [
      { email: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
    ];
  }

  const { rows, total } = await withSystem(async (tx) => {
    const [rows, total] = await Promise.all([
      tx.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.limit,
        skip: params.offset,
        select: USER_LIST_SELECT,
      }),
      tx.user.count({ where }),
    ]);
    return { rows, total };
  });

  const names = await resolveTenantNames(rows.map((r) => r.tenantId));
  return {
    users: rows.map((r) => toUserListItem(r, names)),
    total,
    limit: params.limit,
    offset: params.offset,
  };
}

/** One staff user's full detail + every org membership, or null if unknown. */
export async function userDetail(userId: string): Promise<OperatorUserDetail | null> {
  const data = await withSystem(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        image: true,
        role: true,
        tenantId: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) return null;
    const members = await tx.member.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: {
        organizationId: true,
        role: true,
        memberType: true,
        status: true,
        createdAt: true,
      },
    });
    return { user, members };
  });
  if (!data) return null;

  const names = await resolveTenantNames([
    data.user.tenantId,
    ...data.members.map((m) => m.organizationId),
  ]);

  const memberships: OperatorUserMembership[] = data.members.map((m) => {
    const t = names.get(m.organizationId);
    return {
      tenantId: m.organizationId,
      tenantName: t?.name ?? null,
      tenantSlug: t?.slug ?? null,
      role: m.role,
      memberType: m.memberType,
      status: m.status,
      createdAt: m.createdAt.toISOString(),
    };
  });

  const home = names.get(data.user.tenantId);
  return {
    id: data.user.id,
    email: data.user.email,
    name: data.user.name,
    emailVerified: data.user.emailVerified,
    image: data.user.image,
    role: data.user.role,
    homeTenantId: data.user.tenantId,
    homeTenantName: home?.name ?? null,
    homeTenantSlug: home?.slug ?? null,
    lastLoginAt: data.user.lastLoginAt?.toISOString() ?? null,
    createdAt: data.user.createdAt.toISOString(),
    updatedAt: data.user.updatedAt.toISOString(),
    memberships,
  };
}

/** Read a user's memberships (post-write refresh) → the DTO shape the detail
 *  re-renders from. Reused by the write handlers. */
export async function userMemberships(userId: string): Promise<OperatorUserMembership[]> {
  const members = await withSystem((tx) =>
    tx.member.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: {
        organizationId: true,
        role: true,
        memberType: true,
        status: true,
        createdAt: true,
      },
    })
  );
  const names = await resolveTenantNames(members.map((m) => m.organizationId));
  return members.map((m) => {
    const t = names.get(m.organizationId);
    return {
      tenantId: m.organizationId,
      tenantName: t?.name ?? null,
      tenantSlug: t?.slug ?? null,
      role: m.role,
      memberType: m.memberType,
      status: m.status,
      createdAt: m.createdAt.toISOString(),
    };
  });
}
