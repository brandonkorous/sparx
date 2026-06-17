'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Heading, Input, Label, PasswordInput, Stack, Text } from '@sparx/ui';
import { authClient } from '@sparx/auth/client';
import { AuthScreen } from '../_components/auth-screen';
import { SocialAuthSection } from '../_components/social-auth';

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

    const result = await authClient.signIn.email({ email, password });

    if (result.error) {
      setError(result.error.message ?? 'Invalid email or password.');
      setSubmitting(false);
      return;
    }

    // Land on '/'. The dashboard guard routes to /onboarding if setup isn't
    // finished, or to the dashboard if it is.
    router.push('/');
    router.refresh();
  }

  return (
    <AuthScreen
      lede={{
        title: 'Welcome back.',
        blurb: 'Your sites, orders, and customers are right where you left them.',
      }}
    >
      <Stack gap={6}>
        <div>
          <Heading level={2}>Sign in</Heading>
          <Text variant="muted">Sign in to your sparx workspace.</Text>
        </div>

        <SocialAuthSection />

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

            {error && (
              <Text size="sm" variant="danger" role="alert" aria-live="polite">
                {error}
              </Text>
            )}

            <Button type="submit" disabled={submitting} loading={submitting}>
              Sign in
            </Button>
          </Stack>
        </form>

        <Stack direction="row" align="center" gap={1}>
          <Text size="sm" variant="muted">
            New here?
          </Text>
          <Button color="primary" variant="link" size="sm" asChild>
            <Link href="/sign-up">Create an account</Link>
          </Button>
        </Stack>
      </Stack>
    </AuthScreen>
  );
}
