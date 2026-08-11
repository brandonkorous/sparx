import { createAccessControl } from 'better-auth/plugins/access';

// Access-control vocabulary for the organization plugin (docs/114 §A.2, docs/78 §3).
//
// This governs ONLY the org plugin's own team-management endpoints (invite /
// add-member / update-role / remove-member): who is *allowed* to manage the team.
// The real, fine-grained module authorization is enforced in api-rest via
// `requireRole(request, …)` on the JWT `role` claim — this is not a parallel authz
// system, just the gate on the membership endpoints.
//
// We keep Better Auth's default resource set (organization / member / invitation)
// so owner + admin behave like the plugin's built-in owner/admin. The six
// operational roles carry NO membership-management permissions — they run the
// business (or, for `partner`, the Partner Program practice), not the team — so
// the plugin correctly denies them the invite/member endpoints (and api-rest
// denies them too). `partner` is the delegation role (docs/114 §B.7): a teammate
// who operates referrals / commissions / payouts / bootcamps without being a full
// admin. Its partner-practice powers are enforced by api-core's `requireAnyRole`
// capability check on the `/v1/partner/*` routes, NOT by the coarse role hierarchy
// (a lateral role, like builder/marketing/support, floors to read-only elsewhere).

const statement = {
  organization: ['update', 'delete'],
  member: ['create', 'update', 'delete'],
  invitation: ['create', 'cancel'],
} as const;

export const ac = createAccessControl(statement);

const none = { organization: [], member: [], invitation: [] } as const;

export const roles = {
  owner: ac.newRole({
    organization: ['update', 'delete'],
    member: ['create', 'update', 'delete'],
    invitation: ['create', 'cancel'],
  }),
  admin: ac.newRole({
    organization: ['update'],
    member: ['create', 'update', 'delete'],
    invitation: ['create', 'cancel'],
  }),
  editor: ac.newRole({ ...none }),
  builder: ac.newRole({ ...none }),
  marketing: ac.newRole({ ...none }),
  support: ac.newRole({ ...none }),
  partner: ac.newRole({ ...none }),
  // Warehouse floor staff (docs/146 Phase 1). A lateral role like the four above:
  // it floors to read-only in the ranked hierarchy and earns its real powers from
  // an explicit allow-list on the inventory scan endpoints (receive, count,
  // transfer, lookup) via api-core's `requireAnyRole`.
  //
  // It exists for a commercial reason as much as a security one. Per-user pricing
  // is one of the loudest complaints in this category, and sparx bills per module
  // — so a tenant can give a seat to every person on the floor at no extra cost.
  // A role that hands a picker the whole console would make that offer reckless;
  // this is the one that makes it safe.
  scanner: ac.newRole({ ...none }),
  viewer: ac.newRole({ ...none }),
};

// The role vocabulary as a plain list — reused by api-rest validation + the Team UI.
export const ORG_ROLES = [
  'owner',
  'admin',
  'editor',
  'builder',
  'marketing',
  'support',
  'partner',
  'scanner',
  'viewer',
] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

// Roles that may be ASSIGNED to a member (owner is never assignable — only the
// tenant creator holds it; docs/78 §3). The predicate narrows the element type,
// so `AssignableOrgRole` is `OrgRole` minus `owner` — the type the Better Auth
// invite/update-role endpoints expect.
export const ASSIGNABLE_ORG_ROLES = ORG_ROLES.filter((r) => r !== 'owner');
export type AssignableOrgRole = Exclude<OrgRole, 'owner'>;
