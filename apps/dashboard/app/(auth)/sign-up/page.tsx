'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import posthog from 'posthog-js';
import { ATTR_COOKIES, deserializeSnapshot } from '@sparx/attribution';
import { Button, Checkbox, Heading, Input, Label, PasswordInput, Stack, Text } from '@sparx/ui';
import { AuthScreen, RailPoints } from '../_components/auth-screen';
import { SocialAuthSection } from '../_components/social-auth';

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
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const pw = formData.get('password');
    const cf = formData.get('confirmPassword');
    const password = typeof pw === 'string' ? pw : '';
    const confirm = typeof cf === 'string' ? cf : '';

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await signUpAction(formData);
      if (!result.ok) {
        setError(result.error ?? 'Could not create account.');
        return;
      }
      if (result.userId) identifyWithFirstTouch(result.userId);
      // Carry the marketplace funnel's template pick into onboarding so a referred
      // visitor lands on their chosen template pre-selected (docs/60 Ph5). Read it
      // from the URL at submit time (client-only) rather than useSearchParams, which
      // would force this page out of static prerender and break `next build`.
      const blueprint = new URLSearchParams(window.location.search).get('blueprint');
      router.push(
        blueprint ? `/onboarding?blueprint=${encodeURIComponent(blueprint)}` : '/onboarding'
      );
      router.refresh();
    });
  }

  return (
    <AuthScreen
      lede={{
        title: 'Build it your way — content, commerce, or both.',
        blurb: 'Switch on only the modules you need. A complete, themed site in minutes.',
      }}
      aside={
        <RailPoints
          points={[
            'Free for 14 days — no card required.',
            'Start from a complete blueprint, not a blank page.',
            'Add or drop modules anytime; you only pay for what you use.',
          ]}
        />
      }
    >
      <Stack gap={6}>
        <div>
          <Heading level={2}>Create your account</Heading>
          <Text variant="muted">
            Start a 14-day free trial. You&apos;ll name your workspace in the next step.
          </Text>
        </div>

        <SocialAuthSection />

        <form onSubmit={onSubmit} noValidate>
          <Stack gap={4}>
            <Stack gap={2}>
              <Label htmlFor="name">Your name</Label>
              <Input id="name" name="name" autoComplete="name" required />
            </Stack>
            <Stack gap={2}>
              <Label htmlFor="email">Work email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </Stack>
            <Stack gap={2}>
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
              <Text size="xs" variant="muted">
                At least 8 characters.
              </Text>
            </Stack>
            <Stack gap={2}>
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Stack>

            <div className="flex items-start gap-2">
              <Checkbox
                id="agreeLegal"
                name="agreeLegal"
                aria-label="I agree to the Terms of Service, Privacy Policy, and Acceptable Use Policy"
                className="mt-1"
                required
              />
              <Text size="sm" variant="muted">
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
              </Text>
            </div>

            {error && (
              <Text size="sm" variant="danger" role="alert" aria-live="polite">
                {error}
              </Text>
            )}

            <Button type="submit" disabled={pending} loading={pending}>
              Create account
            </Button>
          </Stack>
        </form>

        <Stack direction="row" align="center" gap={1}>
          <Text size="sm" variant="muted">
            Already have an account?
          </Text>
          <Button color="primary" variant="link" size="sm" asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </Stack>
      </Stack>
    </AuthScreen>
  );
}
