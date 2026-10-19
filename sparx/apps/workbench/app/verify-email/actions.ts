'use server';

// Send the signed-in owner a new confirm-your-email link (sparx persona issue
// 157). Runs through Better Auth in this workbench process, the same as the
// invitation flow's resend, and comes back to /verify-email on this console.

import { auth, authEmailsCanLeave, getSession } from '@wizeworks/auth';

export interface SendLinkResult {
  ok: boolean;
  email?: string;
  error?: string;
}

/** Where the link comes back to. `app/verify-email/page.tsx` is that page. */
const LANDING = '/verify-email';

export async function sendConfirmLink(): Promise<SendLinkResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: 'You are signed out. Sign in again, then ask for a new link.' };
  }
  if (session.user.emailVerified) return { ok: true, email: session.user.email };
  // A send Better Auth would swallow is refused here, so nobody is told a link
  // is on its way when it cannot leave this machine (sparx persona issue 337).
  if (!authEmailsCanLeave()) {
    return {
      ok: false,
      error: 'Email cannot be sent from here right now, so no link went. Nothing changed.',
    };
  }
  try {
    await auth.api.sendVerificationEmail({
      body: { email: session.user.email, callbackURL: LANDING },
    });
    return { ok: true, email: session.user.email };
  } catch {
    return { ok: false, error: 'The link didn’t send. Nothing changed. Try again in a minute.' };
  }
}
