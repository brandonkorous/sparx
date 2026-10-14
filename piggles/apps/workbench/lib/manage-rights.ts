'use client';

// WHO MAY CHANGE HOW THE BUSINESS IS SET UP, said once.
//
// The server answers it on every write (`requireRole(request, 'admin')`), and a
// screen has to answer it BEFORE the write: a form that invites a change and
// refuses it on Save is the defect. Alyssa, Gillett's bookkeeper and an Editor,
// typed into Business details and was told "Check the fields and try again"
// (sparx persona issue 168).
//
// The rule is the server's ladder: owner, then admin. Lateral roles (builder,
// marketing, support, partner, scanner) never manage the business here, matching
// the server, where they floor to read-only.
//
// It was written out by hand in a dozen screens, each its own copy. This is the
// copy; `manage-rights.test.ts` keeps it the only one.

import { useViewer } from './api/shell-data';

/** Whether this role may change how the business is set up. */
export function canManageBusiness(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

/**
 * The signed-in person's right to change settings, as a screen needs it.
 *
 * `known` is false until the session has been read. A screen locks nothing and
 * says nothing until then, so an owner never sees a notice flash past.
 */
export function useManageRights(): { known: boolean; canManage: boolean } {
  const { data: viewer } = useViewer();
  if (!viewer) return { known: false, canManage: false };
  return { known: true, canManage: canManageBusiness(viewer.role) };
}
