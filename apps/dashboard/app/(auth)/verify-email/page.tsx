'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button, Heading, Spinner, Stack, Text } from '@sparx/ui';
import { authClient } from '@sparx/auth/client';
import { AuthScreen } from '../_components/auth-screen';

// Landing page after the verification email link. Better Auth's verify endpoint
// does the actual token check, then redirects here — to callbackURL='/verify-email'
// on success, or with an `?error=` param on a bad/expired token. We read that at
// mount (client-only, so it stays out of static prerender).
export default function VerifyEmailPage() {
  const { data: session } = authClient.useSession();
  const [status, setStatus] = React.useState<'checking' | 'success' | 'error'>('checking');
  const [resending, setResending] = React.useState(false);
  const [resent, setResent] = React.useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setStatus(params.has('error') ? 'error' : 'success');
  }, []);

  async function resend() {
    const email = session?.user?.email;
    if (!email) return;
    setResending(true);
    await authClient.sendVerificationEmail({ email, callbackURL: '/verify-email' });
    setResending(false);
    setResent(true);
  }

  return (
    <AuthScreen
      lede={{
        title: 'Confirm your email.',
        blurb: 'Verifying unlocks your custom domain, going live, and sending email.',
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
            ) : session?.user?.email ? (
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
