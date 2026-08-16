// Team — the tenant's roster and its pending invitations (docs/114 Part A).
//
//   GET    /v1/team/members               → the roster
//   PATCH  /v1/team/members/:id           → role and/or module access
//   DELETE /v1/team/members/:id           → remove from the tenant
//   GET    /v1/team/invitations           → live invitations only
//   POST   /v1/team/invitations           → invite (or re-send an existing one)
//   POST   /v1/team/invitations/:id/resend
//   DELETE /v1/team/invitations/:id       → revoke
//
// Two tables, both Better Auth's: `members` and `invitations`. The dashboard's
// organization() plugin writes the SAME rows — acceptance still runs through it
// (/accept-invite → plugin → `members` row), so a row created here must be one
// the plugin can accept: `status: 'pending'`, a real `inviter_id`, and an expiry
// matching the plugin's own `invitationExpiresIn` (7 days). No extra columns.
// This route is the MANAGEMENT surface, not a second invitation system.
//
// Reads are open to any member of the tenant — knowing who your colleagues are
// is not privileged, and the roster feeds assignee pickers and mention lists.
// Every mutation is owner/admin, enforced here rather than only in the UI.
//
// ── Two connections, on purpose ─────────────────────────────────────────────
//
// `members` / `invitations` / `users` are read and written through `authPrisma`
// (`sparx_owner`), NOT through `withRequestTenant`. Those tables are
// ENABLE-but-NOT-FORCE RLS (see 03-auth-org.prisma), and the `users` policy is
// the problem: a member's user row can legitimately belong to a DIFFERENT
// tenant than the org they are a member of. Someone who owns tenant A and also
// consults for tenant B has `users.tenant_id = A` but `members.organization_id
// = B`, so an RLS-scoped connection reading tenant B's roster sees the
// membership and NOT the user — Prisma's required `user` relation then finds
// nothing and the whole request 500s. `packages/auth/src/organizations.ts`
// reads these same tables through `authPrisma` for exactly this reason.
//
// The cost of that client is that RLS is no longer a backstop, so the WHERE
// clause is the ONLY tenant guard: every authPrisma query below pins
// `organizationId` to `auth.tenantId` (or filters through
// `member: { organizationId }`), and every lookup by a caller-supplied id uses
// the compound `{ id, organizationId }` — never the id alone.
//
// `audit_logs` IS force-RLS and stays on `withRequestTenant`. That means a
// mutation and its audit row are no longer one transaction; each handler
// mutates FIRST and audits after, so the log describes something that actually
// happened rather than a change that may have rolled back underneath it.

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withRequestTenant } from '@sparx/api-core/db';
import { ok } from '@sparx/api-core/envelope';
import { invalidateMemberAccessCache, requireAuth, requireRole } from '@sparx/api-core/auth';
import { writeAudit } from '@sparx/api-core/audit';
import { publish } from '@sparx/api-core/pubsub';
import { badRequest, conflict, forbidden, notFound } from '@sparx/api-core/errors';
import {
  ASSIGNABLE_ORG_ROLES,
  parseModuleAccessMode,
  roleIgnoresModuleAccess,
  PROPERTY_ACCESS_MODES,
  parsePropertyAccessMode,
  roleIgnoresPropertyAccess,
  type PropertyAccessMode,
  MODULE_ACCESS_MODES,
  authPrisma,
  type AssignableOrgRole,
  type ModuleAccessMode,
} from '@sparx/auth';
import { MODULE_SLUGS, MODULE_SLUG_SET } from '../../lib/module-toggle.js';
import { accountOrigin, appOrigin } from '@sparx/links/server';
import { tenantPlatformBrand } from '../../lib/tenant-brand.js';

// Better Auth's organization plugin is configured with
// `invitationExpiresIn: 60 * 60 * 24 * 7` (packages/auth/src/server.ts). An
// invitation minted here has to agree with that or the two surfaces would
// disagree about when the same row died.
const INVITATION_TTL_DAYS = 7;
const INVITATION_TTL_MS = INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000;

/** The base of the /accept-invite link, on the inviting tenant's own product.
 *
 *  `/accept-invite` is a real PAGE, not a pane address, so it is assembled by
 *  hand rather than through the address table — but the ORIGIN comes from the one
 *  place that knows it.
 *
 *  `accountOrigin`, not `appOrigin`, and the distinction is load-bearing. An
 *  invitee is by definition not signed in yet, so the page has to offer sign-in
 *  AND sign-up — which means it lives wherever the brand's auth lives. For sparx
 *  that is the same host either way. For Piggles it is getpiggles.com, and a link
 *  to the console would land on a domain with no sign-in page at all.
 *
 *  Both halves of this were wrong before: no brand at all, so a Piggles owner
 *  inviting their bookkeeper mailed them a link to sparx — another company's
 *  product, with no account waiting and nothing to accept. */
async function acceptUrlFor(tenantId: string, invitationId: string): Promise<string> {
  const brand = await tenantPlatformBrand(tenantId);
  return `${accountOrigin(brand)}/accept-invite?invitation=${encodeURIComponent(invitationId)}`;
}

// ── Input shapes ────────────────────────────────────────────────────────────

// A refine rather than z.enum: `ASSIGNABLE_ORG_ROLES` is a filtered array, not a
// literal tuple, and routing "owner is not assignable" through the SAME check
// means the caller gets one clear message instead of a bare enum mismatch.
// Owner is deliberately absent from that list — only the tenant creator holds it
// (docs/78 §3), so `role: 'owner'` can never be granted through this API.
const AssignableRole = z
  .string()
  .refine(
    (value): value is AssignableOrgRole =>
      (ASSIGNABLE_ORG_ROLES as readonly string[]).includes(value),
    `Role must be one of: ${ASSIGNABLE_ORG_ROLES.join(', ')}. The owner role can't be assigned.`
  );

// `owner` is a memberType too, but it is minted at provisioning alongside the
// owner membership — never invited into existence.
const InvitedMemberType = z.enum(['staff', 'consultant']);

// Same refine shape as the role, and for the same reason: the vocabulary lives
// in @sparx/auth, so validating against the exported list means a new mode is
// settable here the day it is added rather than the day someone remembers.
const AccessMode = z
  .string()
  .refine(
    (value): value is ModuleAccessMode =>
      (MODULE_ACCESS_MODES as readonly string[]).includes(value),
    `moduleAccessMode must be one of: ${MODULE_ACCESS_MODES.join(', ')}.`
  );

const PropertyMode = z
  .string()
  .refine(
    (value): value is PropertyAccessMode =>
      (PROPERTY_ACCESS_MODES as readonly string[]).includes(value),
    `propertyAccessMode must be one of: ${PROPERTY_ACCESS_MODES.join(', ')}.`
  );

const InviteBody = z.object({
  email: z.string().email().max(255),
  role: AssignableRole,
  memberType: InvitedMemberType.optional(),
});

const IdParams = z.object({ id: z.string().uuid() });

const PatchMemberBody = z
  .object({
    role: AssignableRole.optional(),
    moduleAccessMode: AccessMode.optional(),
    // A present array REPLACES the member's whole grant set — including an empty
    // one, which under `selected` legitimately means "no modules at all".
    modules: z.array(z.string().max(32)).max(MODULE_SLUGS.length).optional(),
    propertyAccessMode: PropertyMode.optional(),
    // A present array REPLACES the member's whole site grant set — including an
    // empty one, which under `selected` legitimately means "no sites at all"
    // (docs/131 §3.3). Capped generously: a tenant may run many sites, and this
    // is a bound against abuse, not a product limit.
    properties: z.array(z.string().uuid()).max(200).optional(),
  })
  .refine(
    (body) =>
      body.role !== undefined ||
      body.moduleAccessMode !== undefined ||
      body.modules !== undefined ||
      body.propertyAccessMode !== undefined ||
      body.properties !== undefined,
    'Provide at least one of: role, moduleAccessMode, modules, propertyAccessMode, properties.'
  );

// ── Serialization ───────────────────────────────────────────────────────────

interface MemberRow {
  id: string;
  userId: string;
  role: string;
  memberType: string;
  status: string;
  moduleAccessMode: string;
  propertyAccessMode: string;
  createdAt: Date;
  user: { name: string | null; email: string; lastLoginAt: Date | null };
  moduleAccess: { module: string }[];
  propertyAccess: { propertyId: string }[];
}

/** The shape every member-returning endpoint hands back. `lastActiveAt` is
 *  passed in rather than read here because it is a batched aggregate — see
 *  `lastActiveByUser`. */
function serializeMember(row: MemberRow, lastActiveAt: Date | null) {
  return {
    id: row.id,
    userId: row.userId,
    // A present-but-blank name is reported as null rather than an empty string:
    // the consumer's fallback ("show the email") should fire for both.
    name: row.user.name?.trim() ? row.user.name.trim() : null,
    email: row.user.email,
    role: row.role,
    memberType: row.memberType,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    lastLoginAt: row.user.lastLoginAt?.toISOString() ?? null,
    lastActiveAt: lastActiveAt?.toISOString() ?? null,
    moduleAccessMode: parseModuleAccessMode(row.moduleAccessMode),
    modules: row.moduleAccess.map((grant) => grant.module),
    propertyAccessMode: parsePropertyAccessMode(row.propertyAccessMode),
    properties: row.propertyAccess.map((grant) => grant.propertyId),
  };
}

interface InvitationRow {
  id: string;
  email: string;
  role: string;
  memberType: string;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  inviter: { name: string | null; email: string };
}

function serializeInvitation(row: InvitationRow) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    memberType: row.memberType,
    status: row.status,
    // Never null: an invitation always has an inviter, and their email is the
    // honest fallback when they have no display name set.
    inviterName: row.inviter.name?.trim() ? row.inviter.name.trim() : row.inviter.email,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

const MEMBER_INCLUDE = {
  user: { select: { name: true, email: true, lastLoginAt: true } },
  moduleAccess: { select: { module: true }, orderBy: { module: 'asc' } },
  propertyAccess: { select: { propertyId: true } },
} as const;

const INVITATION_INCLUDE = {
  inviter: { select: { name: true, email: true } },
} as const;

/**
 * "Last active" for a whole roster in ONE query.
 *
 * There is no stored last-active column anywhere on the platform (users
 * .last_login_at is LOGIN, and sessions has no touch column), so the newest
 * audit row an actor wrote is the only honest answer. Batched with a `groupBy`
 * over the roster's user ids — per-member queries would be N round-trips
 * against the one table every module appends to. The supporting index is
 * `audit_logs_tenant_actor_created_idx`.
 */
async function lastActiveByUser(
  tx: Parameters<Parameters<typeof withRequestTenant>[1]>[0],
  tenantId: string,
  userIds: readonly string[]
): Promise<Map<string, Date>> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return new Map();

  const rows = await tx.auditLog.groupBy({
    by: ['actorId'],
    where: { tenantId, actorId: { in: unique } },
    _max: { createdAt: true },
  });

  const out = new Map<string, Date>();
  for (const row of rows) {
    if (row.actorId && row._max.createdAt) out.set(row.actorId, row._max.createdAt);
  }
  return out;
}

/** The roster in presentation order: the owner first, then everyone else oldest
 *  first. Owner-first is a stable partition rather than a SQL ORDER BY on a
 *  CASE, which keeps the query plain and the intent readable. */
function ownerFirst<T extends { role: string }>(rows: T[]): T[] {
  return [...rows.filter((r) => r.role === 'owner'), ...rows.filter((r) => r.role !== 'owner')];
}

/** Reject unknown module slugs loudly. Silently dropping them would hand back a
 *  200 describing access the caller did not ask for — the exact failure a
 *  permissions surface must not have. */
function assertKnownModules(modules: readonly string[]): void {
  const unknown = [...new Set(modules)].filter((m) => !MODULE_SLUG_SET.has(m));
  if (unknown.length > 0) {
    throw badRequest(
      `Unknown module${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}. Valid modules: ${MODULE_SLUGS.join(', ')}.`
    );
  }
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; route registration is sync.
const teamRoutes: FastifyPluginAsync = async (app) => {
  // ──────────────────────────────────────────────────────────────────────
  // GET /v1/team/members — the roster
  // ──────────────────────────────────────────────────────────────────────
  app.get('/v1/team/members', async (request) => {
    const auth = requireAuth(request);

    // Roster on authPrisma (cross-tenant `user` rows must resolve); "last
    // active" on withRequestTenant because it reads force-RLS `audit_logs`.
    const rows = await authPrisma.member.findMany({
      where: { organizationId: auth.tenantId },
      include: MEMBER_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });

    const active = await withRequestTenant(request, (tx) =>
      lastActiveByUser(
        tx,
        auth.tenantId,
        rows.map((row) => row.userId)
      )
    );

    return ok({
      items: ownerFirst(rows).map((row) => serializeMember(row, active.get(row.userId) ?? null)),
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // GET /v1/team/invitations — live invitations only
  // ──────────────────────────────────────────────────────────────────────
  //
  // Expired rows are filtered by `expiresAt` rather than by a swept `status`:
  // nothing marks an invitation `expired` on a timer, so the timestamp is the
  // only reliable signal that a `pending` row is actually still offerable.
  app.get('/v1/team/invitations', async (request) => {
    const auth = requireAuth(request);

    // authPrisma: INVITATION_INCLUDE joins the inviter's `users` row, and an
    // inviter who is a consultant from another tenant is invisible under RLS.
    const rows = await authPrisma.invitation.findMany({
      where: {
        organizationId: auth.tenantId,
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
      include: INVITATION_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return ok({ items: rows.map(serializeInvitation) });
  });

  // ──────────────────────────────────────────────────────────────────────
  // POST /v1/team/invitations — invite someone
  // ──────────────────────────────────────────────────────────────────────
  //
  // Re-inviting an address that already has a live invitation RESENDS it rather
  // than minting a second row: two pending invitations for one address means
  // two accept links, one of which will fail confusingly after the other is
  // used. The requested role/type are applied to the surviving row, because
  // "invite them again, as an admin this time" is a correction, not a duplicate.
  app.post('/v1/team/invitations', async (request) => {
    const auth = requireRole(request, 'admin');
    const input = InviteBody.parse(request.body);
    const email = input.email.trim().toLowerCase();
    const memberType = input.memberType ?? 'staff';
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

    // authPrisma: the duplicate-member check joins `users` by email. Under RLS a
    // cross-tenant member was simply invisible here, so re-inviting an existing
    // consultant slipped past this guard and minted a doomed invitation.
    const existingMember = await authPrisma.member.findFirst({
      where: { organizationId: auth.tenantId, status: 'active', user: { email } },
      select: { id: true },
    });
    if (existingMember) {
      throw conflict(`${email} is already an active member of this team.`, 'email');
    }

    const live = await authPrisma.invitation.findFirst({
      where: {
        organizationId: auth.tenantId,
        email,
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    let invitation: InvitationRow;
    if (live) {
      // updateMany so the tenant filter rides along with the id rather than
      // trusting the preceding read; then re-read for INVITATION_INCLUDE.
      await authPrisma.invitation.updateMany({
        where: { id: live.id, organizationId: auth.tenantId },
        data: { role: input.role, memberType, expiresAt },
      });
      const refreshed = await authPrisma.invitation.findFirst({
        where: { id: live.id, organizationId: auth.tenantId },
        include: INVITATION_INCLUDE,
      });
      if (!refreshed) throw notFound('Invitation', live.id);
      invitation = refreshed;
    } else {
      invitation = await authPrisma.invitation.create({
        data: {
          organizationId: auth.tenantId,
          email,
          role: input.role,
          memberType,
          status: 'pending',
          inviterId: auth.actorId,
          expiresAt,
        },
        include: INVITATION_INCLUDE,
      });
    }

    // Audit + tenant name on the RLS connection (audit_logs is force-RLS).
    // Written AFTER the invitation exists, so the log never describes a row
    // that isn't there.
    const orgName = await withRequestTenant(request, async (tx) => {
      await writeAudit(tx, request, auth, {
        action: 'team.invitation.sent',
        entityType: 'invitation',
        entityId: invitation.id,
        after: {
          email,
          role: invitation.role,
          memberType: invitation.memberType,
          expiresAt: invitation.expiresAt.toISOString(),
          // Distinguishes "a new person was invited" from "we nudged an
          // outstanding invite" when reading the feed back.
          resent: Boolean(live),
        },
      });

      const tenant = await tx.tenant.findUnique({
        where: { id: auth.tenantId },
        select: { name: true },
      });
      return tenant?.name ?? 'your team';
    });

    await publishInvitationEmail(request, auth.tenantId, auth.actorId, invitation, orgName);
    return ok(serializeInvitation(invitation));
  });

  // ──────────────────────────────────────────────────────────────────────
  // POST /v1/team/invitations/:id/resend
  // ──────────────────────────────────────────────────────────────────────
  //
  // Extends the expiry as well as re-sending: an invite worth chasing is one
  // the recipient should still be able to accept, and a re-sent link that dies
  // tomorrow is the same support ticket twice.
  app.post('/v1/team/invitations/:id/resend', async (request) => {
    const auth = requireRole(request, 'admin');
    const { id } = IdParams.parse(request.params);
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

    const current = await authPrisma.invitation.findFirst({
      where: { id, organizationId: auth.tenantId },
      select: { id: true, status: true },
    });
    if (!current) throw notFound('Invitation', id);
    if (current.status !== 'pending') {
      throw conflict(
        `That invitation was already ${current.status} and can't be re-sent. Invite them again instead.`,
        'status'
      );
    }

    await authPrisma.invitation.updateMany({
      where: { id, organizationId: auth.tenantId },
      data: { expiresAt },
    });
    const invitation = await authPrisma.invitation.findFirst({
      where: { id, organizationId: auth.tenantId },
      include: INVITATION_INCLUDE,
    });
    if (!invitation) throw notFound('Invitation', id);

    // Audit after the extension lands — see the header note on ordering.
    const orgName = await withRequestTenant(request, async (tx) => {
      await writeAudit(tx, request, auth, {
        action: 'team.invitation.sent',
        entityType: 'invitation',
        entityId: invitation.id,
        after: {
          email: invitation.email,
          role: invitation.role,
          memberType: invitation.memberType,
          expiresAt: invitation.expiresAt.toISOString(),
          resent: true,
        },
      });

      const tenant = await tx.tenant.findUnique({
        where: { id: auth.tenantId },
        select: { name: true },
      });
      return tenant?.name ?? 'your team';
    });

    await publishInvitationEmail(request, auth.tenantId, auth.actorId, invitation, orgName);
    return ok(serializeInvitation(invitation));
  });

  // ──────────────────────────────────────────────────────────────────────
  // DELETE /v1/team/invitations/:id — revoke
  // ──────────────────────────────────────────────────────────────────────
  //
  // A status flip, not a delete: the row is the evidence that someone was
  // invited and then wasn't, which is exactly what an audit reader is looking
  // for. It also keeps the accept link dead rather than merely unrecognised.
  app.delete('/v1/team/invitations/:id', async (request) => {
    const auth = requireRole(request, 'admin');
    const { id } = IdParams.parse(request.params);

    const current = await authPrisma.invitation.findFirst({
      where: { id, organizationId: auth.tenantId },
      select: { id: true, email: true, role: true, status: true },
    });
    if (!current) throw notFound('Invitation', id);
    if (current.status !== 'pending') {
      throw conflict(`That invitation was already ${current.status}.`, 'status');
    }

    await authPrisma.invitation.updateMany({
      where: { id, organizationId: auth.tenantId },
      data: { status: 'revoked' },
    });

    await withRequestTenant(request, (tx) =>
      writeAudit(tx, request, auth, {
        action: 'team.invitation.revoked',
        entityType: 'invitation',
        entityId: id,
        before: { email: current.email, role: current.role, status: current.status },
        after: { status: 'revoked' },
      })
    );

    return ok({ id });
  });

  // ──────────────────────────────────────────────────────────────────────
  // PATCH /v1/team/members/:id — role and/or module access
  // ──────────────────────────────────────────────────────────────────────
  app.patch('/v1/team/members/:id', async (request) => {
    const auth = requireRole(request, 'admin');
    const { id } = IdParams.parse(request.params);
    const input = PatchMemberBody.parse(request.body);

    if (input.modules) assertKnownModules(input.modules);

    const current = await authPrisma.member.findFirst({
      where: { id, organizationId: auth.tenantId },
      include: MEMBER_INCLUDE,
    });
    if (!current) throw notFound('Member', id);

    // The owner is structural, not editable: their membership is minted with
    // the tenant and is the last account that can always reach everything.
    // Any role this endpoint accepts is by definition NOT `owner` (owner is
    // absent from ASSIGNABLE_ORG_ROLES), so naming a role for the owner is
    // always an attempt to change it — no equality check needed.
    if (current.role === 'owner' && input.role !== undefined) {
      throw forbidden("The owner's role can't be changed.");
    }
    // Self-demotion (or self-promotion) is how an admin either locks
    // themselves out or quietly escalates. Only flag an ACTUAL change, so a
    // client that echoes the whole member back isn't rejected for saying
    // nothing.
    if (
      current.userId === auth.actorId &&
      input.role !== undefined &&
      input.role !== current.role
    ) {
      throw forbidden("You can't change your own role. Ask another owner or admin to do it.");
    }

    const nextRole = input.role ?? current.role;
    const touchesModuleAccess = input.moduleAccessMode !== undefined || input.modules !== undefined;

    // Owners and admins are never module-restricted (roleIgnoresModuleAccess):
    // they can edit the restriction, so applying one to them is theatre that
    // costs a support ticket. Rejected rather than ignored — a silent no-op
    // would leave the UI showing a limit that isn't real.
    if (touchesModuleAccess && roleIgnoresModuleAccess(nextRole)) {
      throw badRequest(
        `Module access can't be limited for ${nextRole}s — they manage the team, so they always reach every module. Change their role first.`
      );
    }

    const touchesPropertyAccess =
      input.propertyAccessMode !== undefined || input.properties !== undefined;

    // Same reasoning as module access: an owner or admin can edit the
    // restriction, so applying one to them is theatre. Rejected, not ignored.
    if (touchesPropertyAccess && roleIgnoresPropertyAccess(nextRole)) {
      throw badRequest(
        `Site access can't be limited for ${nextRole}s — they manage the team, so they always reach every site. Change their role first.`
      );
    }

    // A grant naming a site this tenant does not own is rejected rather than
    // stored: the junction's FK would accept another tenant's real property id,
    // and a grant row is not a security boundary on its own. RLS scopes the
    // lookup, so a foreign id is indistinguishable from a missing one.
    if (input.properties && input.properties.length > 0) {
      const owned = await withRequestTenant(request, (tx) =>
        tx.property.findMany({
          where: { id: { in: input.properties! } },
          select: { id: true },
        })
      );
      if (owned.length !== new Set(input.properties).size) {
        throw badRequest('One or more of those sites do not exist.');
      }
    }

    const nextMode: ModuleAccessMode =
      input.moduleAccessMode ?? parseModuleAccessMode(current.moduleAccessMode);
    const nextPropertyMode: PropertyAccessMode =
      input.propertyAccessMode ?? parsePropertyAccessMode(current.propertyAccessMode);
    const beforeProperties = current.propertyAccess.map((grant) => grant.propertyId);
    const nextProperties = input.properties ? [...new Set(input.properties)] : beforeProperties;
    const beforeModules = current.moduleAccess.map((grant) => grant.module);
    const nextModules = input.modules ? [...new Set(input.modules)] : beforeModules;

    // The member row and its grant set still move together — an authPrisma
    // transaction rather than the withRequestTenant one, so a member is never
    // briefly holding a partial grant list that a concurrent request could read.
    await authPrisma.$transaction(async (tx) => {
      await tx.member.updateMany({
        where: { id, organizationId: auth.tenantId },
        data: {
          role: nextRole,
          moduleAccessMode: nextMode,
          propertyAccessMode: nextPropertyMode,
        },
      });

      // A present `modules` array replaces the whole set. `member_module_access`
      // has no tenant column of its own, so it is guarded through the member
      // relation rather than by `memberId` alone.
      if (input.modules) {
        await tx.memberModuleAccess.deleteMany({
          where: { memberId: id, member: { organizationId: auth.tenantId } },
        });
        if (nextModules.length > 0) {
          await tx.memberModuleAccess.createMany({
            data: nextModules.map((module) => ({ memberId: id, module })),
          });
        }
      }

      // Site grants replace wholesale on the same terms, and inside the same
      // transaction, so a member is never briefly holding a partial set that a
      // concurrent request could read and act on.
      if (input.properties) {
        await tx.memberPropertyAccess.deleteMany({
          where: { memberId: id, member: { organizationId: auth.tenantId } },
        });
        if (nextProperties.length > 0) {
          await tx.memberPropertyAccess.createMany({
            data: nextProperties.map((propertyId) => ({ memberId: id, propertyId })),
          });
        }
      }
    });

    // Site access is cached per (tenant, user) on the auth path, so a revoked
    // grant would otherwise keep working for up to the TTL. Revocation has to
    // bite now — that is the entire point of the feature.
    if (touchesPropertyAccess) invalidateMemberAccessCache(auth.tenantId, current.userId);

    // Audit rows + "last active" on the RLS connection; audits follow the
    // mutation, per the header note.
    const lastActiveAt = await withRequestTenant(request, async (tx) => {
      if (nextRole !== current.role) {
        await writeAudit(tx, request, auth, {
          action: 'team.member.role_changed',
          entityType: 'member',
          entityId: id,
          before: { userId: current.userId, email: current.user.email, role: current.role },
          after: { userId: current.userId, email: current.user.email, role: nextRole },
        });
      }

      const modulesChanged =
        input.modules !== undefined &&
        (beforeModules.length !== nextModules.length ||
          beforeModules.some((module) => !nextModules.includes(module)));
      if (nextMode !== parseModuleAccessMode(current.moduleAccessMode) || modulesChanged) {
        await writeAudit(tx, request, auth, {
          action: 'team.member.module_access_changed',
          entityType: 'member',
          entityId: id,
          before: {
            email: current.user.email,
            moduleAccessMode: parseModuleAccessMode(current.moduleAccessMode),
            modules: beforeModules,
          },
          after: {
            email: current.user.email,
            moduleAccessMode: nextMode,
            modules: nextModules,
          },
        });
      }

      const active = await lastActiveByUser(tx, auth.tenantId, [current.userId]);
      return active.get(current.userId) ?? null;
    });

    // Tell the affected member their role changed (only on a real role change — not
    // a module/site-access edit). Self-role-changes are blocked above, so this always
    // notifies someone other than the actor.
    if (nextRole !== current.role && current.user.email) {
      const orgName = await withRequestTenant(request, async (tx) => {
        const t = await tx.tenant.findUnique({
          where: { id: auth.tenantId },
          select: { name: true },
        });
        return t?.name ?? 'your team';
      });
      await publish(request.log, 'email.send', auth.tenantId, auth.actorId, {
        to: current.user.email,
        template: 'team-role-changed',
        props: {
          memberName: current.user.name ?? undefined,
          orgName,
          newRole: nextRole,
          dashboardUrl: appOrigin(await tenantPlatformBrand(auth.tenantId)),
        },
      });
    }

    return ok(
      serializeMember(
        {
          ...current,
          role: nextRole,
          moduleAccessMode: nextMode,
          moduleAccess: nextModules.map((module) => ({ module })),
        },
        lastActiveAt
      )
    );
  });

  // ──────────────────────────────────────────────────────────────────────
  // DELETE /v1/team/members/:id — remove from the tenant
  // ──────────────────────────────────────────────────────────────────────
  //
  // Deletes the MEMBERSHIP, never the user: the same person may be a member of
  // other tenants, and their audit trail here must survive their departure
  // (audit_logs.actor_id is not a cascading FK to members).
  app.delete('/v1/team/members/:id', async (request) => {
    const auth = requireRole(request, 'admin');
    const { id } = IdParams.parse(request.params);

    const current = await authPrisma.member.findFirst({
      where: { id, organizationId: auth.tenantId },
      include: { user: { select: { email: true, name: true } } },
    });
    if (!current) throw notFound('Member', id);

    // Removing the owner would leave the tenant with no account that can
    // always administer it — including no way to appoint a replacement.
    if (current.role === 'owner') {
      throw forbidden("The owner can't be removed from the team.");
    }
    if (current.userId === auth.actorId) {
      throw forbidden(
        "You can't remove yourself from the team. Ask another owner or admin to do it."
      );
    }

    await authPrisma.member.deleteMany({ where: { id, organizationId: auth.tenantId } });

    // Audit last: `current` was captured above, so the removed member's details
    // are still available to describe what happened.
    await withRequestTenant(request, (tx) =>
      writeAudit(tx, request, auth, {
        action: 'team.member.removed',
        entityType: 'member',
        entityId: id,
        before: {
          userId: current.userId,
          email: current.user.email,
          role: current.role,
          memberType: current.memberType,
        },
      })
    );

    // Tell the removed person their access changed — access changes are never silent.
    if (current.user.email) {
      const orgName = await withRequestTenant(request, async (tx) => {
        const t = await tx.tenant.findUnique({
          where: { id: auth.tenantId },
          select: { name: true },
        });
        return t?.name ?? 'your team';
      });
      await publish(request.log, 'email.send', auth.tenantId, auth.actorId, {
        to: current.user.email,
        template: 'team-member-removed',
        props: { memberName: current.user.name ?? undefined, orgName },
      });
    }

    return ok({ id });
  });
};

/**
 * Publish the invite email.
 *
 * Payload + accept-URL format mirror the Better Auth `sendInvitationEmail`
 * callback (packages/auth/src/server.ts) exactly, so an invitation reads the
 * same whichever surface created it. Published AFTER the transaction commits —
 * an email announcing a row that then rolled back is worse than a missing one —
 * and via the bus rather than `sendTemplate`, per the platform email rule.
 */
async function publishInvitationEmail(
  request: FastifyRequest,
  tenantId: string,
  actorId: string,
  invitation: InvitationRow,
  orgName: string
): Promise<void> {
  await publish(request.log, 'email.send', tenantId, actorId, {
    to: invitation.email,
    template: 'team-invitation',
    props: {
      inviteeEmail: invitation.email,
      orgName,
      // A present-but-BLANK name must fall through to the email, which `??`
      // would not do — hence the explicit emptiness check.
      inviterName: invitation.inviter.name?.trim()
        ? invitation.inviter.name.trim()
        : invitation.inviter.email,
      role: invitation.role,
      acceptUrl: await acceptUrlFor(tenantId, invitation.id),
      expiresInDays: INVITATION_TTL_DAYS,
    },
  });
}

export default teamRoutes;
