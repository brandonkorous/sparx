'use server';

import { ATTR_COOKIES, deserializeSnapshot, REF_COOKIE } from '@sparx/attribution';
import { signUpMerchant, SignUpError } from '@sparx/auth';
import { auth } from '@sparx/auth/server';
import { cookies, headers } from 'next/headers';

// Partner referral attribution (docs/114 §B.3). Best-effort server-to-server call
// to the api-rest internal hook, which resolves the partner by code and records
// the referral under the PARTNER's org (RLS-safe cross-org write). Fire-and-forget:
// a hiccup here must never fail an otherwise-good signup. Requires the shared
// secret + REST url; absent either (dev), it's a silent no-op.
async function recordPartnerReferral(
  referredTenantId: string,
  referralCode: string
): Promise<void> {
  const base = process.env.SPARX_API_REST_URL;
  const token = process.env.SPARX_INTERNAL_PARTNERS_TOKEN;
  if (!base || !token) return;
  try {
    await fetch(`${base}/internal/partners/referrals`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-sparx-internal-partners-token': token },
      body: JSON.stringify({ referralCode, referredTenantId }),
      cache: 'no-store',
    });
  } catch {
    /* best-effort; the partner just isn't credited if the hook is unreachable */
  }
}

export interface SignUpFormState {
  ok: boolean;
  error?: string;
  /** New user's id on success — the client stamps first-touch onto the PostHog
   *  person with it (docs/80 §6.1). */
  userId?: string;
}

// Creates Tenant + User + Account in one transaction, then signs the user in
// so the dashboard layout's session check finds a fresh cookie.
export async function signUpAction(formData: FormData): Promise<SignUpFormState> {
  function readField(key: string): string {
    const value = formData.get(key);
    return typeof value === 'string' ? value : '';
  }
  const email = readField('email');
  const password = readField('password');
  const name = readField('name');
  const agreed = formData.get('agreeLegal') === 'on' || formData.get('agreeLegal') === 'true';

  if (!email || !password || !name) {
    return { ok: false, error: 'All fields are required.' };
  }
  if (password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' };
  }
  if (!agreed) {
    return {
      ok: false,
      error: 'Please accept the Terms of Service, Privacy Policy, and Acceptable Use Policy.',
    };
  }

  // Captured for the legal-acceptance record (docs/42 §6). x-forwarded-for's
  // first hop is the client behind Caddy/Cloudflare.
  const hdrs = await headers();
  const fwd = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ipAddress = fwd && fwd.length > 0 ? fwd : null;
  const userAgent = hdrs.get('user-agent');

  // Marketing attribution (docs/80 §6.1) — the first-party touch cookies are set
  // on sparx.works and carried here across the `.sparx.works` boundary. Acquisition
  // is attributed to first-touch (docs/80 §9); both snapshots ride along for recompute.
  const cookieStore = await cookies();
  const firstTouch = deserializeSnapshot(cookieStore.get(ATTR_COOKIES.first)?.value);
  const lastTouch = deserializeSnapshot(cookieStore.get(ATTR_COOKIES.last)?.value);
  const acquisition =
    firstTouch || lastTouch
      ? {
          channel: firstTouch?.channel ?? lastTouch?.channel ?? null,
          source: firstTouch?.source ?? lastTouch?.source ?? null,
          campaign: firstTouch?.campaign ?? lastTouch?.campaign ?? null,
          firstTouch,
          lastTouch,
        }
      : null;

  let userId = '';
  try {
    const result = await signUpMerchant({
      email,
      password,
      name,
      ipAddress,
      userAgent,
      acquisition,
    });
    userId = result.userId;

    // Credit the referring partner (docs/114 §B.3), if a `?ref=` code rode along
    // the `.sparx.works` cookie boundary. Best-effort — never blocks the signup.
    const refCode = cookieStore.get(REF_COOKIE)?.value;
    if (refCode) await recordPartnerReferral(result.tenantId, refCode);
  } catch (err) {
    if (err instanceof SignUpError) {
      return { ok: false, error: err.message };
    }
    return { ok: false, error: 'Could not create account. Please try again.' };
  }

  try {
    await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
      asResponse: false,
    });
  } catch {
    return { ok: false, error: 'Account created, but sign-in failed. Try signing in.' };
  }

  return { ok: true, userId };
}
