'use server';

// Create-account server action. The workbench's other methods (Google, code,
// link) provision via Better Auth's own hooks, but a PASSWORD sign-up goes
// through the canonical `signUpMerchant`: it writes the Tenant, owner User +
// Account, the owner membership, AND the platform legal-acceptance record in one
// transaction — with the request IP + user-agent captured for that record
// (docs/42 §6) — then fires the welcome / verification / tenant.created events.
// Doing this on the server is what makes the "accepted the ToS at sign-up"
// record auditable; the client can't be trusted to write it. signUpMerchant
// leaves the user signed OUT, so we sign them in here to set the session cookie.

import { headers } from 'next/headers';
import { signUpMerchant, SignUpError } from '@sparx/auth';
import { auth } from '@sparx/auth/server';

export interface SignUpActionInput {
  name: string;
  email: string;
  password: string;
  /** Mirrors the required checkbox; re-checked here so the record is truthful. */
  agreeLegal: boolean;
}

export interface SignUpActionResult {
  ok: boolean;
  error?: string;
  /** New user's id on success — the client stamps first-touch acquisition onto
   *  the PostHog person with it (docs/80 §6.1, lib/analytics identifyFirstTouch). */
  userId?: string;
}

export async function signUpAction(input: SignUpActionInput): Promise<SignUpActionResult> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const { password, agreeLegal } = input;

  if (!name || !email || !password) return { ok: false, error: 'All fields are required.' };
  if (password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' };
  }
  if (!agreeLegal) {
    return { ok: false, error: 'Please accept the policies to create your account.' };
  }

  // Captured for the legal-acceptance record. x-forwarded-for's first hop is the
  // client behind Caddy/Cloudflare.
  const hdrs = await headers();
  const forwarded = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ipAddress = forwarded && forwarded.length > 0 ? forwarded : null;
  const userAgent = hdrs.get('user-agent');

  let userId: string;
  try {
    ({ userId } = await signUpMerchant({ email, password, name, ipAddress, userAgent }));
  } catch (err) {
    if (err instanceof SignUpError) return { ok: false, error: err.message };
    return { ok: false, error: 'Could not create account. Please try again.' };
  }

  // Establish the session cookie (signUpMerchant only writes rows). nextCookies()
  // flushes the Set-Cookie from this server action.
  try {
    await auth.api.signInEmail({ body: { email, password }, headers: hdrs, asResponse: false });
  } catch {
    return { ok: false, error: 'Account created — but sign-in failed. Try signing in.' };
  }

  return { ok: true, userId };
}
