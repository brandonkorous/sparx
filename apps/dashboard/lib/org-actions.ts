'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { auth } from '@sparx/auth/server';

// Active-organization + invitation server actions (docs/114 §A.3/A.4). These run
// through the Better Auth org plugin, which lives in this Next.js process. Setting
// the active org rewrites `session.activeOrganizationId`; session.ts then resolves
// the JWT `tid`/`role` from the matching `members` row, so every RLS-scoped call
// after a switch is authorized for the newly-active org. Callers navigate/refresh
// themselves (no redirect() here) so a client transition stays in control.

export interface OrgActionResult {
  ok: boolean;
  error?: string;
}

function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'body' in err) {
    const body = (err as { body?: { message?: string } }).body;
    if (body?.message) return body.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/** Make `organizationId` the session's active org, then revalidate the whole
 *  layout so the shell (breadcrumb, rail, module gate) re-renders for it. The
 *  caller refreshes or navigates. */
export async function switchOrganization(organizationId: string): Promise<OrgActionResult> {
  try {
    await auth.api.setActiveOrganization({
      body: { organizationId },
      headers: await headers(),
    });
  } catch (err) {
    return { ok: false, error: errorMessage(err, 'Could not switch workspace.') };
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Accept a team invitation (the accepting session must be the invited address),
 *  then activate that org so the user lands directly inside it. */
export async function acceptInvitation(invitationId: string): Promise<OrgActionResult> {
  let organizationId: string | null = null;
  try {
    const result = (await auth.api.acceptInvitation({
      body: { invitationId },
      headers: await headers(),
    })) as { member?: { organizationId?: string }; invitation?: { organizationId?: string } };
    organizationId = result?.member?.organizationId ?? result?.invitation?.organizationId ?? null;
  } catch (err) {
    return { ok: false, error: errorMessage(err, 'Could not accept the invitation.') };
  }

  if (organizationId) {
    // Best-effort: joining succeeded; if activation hiccups the user can still
    // switch into the new account from the accounts picker.
    try {
      await auth.api.setActiveOrganization({
        body: { organizationId },
        headers: await headers(),
      });
    } catch {
      /* non-fatal */
    }
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}
