import { authPrisma } from './prisma';

/** Prefer a person's name, falling back to their email when the name is blank
 *  (not just null — an empty/whitespace name should still fall through, which is
 *  why this can't be a `??`). */
function nameOrEmail(name: string | null, email: string): string {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : email;
}

// Membership + invitation reads for the dashboard's org surfaces (docs/114 §A.4).
//
// These read the `members` / `invitations` tables directly through authPrisma
// (which connects as `sparx_owner`, bypassing non-FORCE RLS) — the same access
// path session.ts uses. We read them here rather than through the Better Auth
// org plugin's `listOrganizations` because we need the caller's *role* and
// *member type* per org (the client-accounts picker + Team view show them), and
// `listOrganizations` returns organizations without the membership edge.
//
// The authorization invariant (only mint a JWT `tid` the user is an active
// member of) is enforced in session.ts; these helpers are read-only projections
// for the UI and never widen access on their own.

export interface OrgMembership {
  /** The organization == tenant id (what becomes the JWT `tid` when active). */
  organizationId: string;
  /** Tenant display name. */
  name: string;
  /** Tenant slug. */
  slug: string;
  /** The caller's role in this org (owner | admin | editor | …). */
  role: string;
  /** owner | staff | consultant — staff vs external consultant/partner. */
  memberType: string;
}

export interface PendingInvitation {
  /** Invitation id — the token carried to /accept-invite. */
  id: string;
  /** Org the invite grants access to. */
  organizationId: string;
  /** Org display name. */
  orgName: string;
  /** Role the invite confers. */
  role: string;
  /** Who sent it (name, falling back to email). */
  inviterName: string;
  /** When it lapses. */
  expiresAt: Date;
}

export interface InvitationDetail {
  id: string;
  /** The address the invite was sent to — the accepting session must match it. */
  email: string;
  organizationId: string;
  orgName: string;
  role: string;
  inviterName: string;
  /** pending | accepted | revoked | expired (raw stored value). */
  status: string;
  expiresAt: Date;
}

export interface OrgMember {
  /** members.id — the handle `updateMemberRole` / `removeMember` take. */
  id: string;
  userId: string;
  name: string | null;
  email: string;
  role: string;
  memberType: string;
  status: string;
  createdAt: Date;
}

export interface OrgInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  inviterName: string;
  expiresAt: Date;
  createdAt: Date;
}

/** Active organizations the user belongs to, ordered owner-first then by name —
 *  the client-accounts list + the breadcrumb workspace switcher. */
export async function listMyMemberships(userId: string): Promise<OrgMembership[]> {
  const rows = await authPrisma.member.findMany({
    where: { userId, status: 'active' },
    select: {
      organizationId: true,
      role: true,
      memberType: true,
      organization: { select: { name: true, slug: true } },
    },
  });

  return rows
    .map((r) => ({
      organizationId: r.organizationId,
      name: r.organization.name,
      slug: r.organization.slug,
      role: r.role,
      memberType: r.memberType,
    }))
    .sort((a, b) => {
      if (a.role === 'owner' && b.role !== 'owner') return -1;
      if (b.role === 'owner' && a.role !== 'owner') return 1;
      return a.name.localeCompare(b.name);
    });
}

/**
 * Live (pending, unexpired) invitations addressed to `email` — surfaced on the
 * client-accounts landing so a freshly-signed-up invitee is never stranded.
 *
 * Scoped to ONE product. An invitation is addressed to a bare email, and the
 * same address may hold a login on each brand, so an unscoped read here would
 * offer somebody an invitation into a business on a product they do not have an
 * account for — a door that opens onto nothing, on a screen whose whole job is
 * to stop people being stranded.
 *
 * The brand rides on the ORGANIZATION rather than being matched against the
 * caller's own: an invitation belongs to the tenant that sent it, and that
 * tenant's brand is the one that decides whether this person can act on it.
 */
export async function listPendingInvitations(
  email: string,
  platformBrand: string
): Promise<PendingInvitation[]> {
  const now = new Date();
  const rows = await authPrisma.invitation.findMany({
    where: {
      email,
      status: 'pending',
      expiresAt: { gt: now },
      organization: { platformBrand },
    },
    select: {
      id: true,
      organizationId: true,
      role: true,
      expiresAt: true,
      organization: { select: { name: true } },
      inviter: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return rows.map((r) => ({
    id: r.id,
    organizationId: r.organizationId,
    orgName: r.organization.name,
    role: r.role,
    inviterName: nameOrEmail(r.inviter.name, r.inviter.email),
    expiresAt: r.expiresAt,
  }));
}

/**
 * May this account join the business this invitation belongs to?
 *
 * A login belongs to exactly one product (`users.platform_brand`) and so does a
 * business (`tenants.platform_brand`), so a membership joining one product's
 * account to the other product's business is incoherent — there is no screen
 * that could render it and no session that could act in it.
 *
 * The partition itself stops the ordinary route: a credential from the other
 * product no longer signs in here at all, so the invitee is made to create an
 * account on this one. What it does NOT stop is somebody opening an invitation
 * link for the other product while signed in to this one — the addresses match,
 * the accept succeeds, and the membership is written. This is that guard.
 *
 * `true` when the two agree, including when either row has gone missing: an
 * absent row is a different failure with a different message, and Better Auth's
 * own accept call reports it. This answers one question only.
 */
export async function invitationMatchesUserBrand(
  invitationId: string,
  userId: string
): Promise<boolean> {
  const [invitation, user] = await Promise.all([
    authPrisma.invitation.findUnique({
      where: { id: invitationId },
      select: { organization: { select: { platformBrand: true } } },
    }),
    authPrisma.user.findUnique({
      where: { id: userId },
      select: { platformBrand: true },
    }),
  ]);

  if (!invitation || !user) return true;
  return invitation.organization.platformBrand === user.platformBrand;
}

/** One invitation's detail for the /accept-invite screen (null if unknown). Does
 *  NOT gate on the caller — the page renders the invited email and lets the
 *  accept call enforce the match; this is display only. */
export async function getInvitationDetail(invitationId: string): Promise<InvitationDetail | null> {
  const row = await authPrisma.invitation.findUnique({
    where: { id: invitationId },
    select: {
      id: true,
      email: true,
      organizationId: true,
      role: true,
      status: true,
      expiresAt: true,
      organization: { select: { name: true } },
      inviter: { select: { name: true, email: true } },
    },
  });
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    organizationId: row.organizationId,
    orgName: row.organization.name,
    role: row.role,
    inviterName: nameOrEmail(row.inviter.name, row.inviter.email),
    status: row.status,
    expiresAt: row.expiresAt,
  };
}

/** The team roster for an org — the Settings → Team member list. Ordered
 *  owner-first, then most-recently-joined. Reads only; team mutations go through
 *  the Better Auth org plugin so its permission checks + invite email fire. */
export async function listOrgMembers(organizationId: string): Promise<OrgMember[]> {
  const rows = await authPrisma.member.findMany({
    where: { organizationId },
    select: {
      id: true,
      userId: true,
      role: true,
      memberType: true,
      status: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return rows
    .map((r) => ({
      id: r.id,
      userId: r.userId,
      name: r.user.name,
      email: r.user.email,
      role: r.role,
      memberType: r.memberType,
      status: r.status,
      createdAt: r.createdAt,
    }))
    .sort((a, b) => {
      if (a.role === 'owner' && b.role !== 'owner') return -1;
      if (b.role === 'owner' && a.role !== 'owner') return 1;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
}

/** Outstanding (pending, unexpired) invitations for an org — shown under the
 *  member list in Settings → Team with a revoke control. */
export async function listOrgInvitations(organizationId: string): Promise<OrgInvitation[]> {
  const now = new Date();
  const rows = await authPrisma.invitation.findMany({
    where: { organizationId, status: 'pending', expiresAt: { gt: now } },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      inviter: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    status: r.status,
    inviterName: nameOrEmail(r.inviter.name, r.inviter.email),
    expiresAt: r.expiresAt,
    createdAt: r.createdAt,
  }));
}
