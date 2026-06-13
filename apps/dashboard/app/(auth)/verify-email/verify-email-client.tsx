'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button, Heading, Spinner, Stack, Text } from '@sparx/ui';
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
      <Stack gap={6}>
        {status === 'checking' && (
          <Stack direction="row" align="center" gap={2}>
            <Spinner className="h-4 w-4" />
            <Text variant="muted">Confirming your email…</Text>
          </Stack>
        )}

        {status === 'success' && (
          <Stack gap={4}>
            <div>
              <Heading level={2}>Email confirmed</Heading>
              <Text variant="muted">Your email address is verified — you&apos;re all set.</Text>
            </div>
            <Button asChild>
              <Link href="/">Go to dashboard</Link>
            </Button>
          </Stack>
        )}

        {status === 'error' && (
          <Stack gap={4}>
            <div>
              <Heading level={2}>This link didn&apos;t work</Heading>
              <Text variant="muted">
                The confirmation link is invalid or has expired. Request a fresh one below.
              </Text>
            </div>
            {resent ? (
              <Text size="sm">A new confirmation email is on its way. Check your inbox.</Text>
            ) : email ? (
              <Button onClick={resend} disabled={resending} loading={resending}>
                Resend confirmation email
              </Button>
            ) : (
              <Button asChild>
                <Link href="/sign-in">Sign in to resend</Link>
              </Button>
            )}
          </Stack>
        )}
      </Stack>
    </AuthScreen>
  );
}
