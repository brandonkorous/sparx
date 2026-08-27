import { auth } from '@wizeworks/auth';
import { optionalPassword, readBody, relay } from '../shared';

// Step 1 of turning two-step verification on: mint the secret and the backup
// codes. Two-step verification is NOT active when this returns -- ./verify
// completes it with a code read off the operator's own phone, so a mis-scanned
// QR fails at the last step and costs nothing instead of locking someone out of
// their business.
//
// `issuer` is what the authenticator app labels the entry and it is baked into
// the QR at enrolment; nobody can correct it afterwards. The caller passes the
// running product's name so a Piggles owner does not find another product in
// their app.

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const body = await readBody(request);
  const issuer = typeof body.issuer === 'string' && body.issuer !== '' ? body.issuer : undefined;

  return relay((headers) =>
    auth.api.enableTwoFactor({
      body: { ...optionalPassword(body), ...(issuer ? { issuer } : {}) },
      headers,
    })
  );
}
