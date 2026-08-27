import { auth } from '@wizeworks/auth';
import { readBody, relay } from '../../shared';

// Step 2: prove a code from the authenticator app. On success the server marks
// the enrolment verified and flips `twoFactorEnabled` -- this is the call that
// actually turns two-step verification on.

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const body = await readBody(request);
  const code = typeof body.code === 'string' ? body.code : '';

  return relay((headers) => auth.api.verifyTOTP({ body: { code }, headers }));
}
