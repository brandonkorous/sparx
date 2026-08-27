import { auth } from '@wizeworks/auth';
import { optionalPassword, readBody, relay } from '../../shared';

// A fresh set of backup codes, invalidating the old ones. The right move after
// using some, or after losing the list. They are encrypted at rest, so this is
// the only way to see codes again once setup is over.

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const body = await readBody(request);

  return relay((headers) =>
    auth.api.generateBackupCodes({ body: optionalPassword(body), headers })
  );
}
