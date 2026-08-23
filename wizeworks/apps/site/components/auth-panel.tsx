'use client';

// Storefront auth panel — sign in / create account, tabbed. Drives the
// CustomerProvider's login/register and, on success, redirects to the
// `redirect` query param (e.g. back to checkout) or the account dashboard.

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { useCustomer } from '@/components/customer-provider';
import { AccountError } from '@/lib/customer-client';
import { Alert, Button, Input, Tabs, TabsList, TabsTab } from '@wizeworks/silicaui-react';

type Mode = 'signin' | 'register';

export function AuthPanel({ initial = 'signin' }: { initial?: Mode }) {
  const { login, register } = useCustomer();
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get('redirect') ?? '/account';

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
      if (mode === 'signin') {
        await login(email, password);
      } else {
        await register({
          email,
          password,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
        });
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

  return (
    <div className="mx-auto w-full max-w-[68ch] px-6 py-10">
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
