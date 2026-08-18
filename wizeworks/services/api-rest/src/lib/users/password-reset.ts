// Client for the dashboard's internal user password-reset route (docs/apps/admin —
// user & site management). Password resets run only where Better Auth lives — the
// dashboard — so an operator triggering a reset delegates to POST
// {dashboard}/api/internal/user-password-reset, which calls
// auth.api.requestPasswordReset and publishes the `password-reset` email.
// Authenticated with the shared internal secret (SPARX_INTERNAL_JWT_SECRET),
// reusing the exact seam the partner provisioning uses — no new secret/config.

import { env } from '../../env.js';

const TOKEN_HEADER = 'x-sparx-internal-provision-token';
const TIMEOUT_MS = 15_000;

/** Trigger a Better Auth password-reset email for a staff user, via the dashboard.
 *  Returns whether the reset was dispatched. Never throws on a reachable failure —
 *  a non-2xx resolves to `false` so the operator sees a soft "couldn't send" rather
 *  than a 500 (the account is not modified either way). */
export async function requestUserPasswordReset(email: string): Promise<boolean> {
  const secret = env.SPARX_INTERNAL_JWT_SECRET;
  const base = env.SPARX_DASHBOARD_INTERNAL_URL.replace(/\/$/, '');
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
