'use client';

// Storefront auth panel — sign in / create account, tabbed. Drives the
// CustomerProvider's login/register and, on success, redirects to the
// `redirect` query param (e.g. back to checkout) or the account dashboard.

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ConfirmEmailNotice } from '@/components/confirm-email-notice';
import { useCustomer } from '@/components/customer-provider';
import { signedInDestination } from '@/lib/auth-redirect';
import { AccountError } from '@/lib/customer-client';
import { Alert, Button, Input, Tabs, TabsList, TabsTab } from '@wizeworks/silicaui-react';

type Mode = 'signin' | 'register';

export function AuthPanel({ initial = 'signin' }: { initial?: Mode }) {
  const { login, register, status, awaitingEmail, awaitingLinkSent } = useCustomer();
  const router = useRouter();
  const params = useSearchParams();
  // A path on this site only, the same rule as below.
  const redirectTo = signedInDestination('authenticated', params.get('redirect')) ?? '/account';

  // Already signed in: go on to where the link was taking them, never an empty
  // form as if they were signed out (sparx persona issue 189).
  const alreadyIn = signedInDestination(status, params.get('redirect'));
  useEffect(() => {
    if (alreadyIn) router.replace(alreadyIn);
  }, [alreadyIn, router]);

  // Sent here by an order email's "Track your order". Most of the people who
  // follow it bought as a guest and have no password, and "Sign in" alone was a
  // dead end for them (sparx persona issue 329).
  const fromOrders = redirectTo.startsWith('/account/orders');

  const [mode, setMode] = useState<Mode>(initial);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const outcome =
        mode === 'signin'
          ? await login(email, password)
          : await register({
              email,
              password,
              firstName: firstName || undefined,
              lastName: lastName || undefined,
            });
      // The account is made, and what is already kept under this email waits for
      // the confirm link (sparx persona issue 329): the notice below says so.
      if (outcome === 'confirm-email') {
        setBusy(false);
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      const msg =
        err instanceof AccountError ? err.message : 'Something went wrong. Please try again.';
      setError(msg);
      setBusy(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  if (awaitingEmail) {
    return (
      <div className="mx-auto w-full max-w-[68ch] py-10 sm:px-6">
        <h1 className="text-base-content mb-6 text-3xl font-semibold tracking-tight">
          Confirm your email
        </h1>
        <ConfirmEmailNotice email={awaitingEmail} sent={awaitingLinkSent} />
      </div>
    );
  }

  return (
    // No side padding of its own on a phone: the page and the shell around it
    // already pad it, and a third 24px left 216px for two tabs that need 220,
    // so "Create account" was cut off on every phone (sparx persona issue 329).
    <div className="mx-auto w-full max-w-[68ch] py-10 sm:px-6">
      <Tabs
        variant="boxed"
        color="primary"
        value={mode}
        onValueChange={(v) => switchMode(v as Mode)}
        className="mb-6"
      >
        <TabsList aria-label="Account">
          <TabsTab value="signin">Sign in</TabsTab>
          <TabsTab value="register">Create account</TabsTab>
        </TabsList>
      </Tabs>

      {/* SAYS NOTHING ABOUT A SHOP. This renderer serves every kind of business,
          and most of them sell nothing at all — a two-chair salon's customer
          following a "change my appointment" link was met with "Welcome back",
          "track orders" and "check out faster", three sentences in a row about a
          shop she had never been in (issue 153). Selling is one capability here,
          never the assumption. */}
      <h1 className="text-base-content mb-2 text-3xl font-semibold tracking-tight">
        {mode === 'signin' ? 'Sign in' : 'Create your account'}
      </h1>
      <p className="text-base-content mb-6">
        {mode === 'signin'
          ? 'Sign in to see everything you have with us and keep your details up to date.'
          : 'An account keeps your details to hand, so you never type them twice.'}
      </p>

      {fromOrders && mode === 'signin' ? (
        <Alert color="info" className="mb-6 max-w-[560px]">
          <span>
            Ordered without an account?{' '}
            <button
              type="button"
              className="link font-semibold"
              onClick={() => switchMode('register')}
            >
              Create one
            </button>{' '}
            with the email you ordered with. We email you a link, and your orders join your account.
          </span>
        </Alert>
      ) : null}

      <form onSubmit={submit} className="flex max-w-[560px] flex-col gap-4">
        {mode === 'register' ? (
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-base-content text-sm font-medium">First name</span>
              <Input
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-base-content text-sm font-medium">Last name</span>
              <Input
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </label>
          </div>
        ) : null}

        <label className="flex flex-col gap-1.5">
          <span className="text-base-content text-sm font-medium">Email</span>
          <Input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-base-content text-sm font-medium">Password</span>
          <Input
            type="password"
            required
            minLength={mode === 'register' ? 8 : undefined}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === 'register' ? (
            <span className="text-base-content text-sm">At least 8 characters.</span>
          ) : (
            <Link href="/account/forgot" className="link link-primary self-start text-sm">
              Forgot your password?
            </Link>
          )}
        </label>

        {error ? (
          <Alert color="danger" role="alert">
            {error}
          </Alert>
        ) : null}

        <Button type="submit" color="primary" size="lg" disabled={busy}>
          {busy
            ? mode === 'signin'
              ? 'Signing in…'
              : 'Creating account…'
            : mode === 'signin'
              ? 'Sign in'
              : 'Create account'}
        </Button>
      </form>
    </div>
  );
}
