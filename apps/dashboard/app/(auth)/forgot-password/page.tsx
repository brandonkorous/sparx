'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button, Heading, Input, Label, Stack, Text } from '@sparx/ui';
import { authClient } from '@sparx/auth/client';
import { AuthScreen } from '../_components/auth-screen';

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    await authClient.requestPasswordReset({
      email,
      redirectTo: '/reset-password',
    });

    setSubmitting(false);
    // Don't leak whether the account exists — always show the same success
    // state. Real error logging happens server-side.
    setSubmitted(true);
  }

  return (
    <AuthScreen
      lede={{
        title: 'Reset your password.',
        blurb: "We'll email you a secure link to choose a new one.",
      }}
    >
      <Stack gap={6}>
        <div>
          <Heading level={2}>Reset your password</Heading>
          <Text variant="muted">
            Enter the email tied to your account and we&apos;ll send you a reset link.
          </Text>
        </div>

        {submitted ? (
          <Text size="sm">
            If an account exists for <strong>{email}</strong>, you&apos;ll get an email within a
            minute. Check your spam folder if you don&apos;t see it.
          </Text>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <Stack gap={4}>
              <Stack gap={2}>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Stack>

              {error && (
                <Text size="sm" variant="danger" role="alert" aria-live="polite">
                  {error}
                </Text>
              )}

              <Button type="submit" disabled={submitting} loading={submitting}>
                Send reset link
              </Button>
            </Stack>
          </form>
        )}

        <Button color="primary" variant="link" size="sm" asChild>
          <Link href="/sign-in">Back to sign in</Link>
        </Button>
      </Stack>
    </AuthScreen>
  );
}
