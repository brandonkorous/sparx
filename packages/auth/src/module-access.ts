import type { ModuleSlug } from '@sparx/modules';
import type { OrgRole } from './org-roles';

// Per-member module access — WHICH modules a teammate may open.
//
// This is a second, orthogonal axis to the org role. The role answers "how much
// may this person change?" (org-roles.ts, and `requireRole` in api-rest). This
// answers "where may they go at all?". A business with eleven modules has a
// bookkeeper who should see Invoicing and nothing else, and that is not a role —
// they are a perfectly ordinary editor, just not of everything.
//
// The two axes compose by intersection, and both must pass. Nothing here can
// GRANT access: a member restricted to Commerce still cannot do an admin's job
// inside Commerce, and a module the TENANT has not enabled stays closed to
// everyone regardless of what is granted here (module activation is checked
// separately, by `isModuleEnabled`). This layer only ever narrows.

/**
 * Whether a member reaches everything their role allows, or a chosen subset.
 *
 * `all` is the default and the backfill for every pre-existing member, so
 * introducing this feature changed nobody's access.
 */
export type ModuleAccessMode = 'all' | 'selected';

export const MODULE_ACCESS_MODES: readonly ModuleAccessMode[] = ['all', 'selected'];

/**
 * Roles that are never subject to a module restriction.
 *
 * These are the roles that can EDIT the restriction — an owner or admin locked
 * out of Commerce would simply open Team and grant it back, so the lock is
 * theatre that costs a support ticket the first time someone traps themselves.
 * Enforced here rather than only in the UI so a direct API call cannot do what
 * the interface refuses to.
 */
const UNRESTRICTED_ROLES: readonly OrgRole[] = ['owner', 'admin'];

export function roleIgnoresModuleAccess(role: string): boolean {
  return (UNRESTRICTED_ROLES as readonly string[]).includes(role);
}

export interface MemberModuleAccessInput {
  role: string;
  /**
   * Deliberately a bare `string`, not `ModuleAccessMode`.
   *
   * This is the raw column value as it came out of the database, and the whole
   * point of `memberCanReachModule`'s final branch is to handle a value that is
   * NOT one of the two we know about. Typing it as the union would be a promise
   * the database cannot keep, and would make that fail-closed branch look like
   * dead code to anyone reading it. Narrow with `parseModuleAccessMode` when you
   * want the union.
   */
  mode: string;
  /** The member's granted module slugs. Meaningless unless `mode` is `selected`. */
  granted: readonly string[];
}

/**
 * Whether `module` is reachable by this member.
 *
 * Fails CLOSED on an unrecognised mode: an unexpected value in the column is a
 * bug or tampering, and the safe reading of "I don't understand this
 * restriction" is to apply it, not to ignore it. (The migration's CHECK
 * constraint makes this branch unreachable through normal writes; it exists so
 * that being wrong is quiet rather than permissive.)
 */
export function memberCanReachModule(
  input: MemberModuleAccessInput,
  /** A module slug. Bare `string` because callers pass raw grant values and
   *  route params, not just the narrowed union. */
  module: string
): boolean {
  if (roleIgnoresModuleAccess(input.role)) return true;
  if (input.mode === 'all') return true;
  if (input.mode === 'selected') return input.granted.includes(module);
  return false;
}

/**
 * The member's effective module set, given the modules the TENANT has switched
 * on. Pass `enabled` from `listEnabledModules` — the result is what should drive
 * the rail, the launcher and the command palette, so a teammate is never offered
 * a door that will 403 them.
 *
 * Hiding rather than erroring is the right default for navigation: a module a
 * person cannot use is noise in a list they read a hundred times a day. The API
 * still enforces independently, because a hidden door is not a locked one.
 */
export function effectiveModules(
  input: MemberModuleAccessInput,
  enabled: readonly ModuleSlug[]
): ModuleSlug[] {
  return enabled.filter((module) => memberCanReachModule(input, module));
}

/**
 * Narrows a stored column value to the union, defaulting to `all`.
 *
 * Used at the read boundary so the rest of the code never handles a bare string.
 * Note this defaults an UNKNOWN value to `all` while `memberCanReachModule`
 * fails closed on one — deliberately: this function's job is to describe what is
 * configured (and "not configured" is `all`), whereas that function's job is to
 * decide access, where the cautious answer is the opposite. They are only ever
 * both wrong at once if the CHECK constraint is missing.
 */
export function parseModuleAccessMode(value: string | null | undefined): ModuleAccessMode {
  return value === 'selected' ? 'selected' : 'all';
}
