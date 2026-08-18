import type { OrgRole } from './org-roles';

// Per-member SITE access — which of the tenant's businesses a teammate may open.
//
// A third axis, orthogonal to the other two. The org role answers "how much may
// this person change?" (org-roles.ts). Module access answers "which parts of the
// product may they open?" (module-access.ts). This answers "WHOSE data?".
//
// It exists because a tenant is a billing container, not a business (docs/131).
// One account can run a machine shop and a donut shop, and the person who takes
// donut orders has no business reading the machine shop's customers, revenue or
// quotes. That is not a role — they are an ordinary editor — and it is not a
// module, because both businesses use the same modules.
//
// Deliberately the same shape as module-access.ts: same mode flag, same
// grant-row semantics, same fail-closed reading, same unrestricted roles. Two
// narrowing axes that behaved differently would be two things to learn and two
// places to get wrong.
//
// All three compose by INTERSECTION and none can grant: a member restricted to
// the donut shop still cannot do an admin's job inside it, and a site the tenant
// has archived stays closed regardless. This layer only ever narrows.

/**
 * Whether a member reaches every site the tenant runs, or a chosen subset.
 *
 * `all` is the default and the backfill for every pre-existing member, so
 * introducing this changed nobody's access.
 */
export type PropertyAccessMode = 'all' | 'selected';

export const PROPERTY_ACCESS_MODES: readonly PropertyAccessMode[] = ['all', 'selected'];

/**
 * Roles that are never subject to a site restriction.
 *
 * The same reasoning as module access: these are the roles that can EDIT the
 * restriction, so an owner locked out of a site would open Team and grant it
 * back. The lock would be theatre that costs a support ticket the first time
 * someone traps themselves. Enforced here, not only in the UI, so a direct API
 * call cannot do what the interface refuses to.
 */
const UNRESTRICTED_ROLES: readonly OrgRole[] = ['owner', 'admin'];

export function roleIgnoresPropertyAccess(role: string): boolean {
  return (UNRESTRICTED_ROLES as readonly string[]).includes(role);
}

export interface MemberPropertyAccessInput {
  role: string;
  /**
   * The raw column value as it came out of the database — a bare `string`, not
   * the union, for the same reason module access does it: the whole point of
   * `memberCanReachProperty`'s final branch is to handle a value that is NOT one
   * of the two we know about. Typing it as the union would be a promise the
   * database cannot keep and would make the fail-closed branch read as dead
   * code. Narrow with `parsePropertyAccessMode` when you want the union.
   */
  mode: string;
  /** The member's granted property ids. Meaningless unless `mode` is `selected`. */
  granted: readonly string[];
}

/**
 * Whether `propertyId` is reachable by this member.
 *
 * Fails CLOSED on an unrecognised mode: an unexpected value is a bug or
 * tampering, and the safe reading of "I don't understand this restriction" is to
 * apply it rather than ignore it. The migration's CHECK constraint makes that
 * branch unreachable through normal writes; it exists so being wrong is quiet
 * rather than permissive.
 */
export function memberCanReachProperty(
  input: MemberPropertyAccessInput,
  propertyId: string
): boolean {
  if (roleIgnoresPropertyAccess(input.role)) return true;
  if (input.mode === 'all') return true;
  if (input.mode === 'selected') return input.granted.includes(propertyId);
  return false;
}

/**
 * The member's reachable subset of `all`, the tenant's sites.
 *
 * Returns `null` for "no restriction" — which is NOT the same as "every site
 * happens to be granted", and the difference is load-bearing. A restricted
 * member who has been granted all four of today's sites must not silently gain
 * the fifth one created tomorrow; an unrestricted member must. Callers branch on
 * null rather than comparing set sizes.
 */
export function reachableProperties(
  input: MemberPropertyAccessInput,
  all: readonly string[]
): string[] | null {
  if (roleIgnoresPropertyAccess(input.role)) return null;
  if (input.mode === 'all') return null;
  if (input.mode === 'selected') return all.filter((id) => input.granted.includes(id));
  // Unrecognised mode — fail closed, consistent with memberCanReachProperty.
  return [];
}

/**
 * Narrows a stored column value to the union, defaulting to `all`.
 *
 * Note this defaults an UNKNOWN value to `all` while `memberCanReachProperty`
 * fails closed on one. Deliberate, and the same split module access makes: this
 * function describes what is CONFIGURED (and "not configured" is `all`), whereas
 * that function DECIDES ACCESS, where the cautious answer is the opposite.
 */
export function parsePropertyAccessMode(value: string | null | undefined): PropertyAccessMode {
  return value === 'selected' ? 'selected' : 'all';
}
