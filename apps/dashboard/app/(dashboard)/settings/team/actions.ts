'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';
import { auth } from '@sparx/auth/server';
import { ASSIGNABLE_ORG_ROLES, type AssignableOrgRole, type OrgRole } from '@sparx/auth';

// Settings → Team mutations (docs/114 §A.4). These run through the Better Auth
// organization plugin (auth.api.*), NOT api-rest: the plugin lives in this same
// Next.js process, enforces the caller's membership permissions (owner/admin
// only — org-roles.ts), and fires the `sendInvitationEmail` side effect that
// publishes the `team-invitation` email event. All calls act on the caller's
// ACTIVE organization (their JWT `tid`), so a consultant who switched into a
// client account manages THAT org's team.
//
// Errors from the plugin surface as APIError; we translate to a friendly message
// so the Team UI can render it inline.

export interface TeamActionResult {
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

const roleSchema = z.enum(ASSIGNABLE_ORG_ROLES as unknown as [OrgRole, ...OrgRole[]]);

const InviteSchema = z.object({
  email: z.string().email('Enter a valid email address.').max(255),
  role: roleSchema,
});

export async function inviteMember(formData: FormData): Promise<TeamActionResult> {
  const parsed = InviteSchema.safeParse({
    email: formData.get('email'),
    role: formData.get('role'),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid invitation.' };
  }

  try {
    await auth.api.createInvitation({
      body: { email: parsed.data.email, role: parsed.data.role },
      headers: await headers(),
    });
  } catch (err) {
    return { ok: false, error: errorMessage(err, 'Could not send the invitation.') };
  }

  revalidatePath('/settings/team');
  return { ok: true };
}

export async function changeMemberRole(
  memberId: string,
  role: AssignableOrgRole
): Promise<TeamActionResult> {
  if (!ASSIGNABLE_ORG_ROLES.includes(role)) {
    return { ok: false, error: 'That role cannot be assigned.' };
  }
  try {
    await auth.api.updateMemberRole({
      body: { memberId, role },
      headers: await headers(),
    });
  } catch (err) {
    return { ok: false, error: errorMessage(err, 'Could not change the role.') };
  }
  revalidatePath('/settings/team');
  return { ok: true };
}

export async function removeMember(memberId: string): Promise<TeamActionResult> {
  try {
    await auth.api.removeMember({
      body: { memberIdOrEmail: memberId },
      headers: await headers(),
    });
  } catch (err) {
    return { ok: false, error: errorMessage(err, 'Could not remove the member.') };
  }
  revalidatePath('/settings/team');
  return { ok: true };
}

export async function revokeInvitation(invitationId: string): Promise<TeamActionResult> {
  try {
    await auth.api.cancelInvitation({
      body: { invitationId },
      headers: await headers(),
    });
  } catch (err) {
    return { ok: false, error: errorMessage(err, 'Could not revoke the invitation.') };
  }
  revalidatePath('/settings/team');
  return { ok: true };
}
