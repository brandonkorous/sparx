import { getInvitationDetail } from '@wizeworks/auth';

// Whether a sign-in or sign-up is on its way to accept an invitation, and to
// which business.
//
// MEASURED 2026-10-06: Kendra Ruiz, invited to Gillett Diesel as an editor, was
// greeted by the sign-in page with "Welcome back" and by the sign-up page with
// "Start your story. Your story, multiplied". Neither said she was joining
// Gillett, and the second reads like opening a business of her own (persona issue
// 124). The return address already names the invitation; this reads it.

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
