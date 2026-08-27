import { auth } from '@wizeworks/auth';
import { relay } from '../shared';

// How this account signs in -- specifically, whether it has a password at all.
//
// Better Auth records a `credential` account row for password users and a
// provider row (google, passkey, ...) for the rest; one operator can have both.
// The two-step verification forms ask for a password exactly when one exists,
// so this is what decides whether they show the field.
//
// It answers a BOOLEAN rather than the account rows: the surface only needs to
// know whether to ask, and the provider list is nobody's business but the
// account's own.

export const dynamic = 'force-dynamic';

export function GET(): Promise<Response> {
  return relay(async (headers) => {
    const rows = (await auth.api.listUserAccounts({ headers })) as { providerId?: string }[] | null;
    return { hasPassword: (rows ?? []).some((row) => row.providerId === 'credential') };
  });
}
