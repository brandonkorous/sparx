import { auth } from '@wizeworks/auth';
import { relay } from '../shared';

// How this account signs in: whether it has a password, and whether two-step
// verification is on.
//
// Better Auth records a `credential` account row for password users and a
// provider row (google, passkey, ...) for the rest; one operator can have both.
// The two-step forms ask for a password exactly when one exists, so this is what
// decides whether they show the field.
//
// `twoFactorEnabled` is read here rather than from the auth client's own
// `useSession()`. That hook calls /api/auth/get-session, which this origin does
// not serve, so it resolved to undefined and the card's badge read a flat "Off"
// -- on an account that had it switched on. A lookup that never answered is not
// a measurement, and it must not render as one.
//
// It answers BOOLEANS rather than the account rows: the surface only needs to
// know what to ask for, and the provider list is nobody's business but the
// account's own.

export const dynamic = 'force-dynamic';

export interface SignInMethods {
  hasPassword: boolean;
  twoFactorEnabled: boolean;
}

export function GET(): Promise<Response> {
  return relay(async (headers): Promise<SignInMethods> => {
    const [rows, session] = await Promise.all([
      auth.api.listUserAccounts({ headers }),
      auth.api.getSession({ headers }),
    ]);
    const user = (session as { user?: { twoFactorEnabled?: boolean } } | null)?.user;
    return {
      hasPassword: (rows ?? []).some((row) => row.providerId === 'credential'),
      twoFactorEnabled: user?.twoFactorEnabled === true,
    };
  });
}
