// Operator staff-user (User/Member) surface (docs/apps/admin — user & site
// management). Cross-tenant reads of the staff-user roster + a user's memberships,
// and bounded, audited membership WRITES (suspend/reactivate, role change, remove)
// plus a password-reset trigger. Same Layer-5 shared-secret auth as the other
// operator routes; the admin app is the capability gate (`user:read` / `user:act`)
// + the wize_admin audit writer.
//
// Reads run under `withSystem` (the *_operator_read visibility policies); WRITES
// run under `withTenant({ tenantId })` (the org the membership belongs to) so the
// standard tenant_isolation policy + WITH CHECK apply, and stamp the TENANT's own
// audit_logs as an operator action (actor_type='operator') — exactly like
// operator-tenant.ts — so the tenant owner sees WizeWorks-initiated team changes.
// The password reset runs through the dashboard reverse seam (Better Auth lives
// only in the dashboard process).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant, type Prisma } from '@sparx/db';
import type {
  OperatorUserListResult,
  OperatorUserDetail,
  OperatorUserMembershipsResult,
  OperatorPasswordResetResult,
} from '@sparx/operator';

import {
  authorizeOperator,
  badRequest,
  notFound,
  operatorIdOf,
  HttpError,
} from './operator-internal.js';
import { listAllUsers, userDetail, userMemberships } from '../../lib/users/service.js';
import { requestUserPasswordReset } from '../../lib/users/password-reset.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Per-membership roles (docs/78 §3). The operator can move a member between these.
const MEMBER_ROLES = new Set([
  'owner',
  'admin',
  'editor',
  'builder',
  'marketing',
  'support',
  'viewer',
]);

const MembershipStatusSchema = z.object({ tenantId: z.string().uuid(), suspended: z.boolean() });
const MembershipRoleSchema = z.object({ tenantId: z.string().uuid(), role: z.string() });
const MembershipRemoveSchema = z.object({ tenantId: z.string().uuid() });

function clampLimit(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n)) return 50;
  return Math.min(200, Math.max(1, n));
}
function toOffset(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Would removing/suspending this member strip the org of its last ACTIVE owner?
 *  A tenant with no reachable owner is locked out — never allow it. */
async function wouldOrphanOwner(
  tenantId: string,
  userId: string,
  nextActive: boolean
): Promise<boolean> {
  return withTenant({ tenantId }, async (tx) => {
    const target = await tx.member.findUnique({
      where: { organizationId_userId: { organizationId: tenantId, userId } },
      select: { role: true, status: true },
    });
    if (target?.role !== 'owner') return false;
    // If the target stays active (nextActive) it can't orphan anyone.
    if (nextActive) return false;
    const otherActiveOwners = await tx.member.count({
      where: {
        organizationId: tenantId,
        role: 'owner',
        status: 'active',
        NOT: { userId },
      },
    });
    return otherActiveOwners === 0;
  });
}

/** Stamp the tenant's own audit_logs for an operator-initiated team change. */
async function stampMemberAudit(
  tenantId: string,
  userId: string,
  operatorId: string | null,
  action: string,
  diff: Prisma.InputJsonValue
): Promise<void> {
  await withTenant({ tenantId }, async (tx) => {
    await tx.auditLog.create({
      data: {
        tenantId,
        actorId: operatorId,
        actorType: 'operator',
        action,
        entityType: 'member',
        entityId: userId,
        diff,
        ipAddress: null,
        userAgent: null,
      },
    });
  });
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const operatorUserRoutes: FastifyPluginAsync = async (app) => {
  const opts = { logLevel: 'warn' as const, schema: { hide: true } };

  app.get<{ Querystring: { q?: string; limit?: string; offset?: string } }>(
    '/internal/operator/users',
    opts,
    async (request) => {
      authorizeOperator(request);
      const result: OperatorUserListResult = await listAllUsers({
        q: request.query.q,
        limit: clampLimit(request.query.limit),
        offset: toOffset(request.query.offset),
      });
      return result;
    }
  );

  app.get<{ Params: { id: string } }>('/internal/operator/users/:id', opts, async (request) => {
    authorizeOperator(request);
    const { id } = request.params;
    if (!UUID_RE.test(id)) throw badRequest('Invalid user id.');
    const detail: OperatorUserDetail | null = await userDetail(id);
    if (!detail) throw notFound('User not found.');
    return detail;
  });

  // Suspend / reactivate a user's membership in one tenant (Member.status).
  app.patch<{ Params: { id: string } }>(
    '/internal/operator/users/:id/membership-status',
    opts,
    async (request) => {
      authorizeOperator(request);
      const { id } = request.params;
      if (!UUID_RE.test(id)) throw badRequest('Invalid user id.');
      const parsed = MembershipStatusSchema.safeParse(request.body);
      if (!parsed.success)
        throw badRequest('`tenantId` (uuid) and `suspended` (boolean) required.');
      const { tenantId, suspended } = parsed.data;
      const operatorId = operatorIdOf(request);

      if (suspended && (await wouldOrphanOwner(tenantId, id, false))) {
        throw new HttpError(409, 'LAST_OWNER', 'Cannot suspend a tenant’s last active owner.');
      }

      const nextStatus = suspended ? 'suspended' : 'active';
      const changed = await withTenant({ tenantId }, async (tx) => {
        const member = await tx.member.findUnique({
          where: { organizationId_userId: { organizationId: tenantId, userId: id } },
          select: { status: true },
        });
        if (!member) throw notFound('Membership not found.');
        if (member.status === nextStatus) return false;
        await tx.member.update({
          where: { organizationId_userId: { organizationId: tenantId, userId: id } },
          data: { status: nextStatus },
        });
        return true;
      });

      if (changed) {
        await stampMemberAudit(
          tenantId,
          id,
          operatorId,
          suspended ? 'member.suspended' : 'member.reactivated',
          { status: nextStatus }
        );
      }

      const result: OperatorUserMembershipsResult = { memberships: await userMemberships(id) };
      return result;
    }
  );

  // Change a user's role within one tenant (Member.role).
  app.patch<{ Params: { id: string } }>(
    '/internal/operator/users/:id/membership-role',
    opts,
    async (request) => {
      authorizeOperator(request);
      const { id } = request.params;
      if (!UUID_RE.test(id)) throw badRequest('Invalid user id.');
      const parsed = MembershipRoleSchema.safeParse(request.body);
      if (!parsed.success || !MEMBER_ROLES.has(parsed.data.role)) {
        throw badRequest('`tenantId` (uuid) and a valid `role` are required.');
      }
      const { tenantId, role } = parsed.data;
      const operatorId = operatorIdOf(request);

      // Demoting the last owner out of the owner role orphans the tenant.
      if (role !== 'owner' && (await wouldOrphanOwner(tenantId, id, false))) {
        throw new HttpError(409, 'LAST_OWNER', 'Cannot demote a tenant’s last active owner.');
      }

      const before = await withTenant({ tenantId }, async (tx) => {
        const member = await tx.member.findUnique({
          where: { organizationId_userId: { organizationId: tenantId, userId: id } },
          select: { role: true },
        });
        if (!member) throw notFound('Membership not found.');
        if (member.role === role) return null;
        await tx.member.update({
          where: { organizationId_userId: { organizationId: tenantId, userId: id } },
          data: { role },
        });
        return member.role;
      });

      if (before !== null) {
        await stampMemberAudit(tenantId, id, operatorId, 'member.role_changed', {
          before: { role: before },
          after: { role },
        });
      }

      const result: OperatorUserMembershipsResult = { memberships: await userMemberships(id) };
      return result;
    }
  );

  // Remove a user's membership from one tenant.
  app.delete<{ Params: { id: string } }>(
    '/internal/operator/users/:id/membership',
    opts,
    async (request) => {
      authorizeOperator(request);
      const { id } = request.params;
      if (!UUID_RE.test(id)) throw badRequest('Invalid user id.');
      const parsed = MembershipRemoveSchema.safeParse(request.body);
      if (!parsed.success) throw badRequest('`tenantId` (uuid) is required.');
      const { tenantId } = parsed.data;
      const operatorId = operatorIdOf(request);

      if (await wouldOrphanOwner(tenantId, id, false)) {
        throw new HttpError(409, 'LAST_OWNER', 'Cannot remove a tenant’s last active owner.');
      }

      const removed = await withTenant({ tenantId }, async (tx) => {
        const member = await tx.member.findUnique({
          where: { organizationId_userId: { organizationId: tenantId, userId: id } },
          select: { role: true, memberType: true },
        });
        if (!member) return null;
        await tx.member.delete({
          where: { organizationId_userId: { organizationId: tenantId, userId: id } },
        });
        return member;
      });
      if (!removed) throw notFound('Membership not found.');

      await stampMemberAudit(tenantId, id, operatorId, 'member.removed', {
        role: removed.role,
        memberType: removed.memberType,
      });

      const result: OperatorUserMembershipsResult = { memberships: await userMemberships(id) };
      return result;
    }
  );

  // Send the user a password-reset email (Better Auth, via the dashboard seam).
  app.post<{ Params: { id: string } }>(
    '/internal/operator/users/:id/password-reset',
    opts,
    async (request) => {
      authorizeOperator(request);
      const { id } = request.params;
      if (!UUID_RE.test(id)) throw badRequest('Invalid user id.');
      const operatorId = operatorIdOf(request);

      const detail = await userDetail(id);
      if (!detail) throw notFound('User not found.');

      const sent = await requestUserPasswordReset(detail.email);

      // Audit against the user's home tenant (their provisioning org).
      await stampMemberAudit(detail.homeTenantId, id, operatorId, 'member.password_reset', {
        email: detail.email,
        sent,
      });

      const result: OperatorPasswordResetResult = { sent };
      return result;
    }
  );
};

export default operatorUserRoutes;
