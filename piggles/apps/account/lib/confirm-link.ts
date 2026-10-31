import 'server-only';

import { platformRequest, PlatformRequestError } from '@wizeworks/auth-client-server';

// A fresh confirm-your-email link for the person signed in. api-rest builds and
// sends it, always to that person's own address: a link sent wherever a form
// said would be a way to mail anyone a link from us.

export interface SendLinkResult {
  ok: boolean;
  email?: string;
  error?: string;
}

/** `callbackURL` is where the link lands, a path on this app. Every failure is
 *  a sentence the screen shows as-is. */
export async function requestConfirmLink(callbackURL: string): Promise<SendLinkResult> {
  try {
    const sent = await platformRequest<{ ok: true; email: string }>('verification-email', {
      body: { callbackURL },
    });
    return { ok: true, email: sent.email };
  } catch (err) {
    if (err instanceof PlatformRequestError && err.status === 401) {
      return { ok: false, error: 'You are signed out. Sign in again, then ask for a new link.' };
    }
    const message = err instanceof PlatformRequestError ? err.body.error : null;
    return {
      ok: false,
      error:
        typeof message === 'string' && message
          ? message
          : 'The link didn’t send. Nothing changed. Try again in a minute.',
    };
  }
}
