'use server';

// Create-account server action. The workbench's other methods (Google, code,
// link) provision via Better Auth's own hooks, but a PASSWORD sign-up goes
// through the canonical `signUpMerchant`: it writes the Tenant, owner User +
// Account, the owner membership, AND the platform legal-acceptance record in one
// transaction — with the request IP + user-agent captured for that record
// (docs/42 §6) — then fires the welcome / verification / tenant.created events.
// Doing this on the server is what makes the "accepted the ToS at sign-up"
// record auditable; the client can't be trusted to write it. It runs in
// api-rest (docs/154), which then signs the new owner in and hands back the
// session cookies; this action sets them.

import {
  platformRequest,
  PlatformRequestError,
  setSessionCookies,
  type SessionCookie,
} from '@wizeworks/auth-client-server';

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

  // Captured for the legal-acceptance record. NOT x-forwarded-for's first hop:
  // that is the one the client writes, so the record held whatever address the
  // signer typed. The chain is read from the right, past Caddy and Cloudflare.
  // api-rest makes the account (`signUpMerchant`, with the client address and
  // browser it reads off the forwarded request) and signs the new owner in.
  let created: { userId: string; signedIn: boolean; cookies: SessionCookie[] };
  try {
    created = await platformRequest('sign-up', { body: { email, password, name } });
  } catch (err) {
    if (err instanceof PlatformRequestError && (err.status === 400 || err.status === 409)) {
      const message = err.body.message;
      if (typeof message === 'string' && message) return { ok: false, error: message };
    }
    return { ok: false, error: 'Could not create account. Please try again.' };
  }

  if (!created.signedIn) {
    return { ok: false, error: 'Account created, but sign-in failed. Try signing in.' };
  }
  await setSessionCookies(created.cookies);

  return { ok: true, userId: created.userId };
}
