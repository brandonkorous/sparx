import { getInvitationDetail } from '@wizeworks/auth';

// Whether a sign-in or sign-up is on its way to accept an invitation, and to
// which business.
//
// Found in the other console (sparx persona issue 124): an invitee was greeted
// with "Welcome back" by sign-in, and here by sign-up with "Let's get you started.
// Fourteen days free. No card needed.", which reads like starting a business of
// their own. The return address already names the invitation; this reads it.

export interface Joining {
  orgName: string;
  email: string;
}

/** The invitation id in a return address like `/accept-invite?invitation=…`. */
export function invitationIdFrom(callbackURL: string): string | null {
  let url: URL;
  try {
    url = new URL(callbackURL, 'http://workbench.local');
  } catch {
    return null;
  }
  if (url.pathname !== '/accept-invite') return null;
  const id = url.searchParams.get('invitation');
  return id && id.length > 0 ? id : null;
}

/** The business and address of a live invitation, or null. */
export async function joiningFrom(callbackURL: string): Promise<Joining | null> {
  const id = invitationIdFrom(callbackURL);
  if (!id) return null;
  const invite = await getInvitationDetail(id).catch(() => null);
  if (invite?.status !== 'pending' || invite.expiresAt.getTime() <= Date.now()) {
    return null;
  }
  return { orgName: invite.orgName, email: invite.email };
}
