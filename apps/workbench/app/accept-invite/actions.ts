'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth, authPrisma, publishAuthEmail } from '@sparx/auth';

// Server actions for the team-invitation acceptance flow (docs/114 §A.4). These
// run through the Better Auth org plugin, which lives in this workbench process
// (app/api/auth/[...all]). Accepting an invitation adds the signed-in user to the
// inviting org and activates it, so the user lands directly inside the new
// workspace; session.ts then resolves the JWT tid/role from the members row.

export interface InviteActionResult {
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

/** Accept a team invitation (the accepting session must be the invited address),
 *  then activate that org so the user lands directly inside it. */
export async function acceptInvitation(invitationId: string): Promise<InviteActionResult> {
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
    // Close the loop for the inviter — tell them their invitation was accepted.
    // Best-effort: joining already succeeded, so a notification failure is ignored.
    try {
      const invitation = await authPrisma.invitation.findUnique({
        where: { id: invitationId },
        select: {
          email: true,
          organizationId: true,
          organization: { select: { name: true } },
          inviter: { select: { name: true, email: true } },
        },
      });
      if (invitation?.inviter?.email) {
        const appUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3001';
        await publishAuthEmail({
          tenantId: invitation.organizationId,
          actorId: null,
          template: 'invitation-accepted',
          to: invitation.inviter.email,
          props: {
            inviterName: invitation.inviter.name ?? undefined,
            inviteeEmail: invitation.email,
            orgName: invitation.organization.name,
            dashboardUrl: appUrl,
          },
        });
      }
    } catch {
      /* non-fatal — the invite was still accepted */
    }

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

/** Resend the email-verification link for an invitee whose signed-in address
 *  matches the invitation but isn't verified yet. The verification link returns
 *  them to this same invitation so they can accept once verified. */
export async function resendInviteVerification(
  email: string,
  invitationId: string
): Promise<InviteActionResult> {
  try {
    await auth.api.sendVerificationEmail({
      body: {
        email,
        callbackURL: `/accept-invite?invitation=${encodeURIComponent(invitationId)}`,
      },
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err, 'Could not send the verification email.') };
  }
}
