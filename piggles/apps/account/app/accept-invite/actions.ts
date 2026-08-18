'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth, authPrisma, publishAuthEmail } from '@wizeworks/auth';
import { appOrigin } from '@wizeworks/links/server';

// Accepting a team invitation (docs/114 §A.4).
//
// These run through the Better Auth organization plugin, which lives in THIS
// app's process (app/api/auth/[...all]) — the only Piggles app that mounts it.
// That is also why the whole invite flow is here rather than in the console: an
// invitee is not signed in yet, and the console has no sign-in page.
//
// Accepting adds the signed-in user to the inviting business and makes it
// active, so the next hop lands them inside it.

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

/** Accept an invitation — the accepting session must be the invited address —
 *  then make that business the active one. */
export async function acceptInvitation(invitationId: string): Promise<InviteActionResult> {
  let organizationId: string | null = null;
  try {
    const result = (await auth.api.acceptInvitation({
      body: { invitationId },
      headers: await headers(),
    })) as { member?: { organizationId?: string }; invitation?: { organizationId?: string } };
    organizationId = result?.member?.organizationId ?? result?.invitation?.organizationId ?? null;
  } catch (err) {
    return { ok: false, error: errorMessage(err, 'We could not accept that invitation.') };
  }

  if (organizationId) {
    // Close the loop for whoever sent it. Best-effort: joining already
    // succeeded, so a failed notification must not fail the join.
    try {
      const invitation = await authPrisma.invitation.findUnique({
        where: { id: invitationId },
        select: {
          email: true,
          organizationId: true,
          organization: { select: { name: true, platformBrand: true } },
          inviter: { select: { name: true, email: true } },
        },
      });
      if (invitation?.inviter?.email) {
        await publishAuthEmail({
          tenantId: invitation.organizationId,
          actorId: null,
          template: 'invitation-accepted',
          to: invitation.inviter.email,
          props: {
            inviterName: invitation.inviter.name ?? undefined,
            inviteeEmail: invitation.email,
            orgName: invitation.organization.name,
            // The INVITER's console, resolved from the business's own brand.
            // This used to read BETTER_AUTH_URL, which on this app is the
            // account domain — so the "they joined" email pointed the owner at a
            // sign-in page rather than at their team.
            dashboardUrl: appOrigin(invitation.organization.platformBrand),
          },
        });
      }
    } catch {
      /* non-fatal — the invitation was still accepted */
    }

    // Best-effort: joining succeeded; if this hiccups they can still switch
    // businesses from the picker.
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

/** Resend the verification link for an invitee whose address matches but is not
 *  verified yet. The link returns them to this same invitation. */
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
    return { ok: false, error: errorMessage(err, 'We could not send that email.') };
  }
}
