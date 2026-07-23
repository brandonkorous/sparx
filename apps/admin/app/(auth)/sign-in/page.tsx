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
import { signIn, twoFactor } from '@sparx/operator-auth/client';
import { AuthShell } from '../_components/auth-shell';

/** Server: backupCodeOptions.length on the operator twoFactor plugin. */
const BACKUP_CODE_LENGTH = 10;
const TOTP_LENGTH = 6;

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Second-factor challenge. Reached only after the password is accepted — no
  // operator session exists until the code is verified, so this is the same
  // sign-in continuing, not a second screen guarding an already-open door.
  const [challenge, setChallenge] = React.useState(false);
  const [code, setCode] = React.useState('');
  const [useBackupCode, setUseBackupCode] = React.useState(false);

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
    // Right password, second factor still owed. Drop the password from state on
    // the way — it has done its job and this step can sit open for minutes.
    if ((result.data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect === true) {
      setPassword('');
      setCode('');
      setSubmitting(false);
      setChallenge(true);
      return;
    }
    router.push('/');
    router.refresh();
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = useBackupCode
      ? await twoFactor.verifyBackupCode({ code })
      : await twoFactor.verifyTotp({ code });
    if (result.error) {
      setError(
        useBackupCode
          ? 'That backup code did not work. Each code can only be used once.'
          : 'That code did not work. Codes change every 30 seconds — try the current one.'
      );
      setCode('');
      setSubmitting(false);
      return;
    }
    router.push('/');
    router.refresh();
  }

  if (challenge) {
    const expected = useBackupCode ? BACKUP_CODE_LENGTH : TOTP_LENGTH;
    return (
      <AuthShell
        title="Two-step verification"
        subtitle={
          useBackupCode
            ? 'Enter one of your backup codes.'
            : 'Enter the code from your authenticator app.'
        }
      >
        <form onSubmit={onVerify} noValidate>
          <Stack gap={4}>
            <Field>
              <FieldLabel required>
                {useBackupCode ? 'Backup code' : 'Verification code'}
              </FieldLabel>
              <FieldControl
                name="code"
                {...(useBackupCode
                  ? { autoComplete: 'off' as const }
                  : { inputMode: 'numeric' as const, autoComplete: 'one-time-code' as const })}
                className="text-center text-lg tracking-[0.4em]"
                value={code}
                onChange={(e) =>
                  setCode(
                    (useBackupCode
                      ? e.target.value.trim()
                      : e.target.value.replace(/\D/g, '')
                    ).slice(0, expected)
                  )
                }
              />
            </Field>

            {error ? (
              <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                {error}
              </FieldStatus>
            ) : null}

            <Button
              type="submit"
              disabled={submitting || code.length < expected}
              loading={submitting}
            >
              Verify and sign in
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setUseBackupCode((prev) => !prev);
                setCode('');
                setError(null);
              }}
            >
              {useBackupCode ? 'Use my authenticator app instead' : 'Use a backup code'}
            </Button>
          </Stack>
        </form>
      </AuthShell>
    );
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
