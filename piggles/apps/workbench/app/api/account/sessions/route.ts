import { auth } from '@wizeworks/auth';
import { readBody, relay } from '../shared';

// The devices this account is signed in on, and ending one of them.
//
// GET lists them. POST ends one by its token, or every OTHER one with
// { all: true } -- the "sign my other devices out" button, which deliberately
// cannot end the session making the request.

export const dynamic = 'force-dynamic';

export function GET(): Promise<Response> {
  return relay(async (headers) => {
    // Which row is THIS device is decided here, not in the browser. The client
    // used to work it out by comparing tokens against the auth client's own
    // session -- a call that, on this origin, came back as an HTML page, so no
    // row was ever marked and the "other devices" count silently included the
    // one you were sitting at.
    const [rows, current] = await Promise.all([
      auth.api.listSessions({ headers }),
      auth.api.getSession({ headers }),
    ]);
    const token = (current as { session?: { token?: string } } | null)?.session?.token ?? null;
    return (rows ?? []).map((row) => ({ ...row, current: row.token === token }));
  });
}

export async function POST(request: Request): Promise<Response> {
  const body = await readBody(request);
  if (body.all === true) {
    return relay((headers) => auth.api.revokeOtherSessions({ headers }));
  }
  const token = body.token;
  if (typeof token !== 'string' || token === '') {
    return relay(() => Promise.reject(new BadRequest('A device token is required.')));
  }
  return relay((headers) => auth.api.revokeSession({ body: { token }, headers }));
}

/** Shaped like Better Auth's own error so `relay` reports it the same way. */
class BadRequest extends Error {
  readonly statusCode = 400;
  readonly body: { message: string };
  constructor(message: string) {
    super(message);
    this.body = { message };
  }
}
