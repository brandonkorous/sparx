'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button, Loading } from 'silicaui-react';
import { authClient } from '@sparx/auth/client';
import { AuthScreen } from '../_components/auth-screen';

// Status landing for the verification link. The `?error=` param (set by Better
// Auth on a bad/expired token) is read at mount, client-only, so this stays out
// of static prerender. `email` is resolved server-side by the page wrapper.
export function VerifyEmailClient({ email }: { email: string | null }) {
  const [status, setStatus] = React.useState<'checking' | 'success' | 'error'>('checking');
  const [resending, setResending] = React.useState(false);
  const [resent, setResent] = React.useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setStatus(params.has('error') ? 'error' : 'success');
  }, []);

  async function resend() {
    if (!email) return;
    setResending(true);
    try {
      await authClient.sendVerificationEmail({ email, callbackURL: '/verify-email' });
      setResent(true);
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthScreen
      lede={{
        title: 'Confirm your email.',
        blurb: 'Verifying unlocks custom domains, going live, and sending email.',
      }}
    >
      <div className="flex flex-col gap-6">
        {status === 'checking' && (
          <div className="flex flex-row items-center gap-2">
            <Loading className="h-4 w-4" />
            <p className="text-base-content/70">Confirming your email…</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Email confirmed</h2>
              <p className="text-base-content/70">
                Your email address is verified — you&apos;re all set.
              </p>
            </div>
            <Button render={<Link href="/" />}>Go to dashboard</Button>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">This link didn&apos;t work</h2>
              <p className="text-base-content/70">
                The confirmation link is invalid or has expired. Request a fresh one below.
              </p>
            </div>
            {resent ? (
              <p className="text-sm">A new confirmation email is on its way. Check your inbox.</p>
            ) : email ? (
              <Button onClick={resend} disabled={resending} loading={resending}>
                Resend confirmation email
              </Button>
            ) : (
              <Button render={<Link href="/sign-in" />}>Sign in to resend</Button>
            )}
          </div>
        )}
      </div>
    </AuthScreen>
  );
}
