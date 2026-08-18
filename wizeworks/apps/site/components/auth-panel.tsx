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

      <h1
        className="text-base-content text-3xl font-semibold tracking-tight"
        style={{ marginBottom: '0.5rem' }}
      >
        {mode === 'signin' ? 'Welcome back' : 'Create your account'}
      </h1>
      <p className="text-base-content" style={{ marginBottom: '1.5rem' }}>
        {mode === 'signin'
          ? 'Sign in to track orders and check out faster.'
          : 'Save your details for a faster checkout next time.'}
      </p>

      <form onSubmit={submit} className="flex max-w-[560px] flex-col gap-4">
        {mode === 'register' ? (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <label className="flex flex-col gap-1.5" style={{ flex: 1 }}>
              <span className="text-base-content text-sm font-medium">First name</span>
              <Input
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5" style={{ flex: 1 }}>
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
            <span className="text-base-content text-xs">At least 8 characters.</span>
          ) : (
            <Link href="/account/forgot" className="link link-primary self-start text-xs">
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
