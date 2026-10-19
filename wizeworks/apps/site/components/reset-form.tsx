'use client';

// Set-new-password form. Reads the single-use token from the URL, posts it with
// the new password, and on success says so and offers the way back to sign in.

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Alert, Button, Input } from '@wizeworks/silicaui-react';

import { useCustomer } from '@/components/customer-provider';
import { resetPassword, AccountError } from '@/lib/customer-client';

export function ResetForm() {
  const { tenantSlug } = useCustomer();
  const token = useSearchParams().get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <Alert color="danger">
        This reset link is missing its token. Request a new one from{' '}
        <Link href="/account/forgot">forgot password</Link>.
      </Alert>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords don’t match.');
      return;
    }
    setState('busy');
    setError(null);
    try {
      await resetPassword(tenantSlug, token, password);
      setState('done');
    } catch (err) {
      setError(err instanceof AccountError ? err.message : 'Could not reset your password.');
      setState('idle');
    }
  }

  // It stays until she moves on. It was a grey line for 1.5 seconds, then the
  // sign-in page, which said nothing about a new password: a person who looked
  // away never saw it worked (sparx persona issue 346).
  if (state === 'done') {
    return (
      <div className="flex max-w-[560px] flex-col gap-4">
        <Alert color="success" variant="soft" role="status">
          Your new password is set. Sign in with it now.
        </Alert>
        <Button render={<Link href="/account/login" />} color="primary" size="lg">
          Sign in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex max-w-[560px] flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-base-content text-sm font-medium">New password</span>
        <Input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <span className="text-base-content text-sm">At least 8 characters.</span>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-base-content text-sm font-medium">Confirm password</span>
        <Input
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </label>
      {error ? <Alert color="danger">{error}</Alert> : null}
      <Button type="submit" color="primary" size="lg" disabled={state === 'busy'}>
        {state === 'busy' ? 'Saving…' : 'Set new password'}
      </Button>
    </form>
  );
}
