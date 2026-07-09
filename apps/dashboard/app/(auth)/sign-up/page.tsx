'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import posthog from 'posthog-js';
import { ATTR_COOKIES, deserializeSnapshot } from '@sparx/attribution';
import {
  Button,
  Checkbox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  PasswordInput,
} from '@wizeworks/silicaui-react';
import { AuthScreen, RailPoints } from '../_components/auth-screen';
import { SocialAuthSection } from '../_components/social-auth';
import { rule, rules, useFieldValidation } from '@sparx/forms';

const LEGAL_BASE = 'https://sparx.works/legal';
import { signUpAction } from '../actions';

function readCookie(name: string): string | null {
  const match = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(document.cookie);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

// Stamp first-touch onto the PostHog person at signup (docs/80 §6.1). $set_once
// (the 3rd identify arg) so a later session can't overwrite the original source.
function identifyWithFirstTouch(userId: string): void {
  if (!userId || !posthog.__loaded) return;
  const first = deserializeSnapshot(readCookie(ATTR_COOKIES.first));
  posthog.identify(
    userId,
    {},
    first
      ? {
          first_touch_channel: first.channel,
          first_touch_source: first.source,
          first_touch_campaign: first.campaign,
          first_touch_at: first.capturedAt,
        }
      : {}
  );
}

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [agreeLegal, setAgreeLegal] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const values = { name, email, password, confirmPassword, agreeLegal };
  const v = useFieldValidation(values, {
    name: rule.required('Enter your name.'),
    email: rules(rule.required('Enter your email.'), rule.email()),
    password: rule.minLength(8, 'Password must be at least 8 characters.'),
    confirmPassword: rule.matches('password', 'Passwords do not match.'),
    agreeLegal: rule.required('You must accept the policies to continue.'),
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    if (!v.validate()) return;

    startTransition(async () => {
      const formData = new FormData(e.currentTarget);
      const result = await signUpAction(formData);
      if (!result.ok) {
        const message = result.error ?? 'Could not create account.';
        // Route a duplicate-account error onto the email field; otherwise surface it
        // above the submit button.
        if (/email|account|exist|use|taken|registered/i.test(message)) {
          v.setServerErrors({ email: message });
        } else {
          setFormError(message);
        }
        return;
      }
      if (result.userId) identifyWithFirstTouch(result.userId);
      // The natural-language story flow (/story) is the primary onboarding entry. A
      // visitor who arrived with a pre-picked blueprint (the marketplace/template
      // funnel, docs/60 Ph5) instead lands in the classic wizard, whose template step
      // honors that selection. Read the param from the URL at submit time (client-only)
      // rather than useSearchParams, which would force this page out of static
      // prerender and break `next build`.
      const blueprint = new URLSearchParams(window.location.search).get('blueprint');
      router.push(blueprint ? `/onboarding?blueprint=${encodeURIComponent(blueprint)}` : '/story');
      router.refresh();
    });
  }

  return (
    <AuthScreen
      lede={{
        title: 'Everything you need to go live.',
        blurb:
          'Content, commerce, CRM, and email — switch on the modules you use and launch a complete, themed site in minutes.',
      }}
      aside={
        <RailPoints
          points={[
            'Free for 14 days — no card required.',
            'Start from a designed blueprint, not a blank page.',
            'Add or drop modules anytime; pay only for what you use.',
          ]}
        />
      }
    >
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Create your account</h2>
          <p className="text-base-content/70">
            Start a 14-day free trial. Next, tell us about your business and we&apos;ll set it up.
          </p>
        </div>

        <SocialAuthSection />

        <form onSubmit={onSubmit} noValidate>
          <div className="flex flex-col gap-4">
            <Field {...v.field('name')}>
              <FieldLabel required>Your name</FieldLabel>
              <FieldControl
                name="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                {...v.control('name')}
              />
            </Field>
            <Field {...v.field('email')}>
              <FieldLabel required>Work email</FieldLabel>
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
              <FieldLabel required>Password</FieldLabel>
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
              <FieldLabel required>Confirm password</FieldLabel>
              <FieldControl
                name="confirmPassword"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                {...v.control('confirmPassword')}
                render={<PasswordInput />}
              />
            </Field>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="agreeLegal"
                  name="agreeLegal"
                  aria-label="I agree to the Terms of Service, Privacy Policy, and Acceptable Use Policy"
                  className="mt-1"
                  checked={agreeLegal}
                  onChange={(e) => setAgreeLegal(e.target.checked)}
                  onBlur={() => v.touch('agreeLegal')}
                />
                <p className="text-base-content/70 text-sm">
                  I agree to the{' '}
                  <a
                    href={`${LEGAL_BASE}/terms`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Terms of Service
                  </a>
                  ,{' '}
                  <a
                    href={`${LEGAL_BASE}/privacy`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Privacy Policy
                  </a>
                  , and{' '}
                  <a
                    href={`${LEGAL_BASE}/aup`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Acceptable Use Policy
                  </a>
                  .
                </p>
              </div>
              {v.visibleError('agreeLegal') && (
                <FieldStatus status="error" attached={false}>
                  {v.visibleError('agreeLegal')}
                </FieldStatus>
              )}
            </div>

            {formError && (
              <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                {formError}
              </FieldStatus>
            )}

            <Button type="submit" disabled={pending} loading={pending}>
              Create account
            </Button>
          </div>
        </form>

        <div className="flex flex-row items-center gap-1">
          <p className="text-base-content/70 text-sm">Already have an account?</p>
          <Button color="primary" variant="link" size="sm" render={<Link href="/sign-in" />}>
            Sign in
          </Button>
        </div>
      </div>
    </AuthScreen>
  );
}
