'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import posthog from 'posthog-js';
import { ATTR_COOKIES, deserializeSnapshot } from '@sparx/attribution';
import { Button, Checkbox, Input, Label } from 'silicaui-react';
import { PasswordInput } from '@sparx/ui';
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Your name</Label>
              <Input id="name" name="name" autoComplete="name" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
              <p className="text-base-content/70 text-xs">At least 8 characters.</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="agreeLegal"
                name="agreeLegal"
                aria-label="I agree to the Terms of Service, Privacy Policy, and Acceptable Use Policy"
                className="mt-1"
                required
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

            {error && (
              <p className="text-danger text-sm" role="alert" aria-live="polite">
                {error}
              </p>
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
