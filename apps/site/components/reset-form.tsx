'use client';

// Set-new-password form. Reads the single-use token from the URL, posts it with
// the new password, and on success points the shopper back to sign in.

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { SparxAlert, SparxButton, SparxInput } from '@sparx/site-ui';

import { useCustomer } from '@/components/customer-provider';
import { resetPassword, AccountError } from '@/lib/customer-client';

export function ResetForm() {
  const { tenantSlug } = useCustomer();
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <SparxAlert color="danger">
        This reset link is missing its token. Request a new one from{' '}
        <Link href="/account/forgot">forgot password</Link>.
      </SparxAlert>
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
      setTimeout(() => router.push('/account/login'), 1500);
    } catch (err) {
      setError(err instanceof AccountError ? err.message : 'Could not reset your password.');
      setState('idle');
    }
  }

  if (state === 'done') {
    return (
      <SparxAlert color="neutral" variant="soft" role="status">
        Your password has been reset. Redirecting you to sign in…
      </SparxAlert>
    );
  }

  return (
    <form onSubmit={submit} className="st-form">
      <label className="st-field">
        <span>New password</span>
        <SparxInput
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <span className="st-muted" style={{ fontSize: '0.8rem' }}>
          At least 8 characters.
        </span>
      </label>
      <label className="st-field">
        <span>Confirm password</span>
        <SparxInput
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </label>
      {error ? <SparxAlert color="danger">{error}</SparxAlert> : null}
      <SparxButton type="submit" color="primary" size="lg" disabled={state === 'busy'}>
        {state === 'busy' ? 'Saving…' : 'Set new password'}
      </SparxButton>
    </form>
  );
}
