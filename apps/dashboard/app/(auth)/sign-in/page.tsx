'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button, Heading, Input, Label, PasswordInput, Stack, Text } from '@sparx/ui';
import { authClient } from '@sparx/auth/client';
import { AuthScreen } from '../_components/auth-screen';
import { SocialAuthSection } from '../_components/social-auth';

/** Only allow same-origin relative paths as a post-login destination — never a
 *  protocol-relative (`//host`) or absolute URL, which would be an open
 *  redirect. Used to resume the MCP OAuth consent flow after sign-in. */
function safeCallback(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null;
  return raw;
}

export default function SignInPage() {
  // useSearchParams() must sit under a Suspense boundary or Next's static
  // prerender of this route errors.
  return (
    <React.Suspense fallback={null}>
      <SignInForm />
    </React.Suspense>
  );
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackURL = safeCallback(searchParams.get('callbackURL'));
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

    // Resume an in-flight flow (e.g. MCP OAuth consent) when a safe callbackURL
    // was supplied; otherwise land on '/'. The dashboard guard then resumes
    // onboarding if setup isn't finished, or shows the dashboard if it is.
    router.push(callbackURL ?? '/');
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
