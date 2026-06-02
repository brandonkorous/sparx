'use server';

import { signUpMerchant, SignUpError } from '@sparx/auth';
import { auth } from '@sparx/auth/server';
import { headers } from 'next/headers';

export interface SignUpFormState {
  ok: boolean;
  error?: string;
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
  const storeName = readField('storeName');
  const agreed = formData.get('agreeLegal') === 'on' || formData.get('agreeLegal') === 'true';

  if (!email || !password || !name || !storeName) {
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

  try {
    await signUpMerchant({ email, password, name, storeName, ipAddress, userAgent });
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

  return { ok: true };
}
