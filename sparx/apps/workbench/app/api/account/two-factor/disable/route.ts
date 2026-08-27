import { auth } from '@wizeworks/auth';
import { optionalPassword, readBody, relay } from '../../shared';

// Turning two-step verification off. Removes the enrolment AND the backup
// codes, so re-enabling later is a fresh setup with a new secret and an old QR
// screenshot is worthless afterwards.

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const body = await readBody(request);

  return relay((headers) => auth.api.disableTwoFactor({ body: optionalPassword(body), headers }));
}
