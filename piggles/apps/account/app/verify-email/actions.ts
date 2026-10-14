'use server';

// Send the signed-in owner a new confirm-your-email link (sparx persona issue
// 157). This app hosts the sign-in system, so the link is built here and comes
// back to /verify-email here.

import { auth, getSession } from '@wizeworks/auth';

export interface SendLinkResult {
  ok: boolean;
  email?: string;
  error?: string;
}

/** Where the link comes back to: `app/verify-email/page.tsx`. */
const LANDING = '/verify-email';

export async function sendConfirmLink(): Promise<SendLinkResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: 'You are signed out. Sign in again, then ask for a new link.' };
  }
  if (session.user.emailVerified) return { ok: true, email: session.user.email };
  try {
    await auth.api.sendVerificationEmail({
      body: { email: session.user.email, callbackURL: LANDING },
    });
    return { ok: true, email: session.user.email };
  } catch {
    return { ok: false, error: 'The link didn’t send. Nothing changed. Try again in a minute.' };
  }
}
