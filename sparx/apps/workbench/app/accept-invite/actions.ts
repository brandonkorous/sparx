'use server';

import { revalidatePath } from 'next/cache';
import {
  platformRequest,
  PlatformRequestError,
  requestConfirmLink,
  setSessionCookies,
  type SessionCookie,
} from '@wizeworks/auth-client-server';

// Server actions for the team-invitation acceptance flow (docs/114 §A.4). These
// run in api-rest, which holds the Better Auth org plugin (docs/154). Accepting
// an invitation adds the signed-in user to the inviting org and activates it,
// so the user lands directly inside the new workspace; session.ts then resolves
// the JWT tid/role from the members row.

export interface InviteActionResult {
  ok: boolean;
  error?: string;
}

/** api-rest's own sentence when it sent one, else the fallback. */
function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof PlatformRequestError) {
    if (err.status === 401) return 'You are signed out. Sign in again to accept the invitation.';
    const message = err.body.error;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}

export async function acceptInvitation(invitationId: string): Promise<InviteActionResult> {
  try {
    // Joining switches the session to the business, so the new session cookie
    // comes back with the answer; without it the next hop lands somewhere else.
    const { cookies } = await platformRequest<{ ok: true; cookies: SessionCookie[] }>(
      `invitations/${encodeURIComponent(invitationId)}/accept`,
      { body: {} }
    );
    await setSessionCookies(cookies);
  } catch (err) {
    return { ok: false, error: errorMessage(err, 'We could not accept that invitation.') };
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** A fresh confirm link that comes back to this invitation. It goes to the
 *  signed-in person's own address, which the page has already checked is the
 *  one invited. */
export async function resendInviteVerification(invitationId: string): Promise<InviteActionResult> {
  const sent = await requestConfirmLink(
    `/accept-invite?invitation=${encodeURIComponent(invitationId)}`
  );
  return sent.ok ? { ok: true } : { ok: false, error: sent.error };
}
