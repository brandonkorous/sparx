'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button, Field, FieldControl, FieldLabel } from '@wizeworks/silicaui-react';
import { authClient } from '@sparx/auth/client';
import { AuthScreen } from '../_components/auth-screen';
import { rule, rules, useFieldValidation } from '@sparx/forms';

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const v = useFieldValidation(
    { email },
    { email: rules(rule.required('Enter your email.'), rule.email()) }
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.validate()) return;
    setSubmitting(true);

    await authClient.requestPasswordReset({
      email,
      redirectTo: '/reset-password',
    });

    setSubmitting(false);
    // Don't leak whether the account exists — always show the same success
    // state. Real error logging happens server-side.
    setSubmitted(true);
  }

  return (
    <AuthScreen
      lede={{
        title: "Let's get you back in.",
        blurb: "Enter your email and we'll send a secure link to set a new password.",
      }}
    >
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Reset your password</h2>
          <p className="text-base-content">
            Enter the email tied to your account and we&apos;ll send you a reset link.
          </p>
        </div>

        {submitted ? (
          <p className="text-sm">
            If an account exists for <strong>{email}</strong>, you&apos;ll get an email within a
            minute. Check your spam folder if you don&apos;t see it.
          </p>
        ) : (
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

              <Button type="submit" disabled={submitting} loading={submitting}>
                Send reset link
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
