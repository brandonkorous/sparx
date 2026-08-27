import { auth } from '@wizeworks/auth';
import { readBody, relay } from '../shared';

// Changing the caller's own password.
//
// The current password is required and verified server-side, so this is
// self-authenticating: a leaked, still-open tab cannot change the password
// without knowing the old one.

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const body = await readBody(request);
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
  // Default TRUE: the safe reading of a password change is that it was made
  // because something leaked, and leaving the other devices signed in would
  // undo the point of it.
  const revokeOtherSessions = body.revokeOtherSessions !== false;

  return relay((headers) =>
    auth.api.changePassword({
      body: { currentPassword, newPassword, revokeOtherSessions },
      headers,
    })
  );
}
