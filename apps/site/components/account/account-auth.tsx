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

export type AuthMode = 'signin' | 'register' | 'forgot' | 'reset';

/** Narrow an arbitrary host-prop value to a known auth mode (defaults to sign-in — the
 *  safe default for a freshly palette-inserted core with no mode set). */
export function toAuthMode(value: unknown): AuthMode {
  return value === 'register' || value === 'forgot' || value === 'reset' ? value : 'signin';
}

export function AccountAuth({ mode }: { mode: AuthMode }) {
  switch (mode) {
    case 'register':
      return (
        <Suspense fallback={<div className="st-skeleton" style={{ height: 420, maxWidth: 560 }} />}>
          <AuthPanel initial="register" />
        </Suspense>
      );
    case 'forgot':
      return (
        <Suspense fallback={<div className="st-skeleton" style={{ height: 240 }} />}>
          <ForgotForm />
        </Suspense>
      );
    case 'reset':
      return (
        <div className="st-container--prose">
          <h1 className="st-h2" style={{ marginBottom: '1.5rem' }}>
            Set a new password
          </h1>
          <Suspense fallback={<div className="st-skeleton" style={{ height: 240 }} />}>
            <ResetForm />
          </Suspense>
        </div>
      );
    case 'signin':
    default:
      return (
        <Suspense fallback={<div className="st-skeleton" style={{ height: 360, maxWidth: 560 }} />}>
          <AuthPanel initial="signin" />
        </Suspense>
      );
  }
}
