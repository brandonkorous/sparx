'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  PasswordInput,
} from '@wizeworks/silicaui-react';
import { authClient } from '@sparx/auth/client';
import { AuthScreen } from '../_components/auth-screen';
import { rule, useFieldValidation } from '@sparx/forms';

// Lands here from the password-reset email link (forgot-password sets
// redirectTo='/reset-password'; Better Auth appends ?token=). We read the token
// from the URL at submit time (client-only) rather than useSearchParams, which
// would force this page out of static prerender and break `next build`.
export default function ResetPasswordPage() {
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const v = useFieldValidation(
    { password, confirmPassword },
    {
      password: rule.minLength(8, 'Password must be at least 8 characters.'),
      confirmPassword: rule.matches('password', 'Passwords do not match.'),
    }
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!v.validate()) return;

    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setError('This reset link is invalid or has expired. Request a new one.');
      return;
    }

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
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Set a new password</h2>
          <p className="text-base-content/70">Enter a new password for your account.</p>
        </div>

        {done ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm">Your password has been reset. You can now sign in with it.</p>
            <Button render={<Link href="/sign-in" />}>Go to sign in</Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <div className="flex flex-col gap-4">
              <Field {...v.field('password')}>
                <FieldLabel required>New password</FieldLabel>
                <FieldControl
                  name="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  {...v.control('password')}
                  render={<PasswordInput />}
                />
                <FieldDescription>At least 8 characters.</FieldDescription>
              </Field>
              <Field {...v.field('confirmPassword')}>
                <FieldLabel required>Confirm new password</FieldLabel>
                <FieldControl
                  name="confirmPassword"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  {...v.control('confirmPassword')}
                  render={<PasswordInput />}
                />
              </Field>

              {error && (
                <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                  {error}
                </FieldStatus>
              )}

              <Button type="submit" disabled={submitting} loading={submitting}>
                Reset password
              </Button>
            </div>
          </form>
        )}

        <Button color="primary" variant="link" size="sm" render={<Link href="/sign-in" />}>
          Back to sign in
        </Button>
      </div>
    </AuthScreen>
  );
}
