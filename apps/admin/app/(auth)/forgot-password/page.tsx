'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button, Input, Label, Stack, Text } from '@sparx/ui';
import { forgetPassword } from '@sparx/operator-auth/client';
import { AuthShell } from '../_components/auth-shell';

// Also the "set your password" path for a freshly-seeded operator (D10) who has
// no password yet — Better Auth's reset flow sets it on the credential account.
export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await forgetPassword({ email, redirectTo: '/reset-password' });
    if (result.error) {
      setError(result.error.message ?? 'Could not send the reset email.');
      setSubmitting(false);
      return;
    }
    setSent(true);
    setSubmitting(false);
  }

  return (
    <AuthShell title="Reset password" subtitle="We'll email you a link to set a new password.">
      {sent ? (
        <Stack gap={4}>
          <Text>
            If an operator account exists for <strong>{email}</strong>, a reset link is on its way.
          </Text>
          <Button variant="soft" asChild>
            <Link href="/sign-in">Back to sign in</Link>
          </Button>
        </Stack>
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
            {error ? (
              <Text size="sm" variant="danger" role="alert" aria-live="polite">
                {error}
              </Text>
            ) : null}
            <Button type="submit" disabled={submitting} loading={submitting}>
              Send reset link
            </Button>
            <Button variant="link" size="sm" asChild>
              <Link href="/sign-in">Back to sign in</Link>
            </Button>
          </Stack>
        </form>
      )}
    </AuthShell>
  );
}
