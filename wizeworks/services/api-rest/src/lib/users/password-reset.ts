// Client for a brand's internal user password-reset route (docs/apps/admin —
// user & site management). Password resets run only where Better Auth lives, so
// an operator triggering one delegates to POST
// {account app}/api/internal/user-password-reset, which calls
// auth.api.requestPasswordReset and publishes the `password-reset` email.
// Authenticated with the shared internal secret (SPARX_INTERNAL_JWT_SECRET),
// reusing the exact seam the partner provisioning uses — no new secret/config.
//
// ── THE ADDRESS IS PER BRAND, NOT A CONSTANT ────────────────────────────────
//
// This used to POST to one hardcoded host for every reset. That was already
// wrong before logins were split by brand — a customer of one product was mailed
// a reset link into the other product's app — and it became wrong in a second,
// quieter way afterwards: an auth instance can only see its own brand's logins,
// so a reset aimed at the wrong instance finds nothing and reports success,
// because "we never reveal whether the email exists" is the correct behavior for
// the endpoint and indistinguishable from this failure. The operator sees "sent"
// and the customer's inbox stays empty.
//
// So the brand travels with the request and picks the host.

import { accountInternalOrigin } from '@wizeworks/links/server';
import { env } from '../../env.js';

const TOKEN_HEADER = 'x-sparx-internal-provision-token';
const TIMEOUT_MS = 15_000;

/** Trigger a Better Auth password-reset email for a staff user, via that user's
 *  own brand's account app. `platformBrand` comes from the user row — never
 *  assumed — because it decides which instance can even see the account.
 *  Returns whether the reset was dispatched. Never throws on a reachable failure —
 *  a non-2xx resolves to `false` so the operator sees a soft "couldn't send" rather
 *  than a 500 (the account is not modified either way). */
export async function requestUserPasswordReset(
  email: string,
  platformBrand: string
): Promise<boolean> {
  const secret = env.SPARX_INTERNAL_JWT_SECRET;
  const base = accountInternalOrigin(platformBrand).replace(/\/$/, '');
  const url = `${base}/api/internal/user-password-reset`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [TOKEN_HEADER]: secret,
      },
      body: JSON.stringify({ email }),
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const data = (await res.json().catch(() => ({}))) as { sent?: boolean };
    return data.sent !== false;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
