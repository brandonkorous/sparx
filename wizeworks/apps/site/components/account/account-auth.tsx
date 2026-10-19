// The shopper account AUTH experience as ONE mode-parameterized component — the pinned
// `commerce.auth` core (docs/122). Every public /account entry page (sign in, create
// account, forgot, reset) is the SAME editable shell wrapping this core; the route sets the
// `mode` via the host node's props, and the core mounts the right self-contained form.
//
// Each inner form is a `'use client'` widget that reads its own URL params (the AuthPanel's
// `redirect`, the ResetForm's `token`), so each is wrapped in Suspense — a bare
// `useSearchParams()` without a boundary de-opts the whole route to client rendering (and
// Next warns at build). The skeleton fallbacks mirror the original per-page fallbacks.

import { Suspense } from 'react';

import { AuthPanel } from '@/components/auth-panel';
import { ResetForm } from '@/components/reset-form';
import { ForgotForm } from '@/components/account/forgot-form';
import { VerifyEmailForm } from '@/components/account/verify-email-form';

/** `verify` opens a "confirm it's you" link (sparx persona issue 329). */
export type AuthMode = 'signin' | 'register' | 'forgot' | 'reset' | 'verify';

/** Narrow an arbitrary host-prop value to a known auth mode (defaults to sign-in — the
 *  safe default for a freshly palette-inserted core with no mode set). */
export function toAuthMode(value: unknown): AuthMode {
  return value === 'register' || value === 'forgot' || value === 'reset' || value === 'verify'
    ? value
    : 'signin';
}

export function AccountAuth({ mode }: { mode: AuthMode }) {
  switch (mode) {
    case 'register':
      return (
        <Suspense fallback={<div className="skeleton" style={{ height: 420, maxWidth: 560 }} />}>
          <AuthPanel initial="register" />
        </Suspense>
      );
    case 'forgot':
      return (
        <Suspense fallback={<div className="skeleton" style={{ height: 240 }} />}>
          <ForgotForm />
        </Suspense>
      );
    case 'reset':
      return (
        <div className="mx-auto w-full max-w-[68ch] sm:px-6">
          <h1
            className="text-base-content text-3xl font-semibold tracking-tight"
            style={{ marginBottom: '1.5rem' }}
          >
            Set a new password
          </h1>
          <Suspense fallback={<div className="skeleton" style={{ height: 240 }} />}>
            <ResetForm />
          </Suspense>
        </div>
      );
    case 'verify':
      return (
        <div className="mx-auto w-full max-w-[68ch] py-10 sm:px-6">
          <h1 className="text-base-content mb-6 text-3xl font-semibold tracking-tight">
            Confirm your email
          </h1>
          <Suspense fallback={<div className="skeleton h-24" />}>
            <VerifyEmailForm />
          </Suspense>
        </div>
      );
    case 'signin':
    default:
      return (
        <Suspense fallback={<div className="skeleton" style={{ height: 360, maxWidth: 560 }} />}>
          <AuthPanel initial="signin" />
        </Suspense>
      );
  }
}
