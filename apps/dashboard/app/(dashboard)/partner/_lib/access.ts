import { requireSession } from '@sparx/auth';

// Partner Portal access, resolved from the user's org role (docs/114 §B.7). This
// is the dashboard mirror of api-rest's `PARTNER_OPS` capability set — keep the
// two in lockstep. Partner status itself is tenant-level (a `partners` row); this
// governs WHICH members of that tenant may operate the practice.

// Who may operate an ACTIVE partner practice: owner, admin, or the delegated
// `partner` role (granted in Settings → Team to run referrals / commissions /
// payouts / bootcamps without full admin). Every other role is read-only across
// the dashboard and gets no partner access.
const PARTNER_OPS_ROLES = new Set<string>(['owner', 'admin', 'partner']);

export function canOperatePartner(role: string): boolean {
  return PARTNER_OPS_ROLES.has(role);
}

// Becoming a partner is an owner/admin decision — there is no `partner` role to
// hold until the org has actually joined the program.
export function canJoinPartnerProgram(role: string): boolean {
  return role === 'owner' || role === 'admin';
}

export interface PartnerAccess {
  role: string;
  canOperate: boolean;
  canJoin: boolean;
}

/** The current user's Partner Portal capabilities, from the session role. Cheap —
 *  a partner sub-page calls it to choose between the portal, the join landing, and
 *  the "ask an owner/admin" locked state. */
export async function getPartnerAccess(): Promise<PartnerAccess> {
  const { user } = await requireSession();
  return {
    role: user.role,
    canOperate: canOperatePartner(user.role),
    canJoin: canJoinPartnerProgram(user.role),
  };
}
