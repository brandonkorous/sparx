// Sending a staff user a password-reset email (docs/apps/admin, user & site
// management).
//
// Better Auth lives in this process now (docs/154), so the reset runs here, on
// the user's own brand's instance. It used to POST to that brand's account app,
// which called `requestPasswordReset` on its own instance; an app holds no auth
// instance any more, and the hop is gone with it.
//
// ── THE BRAND IS PER USER, NOT A CONSTANT ───────────────────────────────────
//
// An auth instance can only see its own brand's logins, so a reset run on the
// wrong one finds nothing and reports success, because "we never reveal whether
// the email exists" is the correct behavior for the endpoint and
// indistinguishable from this failure. The operator sees "sent" and the
// customer's inbox stays empty. So the brand comes from the user row and picks
// the instance, and a brand this process does not serve is a plain "not sent".

import { auth, registeredAuthBrands } from '@wizeworks/auth';
import { normalizeBrandKey } from '@wizeworks/brand-core';
import { runAsBrand } from '@wizeworks/brand-core/request-scope';

/** Trigger a Better Auth password-reset email for a staff user, on their own
 *  brand's instance. Returns whether it was dispatched. Never throws: a failure
 *  resolves to `false` so the operator sees a soft "couldn't send" rather than a
 *  500 (the account is not modified either way). */
export async function requestUserPasswordReset(
  email: string,
  platformBrand: string
): Promise<boolean> {
  const brand = normalizeBrandKey(platformBrand);
  if (!registeredAuthBrands().includes(brand)) return false;
  try {
    // A path on the brand's own sign-in host, which Better Auth's base URL is.
    await runAsBrand(brand, () =>
      auth.api.requestPasswordReset({ body: { email, redirectTo: '/reset-password' } })
    );
    return true;
  } catch (err) {
    process.stderr.write(
      JSON.stringify({
        severity: 'ERROR',
        source: 'api-rest.user-password-reset',
        brand,
        message: 'requestPasswordReset failed',
        err: err instanceof Error ? { name: err.name, message: err.message } : String(err),
      }) + '\n'
    );
    return false;
  }
}
