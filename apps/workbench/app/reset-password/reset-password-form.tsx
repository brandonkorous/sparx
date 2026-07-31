'use client';

// Lands here from the password-reset email link (the forgot-password flow sets
// redirectTo='/reset-password', and Better Auth appends ?token=). The token is
// read from the URL at submit time (client-only) rather than useSearchParams,
// which would force this route out of static prerender. Uses the same AuthShell
// chrome as the rest of the logged-out surface.

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { authClient } from '@sparx/auth/client';
import {
  Alert,
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  PasswordInput,
  Text,
} from '@wizeworks/silicaui-react';
import { AuthShell } from '../../components/auth-shell';

const MIN_PASSWORD = 8;

export function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD) {
      setError(`Use a password of at least ${String(MIN_PASSWORD)} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('Those passwords don’t match.');
      return;
    }

    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setError('This reset link is invalid or has expired. Request a new one.');
      return;
    }

    setPending(true);
    const result = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);

    if (result.error) {
      setError(
        result.error.message ?? 'We could not reset your password. The link may have expired.'
      );
      return;
    }
    setDone(true);
  }

  return (
    <AuthShell
      tabs={[{ id: 'reset', label: 'Set a new password', icon: KeyRound }]}
      activeTab="reset"
    >
      {done ? (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold">Password updated</h2>
            <Text className="text-sm">You can now sign in with your new password.</Text>
          </div>
          <Button color="primary" render={<Link href="/sign-in" />}>
            Go to sign in
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold">Set a new password</h2>
            <Text className="text-sm">
              Choose something strong — at least {MIN_PASSWORD} characters.
            </Text>
          </div>

          {error ? (
            <Alert color="danger" variant="soft" role="alert">
              {error}
            </Alert>
          ) : null}

          <Field>
            <FieldLabel>New password</FieldLabel>
            <FieldControl
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
              render={<PasswordInput />}
            />
            <FieldDescription>At least {MIN_PASSWORD} characters.</FieldDescription>
          </Field>

          <Field>
            <FieldLabel>Confirm new password</FieldLabel>
            <FieldControl
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(event) => {
                setConfirm(event.target.value);
              }}
              render={<PasswordInput />}
            />
          </Field>

          <Button type="submit" color="primary" disabled={pending} loading={pending}>
            Reset password
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
