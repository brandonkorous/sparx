'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button, PasswordInput, Label, Stack, Text } from '@sparx/ui';
import { resetPassword } from '@sparx/operator-auth/client';
import { AuthShell } from '../_components/auth-shell';

export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={null}>
      <ResetPasswordForm />
    </React.Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setError('This reset link is invalid or has expired. Request a new one.');
      return;
    }
    setError(null);
    setSubmitting(true);
    const result = await resetPassword({ newPassword: password, token });
    if (result.error) {
      setError(result.error.message ?? 'Could not reset the password.');
      setSubmitting(false);
      return;
    }
    router.push('/sign-in');
    router.refresh();
  }

  return (
    <AuthShell title="Set a new password" subtitle="Operator passwords are at least 12 characters.">
      {token ? (
        <form onSubmit={onSubmit} noValidate>
          <Stack gap={4}>
            <Stack gap={2}>
              <Label htmlFor="password">New password</Label>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="new-password"
                required
                minLength={12}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Stack>
            {error ? (
              <Text size="sm" variant="danger" role="alert" aria-live="polite">
                {error}
              </Text>
            ) : null}
            <Button type="submit" disabled={submitting} loading={submitting}>
              Set password
            </Button>
          </Stack>
        </form>
      ) : (
        <Stack gap={4}>
          <Text variant="danger">This reset link is invalid or has expired.</Text>
          <Button variant="soft" asChild>
            <Link href="/forgot-password">Request a new link</Link>
          </Button>
        </Stack>
      )}
    </AuthShell>
  );
}
