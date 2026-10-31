'use server';

// Send the signed-in owner a new confirm-your-email link (sparx persona issue
// 157). Sent by api-rest (docs/154), the same as the invitation flow's resend,
// and comes back to /verify-email on this console.

import { requestConfirmLink, type SendLinkResult } from '@wizeworks/auth-client-server';

/** Where the link comes back to. `app/verify-email/page.tsx` is that page. */
const LANDING = '/verify-email';

/** api-rest sends it, always to the signed-in person's own address, and refuses
 *  a send that could not leave this machine rather than claiming one went
 *  (sparx persona issue 337). */
export async function sendConfirmLink(): Promise<SendLinkResult> {
  return requestConfirmLink(LANDING);
}
