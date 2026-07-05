'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Input, Label, PasswordInput, Stack, Text } from '@sparx/ui';
import { signIn } from '@sparx/operator-auth/client';
import { AuthShell } from '../_components/auth-shell';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await signIn.email({ email, password });
    if (result.error) {
      setError(result.error.message ?? 'Invalid email or password.');
      setSubmitting(false);
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <AuthShell title="Operator sign in" subtitle="WizeWorks staff only.">
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
          <Stack gap={2}>
            <Stack direction="row" align="center" justify="between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password">
                <Text size="xs" variant="muted">
                  Forgot password?
                </Text>
              </Link>
            </Stack>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              required
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
            Sign in
          </Button>
        </Stack>
      </form>
    </AuthShell>
  );
}
