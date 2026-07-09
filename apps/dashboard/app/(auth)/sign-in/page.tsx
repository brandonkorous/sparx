'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Button,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  PasswordInput,
} from '@wizeworks/silicaui-react';
import { authClient } from '@sparx/auth/client';
import { AuthScreen } from '../_components/auth-screen';
import { SocialAuthSection } from '../_components/social-auth';
import { rule, rules, useFieldValidation } from '@sparx/forms';

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

  const v = useFieldValidation(
    { email, password },
    {
      email: rules(rule.required('Enter your email.'), rule.email()),
      password: rule.required('Enter your password.'),
    }
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!v.validate()) return;
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
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="text-base-content/70">Sign in to your sparx workspace.</p>
        </div>

        <SocialAuthSection />

        <form onSubmit={onSubmit} noValidate>
          <div className="flex flex-col gap-4">
            <Field {...v.field('email')}>
              <FieldLabel required>Email</FieldLabel>
              <FieldControl
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                {...v.control('email')}
              />
            </Field>
            <Field {...v.field('password')}>
              <div className="flex flex-row items-center justify-between gap-4">
                <FieldLabel required>Password</FieldLabel>
                <Link href="/forgot-password" className="text-base-content/70 text-xs">
                  Forgot password?
                </Link>
              </div>
              <FieldControl
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                {...v.control('password')}
                render={<PasswordInput />}
              />
            </Field>

            {error && (
              <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                {error}
              </FieldStatus>
            )}

            <Button type="submit" disabled={submitting} loading={submitting}>
              Sign in
            </Button>
          </div>
        </form>

        <div className="flex flex-row items-center gap-1">
          <p className="text-base-content/70 text-sm">New here?</p>
          <Button color="primary" variant="link" size="sm" render={<Link href="/sign-up" />}>
            Create an account
          </Button>
        </div>
      </div>
    </AuthScreen>
  );
}
