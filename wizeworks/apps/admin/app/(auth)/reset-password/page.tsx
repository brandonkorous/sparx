'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button, Stack, Text } from '@wizeworks/ui';
import {
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  PasswordInput,
} from '@wizeworks/silicaui-react';
import { rule, rules, useFieldValidation } from '@wizeworks/forms';
import { resetPassword } from '@wizeworks/operator-auth/client';
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

  const v = useFieldValidation(
    { password },
    {
      password: rules(
        rule.required('Enter a new password.'),
        rule.minLength(12, 'Use at least 12 characters.')
      ),
    }
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setError('This reset link is invalid or has expired. Request a new one.');
      return;
    }
    setError(null);
    if (!v.validate()) return;
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
            <Field {...v.field('password')}>
              <FieldLabel required>New password</FieldLabel>
              <FieldControl
                name="password"
                autoComplete="new-password"
                minLength={12}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                {...v.control('password')}
                render={<PasswordInput />}
              />
            </Field>
            {error ? (
              <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                {error}
              </FieldStatus>
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
