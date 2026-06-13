'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button, Heading, Label, PasswordInput, Stack, Text } from '@sparx/ui';
import { authClient } from '@sparx/auth/client';
import { AuthScreen } from '../_components/auth-screen';

// Lands here from the password-reset email link (forgot-password sets
// redirectTo='/reset-password'; Better Auth appends ?token=). We read the token
// from the URL at submit time (client-only) rather than useSearchParams, which
// would force this page out of static prerender and break `next build`.
export default function ResetPasswordPage() {
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const pw = formData.get('password');
    const cf = formData.get('confirmPassword');
    const password = typeof pw === 'string' ? pw : '';
    const confirm = typeof cf === 'string' ? cf : '';

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setError('This reset link is invalid or has expired. Request a new one.');
      return;
    }

    setError(null);
    setSubmitting(true);
    const result = await authClient.resetPassword({ newPassword: password, token });
    setSubmitting(false);

    if (result.error) {
      setError(result.error.message ?? 'Could not reset your password. The link may have expired.');
      return;
    }
    setDone(true);
  }

  return (
    <AuthScreen
      lede={{
        title: 'Choose a new password.',
        blurb: 'Pick something strong — at least 8 characters.',
      }}
    >
      <Stack gap={6}>
        <div>
          <Heading level={2}>Set a new password</Heading>
          <Text variant="muted">Enter a new password for your account.</Text>
        </div>

        {done ? (
          <Stack gap={4}>
            <Text size="sm">Your password has been reset. You can now sign in with it.</Text>
            <Button asChild>
              <Link href="/sign-in">Go to sign in</Link>
            </Button>
          </Stack>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <Stack gap={4}>
              <Stack gap={2}>
                <Label htmlFor="password">New password</Label>
                <PasswordInput
                  id="password"
                  name="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <Text size="xs" variant="muted">
                  At least 8 characters.
                </Text>
              </Stack>
              <Stack gap={2}>
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <PasswordInput
                  id="confirmPassword"
                  name="confirmPassword"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </Stack>

              {error && (
                <Text size="sm" variant="danger" role="alert" aria-live="polite">
                  {error}
                </Text>
              )}

              <Button type="submit" disabled={submitting} loading={submitting}>
                Reset password
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
