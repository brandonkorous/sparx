'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Stack, Text } from '@sparx/ui';
import {
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  PasswordInput,
} from '@wizeworks/silicaui-react';
import { rule, rules, useFieldValidation } from '@sparx/forms';
import { signIn } from '@sparx/operator-auth/client';
import { AuthShell } from '../_components/auth-shell';

export default function SignInPage() {
  const router = useRouter();
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
            <Stack direction="row" align="center" justify="between">
              <FieldLabel required>Password</FieldLabel>
              <Link href="/forgot-password">
                <Text size="xs" variant="muted">
                  Forgot password?
                </Text>
              </Link>
            </Stack>
            <FieldControl
              name="password"
              autoComplete="current-password"
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
            Sign in
          </Button>
        </Stack>
      </form>
    </AuthShell>
  );
}
