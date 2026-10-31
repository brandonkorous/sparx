'use server';

import { requestConfirmLink, type SendLinkResult } from '@wizeworks/auth-client-server';

// Send the signed-in owner a new confirm-your-email link (sparx persona issue
// 157). It comes back to /verify-email here.

export async function sendConfirmLink(): Promise<SendLinkResult> {
  return requestConfirmLink('/verify-email');
}
